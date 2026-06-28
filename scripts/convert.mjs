import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const DATA_DIR = 'data';
const CONFIG_DIR = 'src/config';

// Configs that should be single objects (not arrays)
const SINGLE_OBJ_CONFIGS = ['init_player.json'];

const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.xlsx'));

for (const file of files) {
  const filePath = path.join(DATA_DIR, file);
  const workbook = XLSX.readFile(filePath);

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { defval: null });

    const data = json.filter(row => {
      const values = Object.values(row).filter(v => v !== null && v !== '');
      return values.length > 0;
    });

    const outName = sheetName.endsWith('.json') ? sheetName : `${sheetName}.json`;
    const outPath = path.join(CONFIG_DIR, outName);

    // If this config is a single object, take first row only
    const output = SINGLE_OBJ_CONFIGS.includes(outName) ? (data[0] || {}) : data;

    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
    console.log(`  ${file} / ${sheetName} → ${outPath} (${Array.isArray(output) ? output.length : 1} rows)`);
  }
}

console.log(`\nDone. Converted ${files.length} file(s).`);
