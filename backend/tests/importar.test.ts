import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { gravarDados } from '../src/importar/gravarDados';
import { lerPlanilha, norm, numero } from '../src/importar/lerPlanilha';
import { openDb } from '../src/db';

// Fixture no mesmo layout da planilha real:
// energia = blocos mensais lado a lado (título mesclado, linha de fornecedores, TOTAL, CONSUMO);
// água = coluna A hidrômetro, B endereço, C local, D.. meses; tabela de medidores com duas colunas MATRICULA.
function planilha(comResumoAnual = false): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();

  const e = wb.addWorksheet('ENERGIA 2026- LIVRE (TESTE WEL)');
  if (comResumoAnual) {
    // Tabela "RESUMO ANUAL" da planilha real: cabeçalho com meses abreviados, um mês por extenso ("MAIO") e TOTAL na mesma linha.
    ['JAN', 'MAIO', 'TOTAL'].forEach((t, i) => (e.getCell(30, i + 2).value = t));
    e.getCell(31, 1).value = 'BENTO LEÃO 25';
    e.getCell(31, 2).value = 15609.74;
    e.getCell(31, 3).value = 19074.54;
    e.getCell(31, 4).value = { formula: 'SUM(B31:C31)', result: 34684.28 };
  }
  const bloco = (linha: number, mes: string, dados: [string, number, number | string, number][]) => {
    e.getCell(linha, 2).value = mes;
    e.mergeCells(linha, 2, linha, 3); // título mesclado B:C
    e.getCell(linha, 4).value = 'TOTAL';
    e.mergeCells(linha, 4, linha + 1, 4);
    e.getCell(linha, 5).value = 'CONSUMO';
    e.mergeCells(linha, 5, linha + 1, 5);
    e.getCell(linha + 1, 2).value = 'EQUATORIAL';
    e.getCell(linha + 1, 3).value = 'RENOVAVEIS ';
    dados.forEach(([nome, v1, v2, cons], i) => {
      const r = linha + 2 + i;
      e.getCell(r, 1).value = nome;
      e.getCell(r, 2).value = v1;
      e.getCell(r, 3).value = v2;
      e.getCell(r, 4).value = { formula: 'SUM(B:C)', result: 999 }; // total da planilha é ignorado
      e.getCell(r, 5).value = cons;
    });
    e.getCell(linha + 2 + dados.length, 1).value = 'TOTAL';
    e.getCell(linha + 3 + dados.length, 1).value = 'KWH';
  };
  bloco(2, 'MAIO', [
    ['AREOLINO DE ABREU', 10906.52, 4265.21, 19.62],
    ['BENTO LEÃO 25', 10784.49, 'R$ 4.623,81', 17.54],
  ]);
  bloco(12, 'MARÇO ', [['AREOLINO DE ABREU', 11664.61, 4414.85, 19.8]]);

  const a = wb.addWorksheet('ÁGUA 2026');
  const cabecalho = (linha: number) =>
    ['HIDROMETRO', 'ENDEREÇO', 'LOCAL DE ABASTECIMENTO', 'JAN', 'FEV', 'AGOS ', 'TOTAL ANO'].forEach((t, i) => (a.getCell(linha, i + 1).value = t));
  a.getCell('B1').value = 'CONSUMO (M³)';
  a.mergeCells('B1:G1');
  cabecalho(2);
  a.getCell('A3').value = 'E15N001061';
  a.getCell('C3').value = 'PRODUÇÃO/STA';
  a.getCell('D3').value = 276;
  a.getCell('F3').value = 345;
  a.getCell('G3').value = { formula: 'SUM(D3:F3)', result: 621 };
  a.getCell('A4').value = 'B11L006108';
  a.getCell('C4').value = 'ADM/CQ';
  a.getCell('D4').value = 56;
  a.getCell('E4').value = 46;
  a.getCell('B7').value = 'VALOR';
  a.mergeCells('B7:G7');
  cabecalho(8);
  a.getCell('A9').value = 'E15N001061';
  a.getCell('C9').value = 'PRODUÇÃO/STA';
  a.getCell('D9').value = 5885.3;
  a.getCell('A10').value = 'B11L006108';
  a.getCell('C10').value = 'ADM/CQ';
  a.getCell('D10').value = 1096.59;
  a.getCell('C11').value = 'TOTAL';
  a.getCell('D11').value = 6981.89;
  ['UND.CONSUMIDORA', 'MATRICULA', 'MATRICULA', 'HIDROMETRO', 'LOCALIZAÇÃO'].forEach((t, i) => (a.getCell(13, i + 1).value = t));
  ['AREOLINO DE ABREU - 306', '2737849-7', '227378497-4', 'E15N001061', '01-600-10-500-0155'].forEach((t, i) => (a.getCell(14, i + 1).value = t));
  return wb;
}

const opts = { abaEnergia: 'ENERGIA 2026- LIVRE (TESTE WEL)', abaAgua: 'ÁGUA 2026' };

describe('norm e numero', () => {
  it('normaliza acentos, espaços e caixa', () => expect(norm('  Localização ')).toBe('LOCALIZACAO'));
  it('lê números pt-BR e números nativos', () => {
    expect(numero(12.5)).toBe(12.5);
    expect(numero('R$ 1.234,56')).toBe(1234.56);
    expect(numero('10577,1')).toBe(10577.1);
    expect(numero('')).toBeNull();
    expect(numero('-')).toBeNull();
    expect(numero('abc')).toBeNull();
    expect(numero(null)).toBeNull();
  });
  it('texto com ponto de milhar e sem vírgula vale milhar, não decimal', () => {
    expect(numero('1.234')).toBe(1234);
    expect(numero('R$ 1.234.567')).toBe(1234567);
    expect(numero('12.5')).toBe(12.5);
  });
});

describe('lerPlanilha', () => {
  const dados = lerPlanilha(planilha(), opts);

  it('lê energia: fornecedores, valores e consumo por mês', () => {
    expect(dados.fornecedores.sort()).toEqual(['EQUATORIAL', 'RENOVAVEIS']);
    const v = dados.valores.filter((x) => x.tipo === 'energia');
    expect(v).toContainEqual({ ponto: 'AREOLINO DE ABREU', tipo: 'energia', mes: 5, fornecedor: 'EQUATORIAL', valorRs: 10906.52 });
    expect(v).toContainEqual({ ponto: 'BENTO LEÃO 25', tipo: 'energia', mes: 5, fornecedor: 'RENOVAVEIS', valorRs: 4623.81 });
    expect(dados.consumos).toContainEqual({ ponto: 'BENTO LEÃO 25', tipo: 'energia', mes: 5, quantidade: 17.54 });
  });

  it('reconhece título com acento e espaço no fim (MARÇO )', () => {
    expect(dados.valores).toContainEqual({ ponto: 'AREOLINO DE ABREU', tipo: 'energia', mes: 3, fornecedor: 'EQUATORIAL', valorRs: 11664.61 });
  });

  it('ignora a linha TOTAL, a linha KWH e o total calculado da planilha', () => {
    expect(dados.pontos.map((p) => p.nome)).not.toContain('TOTAL');
    expect(dados.pontos.map((p) => p.nome)).not.toContain('KWH');
    expect(dados.valores.some((x) => x.valorRs === 999)).toBe(false);
    expect(dados.avisos).toEqual([]);
  });

  it('ignora a tabela RESUMO ANUAL (mês por extenso + TOTAL na mesma linha) e avisa', () => {
    const d = lerPlanilha(planilha(true), opts);
    expect(d.fornecedores.sort()).toEqual(['EQUATORIAL', 'RENOVAVEIS']);
    expect(d.pontos.filter((p) => p.tipo === 'energia').map((p) => p.nome).sort()).toEqual(['AREOLINO DE ABREU', 'BENTO LEÃO 25']);
    expect(d.valores).toHaveLength(dados.valores.length);
    expect(d.avisos).toHaveLength(1);
    expect(d.avisos[0]).toMatch(/sem coluna TOTAL/);
  });

  it('ignora blocos sob título de outro ano e avisa (evita sobrescrever o ano certo)', () => {
    const wb = planilha();
    const e = wb.getWorksheet('ENERGIA 2026- LIVRE (TESTE WEL)')!;
    e.getCell(1, 1).value = 'ENERGIA 2026';
    e.mergeCells(1, 1, 1, 5);
    e.getCell(11, 1).value = 'ENERGIA 2025';
    e.mergeCells(11, 1, 11, 5);
    const d = lerPlanilha(wb, { ...opts, ano: 2026 });
    expect(d.valores.some((v) => v.tipo === 'energia' && v.mes === 5)).toBe(true);
    expect(d.valores.some((v) => v.tipo === 'energia' && v.mes === 3)).toBe(false);
    expect(d.avisos.join(' ')).toMatch(/2025/);
  });

  it('lê água: consumo e valor por local e mês (AGOS pelas 3 primeiras letras)', () => {
    expect(dados.consumos).toContainEqual({ ponto: 'PRODUÇÃO/STA', tipo: 'agua', mes: 1, quantidade: 276 });
    expect(dados.consumos).toContainEqual({ ponto: 'PRODUÇÃO/STA', tipo: 'agua', mes: 8, quantidade: 345 });
    expect(dados.consumos).toContainEqual({ ponto: 'ADM/CQ', tipo: 'agua', mes: 2, quantidade: 46 });
    expect(dados.valores).toContainEqual({ ponto: 'ADM/CQ', tipo: 'agua', mes: 1, fornecedor: null, valorRs: 1096.59 });
    expect(dados.valores.some((x) => x.tipo === 'agua' && x.valorRs === 6981.89)).toBe(false); // linha TOTAL
    expect(dados.pontos.filter((p) => p.tipo === 'agua').map((p) => p.nome).sort()).toEqual(['ADM/CQ', 'PRODUÇÃO/STA']);
  });

  it('lê o hidrômetro de cada local de água e a tabela de medidores', () => {
    expect(dados.pontos.find((p) => p.nome === 'PRODUÇÃO/STA')?.hidrometro).toBe('E15N001061');
    expect(dados.pontos.find((p) => p.nome === 'ADM/CQ')?.hidrometro).toBe('B11L006108');
    expect(dados.medidores).toEqual([{ matricula: '227378497-4', hidrometro: 'E15N001061', localizacao: '01-600-10-500-0155' }]);
  });

  it('falha com mensagem útil quando a aba não existe', () => {
    expect(() => lerPlanilha(planilha(), { ...opts, abaAgua: 'NAO EXISTE' })).toThrow(/Abas disponíveis/);
  });
});

describe('gravarDados', () => {
  const contar = (db: ReturnType<typeof openDb>) => ({
    v: (db.prepare('SELECT COUNT(*) AS n FROM lancamento_valor').get() as { n: number }).n,
    c: (db.prepare('SELECT COUNT(*) AS n FROM lancamento_consumo').get() as { n: number }).n,
    p: (db.prepare('SELECT COUNT(*) AS n FROM ponto').get() as { n: number }).n,
    f: (db.prepare('SELECT COUNT(*) AS n FROM fornecedor').get() as { n: number }).n,
  });

  it('é idempotente: importar duas vezes não duplica nem muda totais', () => {
    const db = openDb(':memory:');
    const dados = lerPlanilha(planilha(), opts);
    const r1 = gravarDados(db, 2026, dados);
    const antes = contar(db);
    expect(r1.valoresCriados).toBe(antes.v);
    const r2 = gravarDados(db, 2026, dados);
    expect(contar(db)).toEqual(antes);
    expect(r2.valoresCriados).toBe(0);
    expect(r2.valoresAtualizados).toBe(antes.v);
  });

  it('associa hidrômetro, matrícula e localização aos pontos de água sem sobrescrever edições manuais', () => {
    const db = openDb(':memory:');
    const dados = lerPlanilha(planilha(), opts);
    gravarDados(db, 2026, dados);
    const prod = db.prepare("SELECT hidrometro, matricula, localizacao FROM ponto WHERE nome = 'PRODUÇÃO/STA'").get();
    expect(prod).toEqual({ hidrometro: 'E15N001061', matricula: '227378497-4', localizacao: '01-600-10-500-0155' });
    const adm = db.prepare("SELECT hidrometro, matricula FROM ponto WHERE nome = 'ADM/CQ'").get();
    expect(adm).toEqual({ hidrometro: 'B11L006108', matricula: null });

    db.prepare("UPDATE ponto SET matricula = 'EDITADA' WHERE nome = 'PRODUÇÃO/STA'").run();
    gravarDados(db, 2026, dados);
    expect((db.prepare("SELECT matricula FROM ponto WHERE nome = 'PRODUÇÃO/STA'").get() as { matricula: string }).matricula).toBe('EDITADA');
  });
});
