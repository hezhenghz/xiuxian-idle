import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const CONFIG_DIR = 'src/config';
const DATA_DIR = 'data';

// Read all JSON files from src/config/, create .xlsx in data/

const files = fs.readdirSync(CONFIG_DIR).filter(f => f.endsWith('.json'));

for (const file of files) {
  const filePath = path.join(CONFIG_DIR, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);

  // Normalize: ensure data is an array of objects
  const rows = Array.isArray(data) ? data : [data];
  if (rows.length === 0) continue;

  const sheetName = file.replace('.json', '');
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);

  const outName = file.replace('.json', '.xlsx');
  const outPath = path.join(DATA_DIR, outName);

  XLSX.writeFile(workbook, outPath);
  console.log(`  ${file} → ${outPath} (${rows.length} rows)`);
}

console.log(`\nDone. Created ${files.length} Excel file(s) in data/.`);
