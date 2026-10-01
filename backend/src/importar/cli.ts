import path from 'node:path';
import ExcelJS from 'exceljs';
import { openDb } from '../db';
import { gravarDados } from './gravarDados';
import { lerPlanilha } from './lerPlanilha';

function opcao(nome: string, padrao: string): string {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : padrao;
}

async function main() {
  const arquivo = process.argv[2];
  if (!arquivo || arquivo.startsWith('--')) {
    console.error('Uso: npm run importar -- <arquivo.xlsx> [--ano 2026] [--aba-energia "ENERGIA 2026- LIVRE (TESTE WEL)"] [--aba-agua "ÁGUA 2026"]');
    process.exit(1);
  }
  const ano = Number(opcao('ano', '2026'));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(arquivo);
  const dados = lerPlanilha(wb, {
    abaEnergia: opcao('aba-energia', 'ENERGIA 2026- LIVRE (TESTE WEL)'),
    abaAgua: opcao('aba-agua', 'ÁGUA 2026'),
  });

  const db = openDb(process.env.DB_PATH ?? path.resolve(__dirname, '..', '..', 'dados.sqlite'));
  const resumo = gravarDados(db, ano, dados);

  console.log('Importação concluída:', resumo);
  console.log('Fornecedores encontrados:', dados.fornecedores);
  console.log('Pontos encontrados:', dados.pontos.map((p) => `${p.tipo}:${p.nome}`));
  if (dados.medidores.length) {
    console.log('Medidores de água encontrados:');
    console.table(dados.medidores);
  }
  if (dados.avisos.length) console.warn('Avisos:\n- ' + dados.avisos.join('\n- '));
}

main().catch((e) => {
  console.error('Falha na importação:', e instanceof Error ? e.message : e);
  process.exit(1);
});
