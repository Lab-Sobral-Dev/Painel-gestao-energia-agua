import type { Cell, Workbook, Worksheet } from 'exceljs';

export interface DadosImportados {
  pontos: { nome: string; tipo: 'energia' | 'agua'; hidrometro?: string }[];
  fornecedores: string[];
  valores: { ponto: string; tipo: 'energia' | 'agua'; mes: number; fornecedor: string | null; valorRs: number }[];
  consumos: { ponto: string; tipo: 'energia' | 'agua'; mes: number; quantidade: number }[];
  medidores: { matricula: string; hidrometro: string; localizacao: string }[];
  avisos: string[];
}

const MESES_COMPLETOS = ['JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
const MESES_ABREV = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

export const norm = (s: unknown): string =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

function bruto(cell: Cell): unknown {
  const v = cell.value as unknown;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('result' in o) return o.result;
    if (Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((t) => t.text).join('');
    if ('text' in o) return o.text;
  }
  return v;
}

const texto = (cell: Cell): string => String(bruto(cell) ?? '').replace(/\s+/g, ' ').trim();

export function numero(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const limpo = v.replace(/R\$/g, '').replace(/\s/g, '');
  if (limpo === '' || limpo === '-') return null;
  const n = limpo.includes(',') ? Number(limpo.replace(/\./g, '').replace(',', '.')) : Number(limpo);
  return Number.isFinite(n) ? n : null;
}

function celulasComTexto(ws: Worksheet, filtro: (t: string) => boolean): { linha: number; col: number; cell: Cell }[] {
  const achadas: { linha: number; col: number; cell: Cell }[] = [];
  ws.eachRow((row, linha) =>
    row.eachCell((cell, col) => {
      if (cell.isMerged && cell.master.address !== cell.address) return; // só a célula-mestre
      if (filtro(norm(bruto(cell)))) achadas.push({ linha, col, cell });
    }),
  );
  return achadas;
}

function lerEnergia(ws: Worksheet, d: DadosImportados): void {
  const ancoras = celulasComTexto(ws, (t) => MESES_COMPLETOS.includes(t));
  for (const a of ancoras) {
    const mes = MESES_COMPLETOS.indexOf(norm(bruto(a.cell))) + 1;
    const cab = a.linha + 1;
    // TOTAL só vale na linha de cabeçalho dos fornecedores (logo abaixo do título). Procurar também na linha do
    // título aceitaria tabelas como "RESUMO ANUAL" (JAN ... MAIO ... TOTAL na mesma linha) como se fossem blocos mensais.
    let colTotal = -1;
    for (let c = a.col; c <= a.col + 20 && colTotal < 0; c++) if (norm(texto(ws.getCell(cab, c))) === 'TOTAL') colTotal = c;
    if (colTotal < 0) {
      d.avisos.push(`Energia: bloco "${norm(bruto(a.cell))}" em ${a.cell.address} sem coluna TOTAL; ignorado.`);
      continue;
    }
    const colConsumo = colTotal + 1;
    const temConsumo = norm(texto(ws.getCell(cab, colConsumo))) === 'CONSUMO' || norm(texto(ws.getCell(a.linha, colConsumo))) === 'CONSUMO';
    if (!temConsumo) d.avisos.push(`Energia: bloco em ${a.cell.address} sem coluna CONSUMO.`);

    const fornecedoresCol: { col: number; nome: string }[] = [];
    for (let c = a.col; c < colTotal; c++) {
      const nome = texto(ws.getCell(cab, c));
      if (nome) fornecedoresCol.push({ col: c, nome });
    }
    fornecedoresCol.forEach((f) => !d.fornecedores.includes(f.nome) && d.fornecedores.push(f.nome));

    for (let r = cab + 1; r <= cab + 60; r++) {
      const nome = texto(ws.getCell(r, a.col - 1));
      if (!nome || norm(nome) === 'TOTAL') break;
      if (!d.pontos.some((p) => p.nome === nome && p.tipo === 'energia')) d.pontos.push({ nome, tipo: 'energia' });
      for (const f of fornecedoresCol) {
        const v = numero(bruto(ws.getCell(r, f.col)));
        if (v !== null) d.valores.push({ ponto: nome, tipo: 'energia', mes, fornecedor: f.nome, valorRs: v });
      }
      if (temConsumo) {
        const q = numero(bruto(ws.getCell(r, colConsumo)));
        if (q !== null) d.consumos.push({ ponto: nome, tipo: 'energia', mes, quantidade: q });
      }
    }
  }
}

function lerAgua(ws: Worksheet, d: DadosImportados): void {
  for (const h of celulasComTexto(ws, (t) => t === 'LOCAL DE ABASTECIMENTO')) {
    let titulo = '';
    ws.getRow(h.linha - 1).eachCell((cell) => (titulo += ' ' + norm(bruto(cell))));
    const secao = titulo.includes('CONSUMO') ? 'consumo' : titulo.includes('VALOR') ? 'valor' : null;
    if (!secao) {
      d.avisos.push(`Água: tabela em ${h.cell.address} sem título CONSUMO/VALOR; ignorada.`);
      continue;
    }
    const colunas: { col: number; mes: number }[] = [];
    let colHidrometro = -1;
    ws.getRow(h.linha).eachCell((cell, col) => {
      const t = norm(bruto(cell));
      if (col < h.col && t === 'HIDROMETRO') colHidrometro = col;
      if (col <= h.col) return;
      const i = MESES_ABREV.indexOf(t.slice(0, 3));
      if (i >= 0) colunas.push({ col, mes: i + 1 });
    });
    for (let r = h.linha + 1; r <= h.linha + 60; r++) {
      const nome = texto(ws.getCell(r, h.col));
      if (!nome || norm(nome) === 'TOTAL') break;
      const hidrometro = colHidrometro > 0 ? texto(ws.getCell(r, colHidrometro)) : '';
      const existente = d.pontos.find((p) => p.nome === nome && p.tipo === 'agua');
      if (!existente) d.pontos.push({ nome, tipo: 'agua', ...(hidrometro ? { hidrometro } : {}) });
      else if (hidrometro && !existente.hidrometro) existente.hidrometro = hidrometro;
      for (const c of colunas) {
        const v = numero(bruto(ws.getCell(r, c.col)));
        if (v === null) continue;
        if (secao === 'consumo') d.consumos.push({ ponto: nome, tipo: 'agua', mes: c.mes, quantidade: v });
        else d.valores.push({ ponto: nome, tipo: 'agua', mes: c.mes, fornecedor: null, valorRs: v });
      }
    }
  }

  // A planilha real tem duas colunas "MATRICULA" lado a lado; só vale a que vem antes de "HIDROMETRO".
  for (const m of celulasComTexto(ws, (t) => t === 'MATRICULA')) {
    if (norm(texto(ws.getCell(m.linha, m.col + 1))) !== 'HIDROMETRO') continue;
    for (let r = m.linha + 1; r <= m.linha + 60; r++) {
      const matricula = texto(ws.getCell(r, m.col));
      if (!matricula) break;
      d.medidores.push({
        matricula,
        hidrometro: texto(ws.getCell(r, m.col + 1)),
        localizacao: texto(ws.getCell(r, m.col + 2)),
      });
    }
  }
}

function aba(wb: Workbook, nome: string): Worksheet {
  const ws = wb.worksheets.find((w) => norm(w.name) === norm(nome));
  if (!ws) throw new Error(`Aba "${nome}" não encontrada. Abas disponíveis: ${wb.worksheets.map((w) => `"${w.name}"`).join(', ')}`);
  return ws;
}

export function lerPlanilha(wb: Workbook, opts: { abaEnergia: string; abaAgua: string }): DadosImportados {
  const d: DadosImportados = { pontos: [], fornecedores: [], valores: [], consumos: [], medidores: [], avisos: [] };
  lerEnergia(aba(wb, opts.abaEnergia), d);
  lerAgua(aba(wb, opts.abaAgua), d);
  return d;
}
