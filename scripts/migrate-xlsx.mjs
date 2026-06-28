// 一次性脚本：给 data/ 下所有 xlsx 的每个 sheet 顶部插入中文说明行（Row 0）
// 用法：node scripts/migrate-xlsx.mjs
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const DATA_DIR = 'data';

const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.xlsx'));

for (const file of files) {
  const filePath = path.join(DATA_DIR, file);
  const workbook = XLSX.readFile(filePath);
  let changed = false;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    if (rows.length === 0) continue;

    // 检测是否已经迁移过（Row 0 全为空或全为中文，且 Row 1 存在英文表头）
    const row0 = rows[0] || [];
    const row1 = rows[1] || [];
    const row0HasEnglish = row0.some(v => v && /^[a-zA-Z]/.test(String(v)));
    const row1HasEnglish = row1.some(v => v && /^[a-zA-Z]/.test(String(v)));

    if (!row0HasEnglish && row1HasEnglish) {
      console.log(`  SKIP ${file}/${sheetName} — 已迁移过`);
      continue;
    }

    // 计算最大列数
    const maxCols = Math.max(...rows.map(r => r.length), 0);

    // 在顶部插入空中文说明行
    const newRow0 = new Array(maxCols).fill(null);
    rows.unshift(newRow0);

    // 重建 sheet
    const newSheet = XLSX.utils.aoa_to_sheet(rows);

    // 保留列宽等属性
    if (sheet['!cols']) newSheet['!cols'] = sheet['!cols'];
    if (sheet['!merges']) {
      // 合并单元格的行号也要 +1（向下平移）
      newSheet['!merges'] = sheet['!merges'].map(m => ({
        ...m,
        s: { ...m.s, r: m.s.r + 1 },
        e: { ...m.e, r: m.e.r + 1 },
      }));
    }

    workbook.Sheets[sheetName] = newSheet;
    changed = true;
    console.log(`  MIGRATED ${file}/${sheetName} — 插入中文说明行 (${rows.length - 1} → ${rows.length} 行)`);
  }

  if (changed) {
    XLSX.writeFile(workbook, filePath);
    console.log(`  SAVED ${file}`);
  }
}

console.log(`\nDone. Processed ${files.length} file(s).`);
