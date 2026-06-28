import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATA_DIR = path.join(__dirname);                              // data/
const CONFIG_DIR = path.join(__dirname, '..', 'src', 'config');     // ../src/config

// 读取枚举映射表（中文→英文）
const ENUM_MAP_PATH = path.join(__dirname, 'enum_map.json');
let enumMap = {};
if (fs.existsSync(ENUM_MAP_PATH)) {
  enumMap = JSON.parse(fs.readFileSync(ENUM_MAP_PATH, 'utf-8'));
}

const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.xlsx'));

for (const file of files) {
  const filePath = path.join(DATA_DIR, file);
  const workbook = XLSX.readFile(filePath);

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    // 读取所有行（数组的数组）
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    if (rows.length < 2) {
      console.log(`  SKIP ${file}/${sheetName} — 不足 2 行（无数据）`);
      continue;
    }

    const descRow = rows[0];   // Row 0: 中文说明（不参与转表）
    const headerRow = rows[1]; // Row 1: 英文表头

    // 找出有效列：Row 1 有非空值且以英文字母开头
    const validCols = [];
    for (let i = 0; i < headerRow.length; i++) {
      const h = headerRow[i];
      if (h !== null && h !== '' && /^[a-zA-Z]/.test(String(h))) {
        validCols.push({ index: i, key: String(h) });
      }
    }

    // 从 Row 2 开始构建数据
    const data = [];
    for (let r = 2; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      const obj = {};
      let hasValue = false;
      for (const { index, key } of validCols) {
        let v = row[index] !== undefined ? row[index] : null;
        // 枚举翻译：如果该列在枚举映射表中，尝试中文→英文翻译
        if (v != null && enumMap[key]) {
          v = enumMap[key][String(v)] ?? v;
        }
        obj[key] = v;
        if (v !== null && v !== '') hasValue = true;
      }
      if (hasValue) data.push(obj);
    }

    const outName = sheetName.endsWith('.json') ? sheetName : `${sheetName}.json`;
    const outPath = path.join(CONFIG_DIR, outName);

    fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
    console.log(`  ${file} / ${sheetName} → ${outPath} (${data.length} rows)`);
  }
}

console.log(`\nDone. Converted ${files.length} file(s).`);
console.log('\n按任意键退出...');
