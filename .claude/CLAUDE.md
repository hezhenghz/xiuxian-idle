# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

Tradeoff: These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

Touch only what you must. Clean up only your own mess.

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

These guidelines are working if: fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## 5. 宪法：表格驱动数据

**代码中禁止出现任何游戏数值字面量。** 所有游戏数值必须从配置表（`src/config/*.json`）中读取。

- 每当你准备在代码中写一个数字时，停下来问用户：这个值应该从哪个表读取。
- 允许的例外：纯工程常量（如 `requestAnimationFrame` 间隔、`localStorage` key 名），以及 `0`、`1` 作为初始值/数组索引/数学恒等式。
- 开发常识性默认值（如初始技能等级 `level: 1`）属于构造默认值，不需配表。
- 标识符字符串（如 `'cultivation'`、`'cultivate'`）属于资源/类型 key，不属于数值，无需提取。

## 6. 表格维护规范

### 6.1 表格即数据源

- **Excel（`data/*.xlsx`）是唯一数据源**。所有游戏配置在 Excel 中维护。
- 用户修改 Excel → 运行 `data/convert.bat` → 生成 `src/config/*.json` → 代码读取 JSON。
- Claude **禁止运行任何脚本**（npm/bat/node，含 convert、seed 等）。转换由用户手动执行。
- Claude **禁止填写或覆盖 Excel 中的任何数据**。所有内容由用户手填。Claude 只能增删列、改列名。
- Claude **禁止新增任何数据表格**。表不够用时先问用户。
- 因配表缺失导致游戏报错时，**只告知用户缺什么数据，不自行填值修复**。

### 6.2 表格行结构

- **第 1 行**：中文说明行，给人看的，不参与转表。不得删除或覆盖。
- **第 2 行**：英文表头行（字段名），参与转表。列名以英文字母开头。
- **数据行**：从第 3 行开始。

### 6.3 辅助列

- 首行有中文说明、第二行无英文表头的列为辅助列（如备注、计算中间列），不得删除。辅助列不参与转表。

### 6.4 加列 / 删列 / 改列名 / 改类型

1. 用户或 Claude 提出变更需求
2. 进入 Plan 模式讨论：字段作用、英文字段名（须符合术语表 `term_en`）
3. 用户去 `data/*.xlsx` 中添加/修改列（中文说明行 + 英文表头行）
4. 用户运行 `data/convert.bat` 生成新 JSON
5. Claude 修改 `src/` 下的 TypeScript 代码以读取新字段
6. Claude 验证转表后的 JSON 数据是否被代码正确读取

### 6.5 枚举值：中文填表，自动转英文

为提高 Excel 可读性，枚举类字段在 Excel 中填**中文**，转换时自动翻译为代码使用的英文。

**枚举映射表**：`data/enum_map.json`，按列名分类：

```json
{
  "location_type": {
    "打坐": "cultivate",
    "采集": "gather"
  },
  "skill_type": {
    "吐纳": "breathing"
  }
}
```

- 顶层 key = Excel 英文列名，内层 key = 中文，value = 英文。
- `convert.mjs` 在转换时自动查表翻译。JSON 输出为英文，代码不受影响。
- 用户说"配新增枚举值"时，意思是在 `enum_map.json` 中追加条目。
- 新增枚举列时，同步在 `enum_map.json` 中添加对应分类。

### 6.6 多组列（_N 后缀）

当一张表需要配置多组同结构数据（如一个地点有 4 组行为），使用 `_N` 后缀：

```
location_type_1, action_skill_id_1, ..., unlock_exploration_1
location_type_2, action_skill_id_2, ..., unlock_exploration_2
location_type_3, ...
location_type_4, ...
```

- N 从 1 开始，连续编号。
- 代码侧用 `for (let i = 1; i <= N; i++)` 循环读取。
- 留空的组（`location_type_N` 为空）不生成数据。

### 6.7 ID 字段处理

- Excel 中 ID 列填数字（如 `1`、`2`），`convert.mjs` 产出 JSON 中为数字类型。
- 代码在 import 后须做 ID 归一化：`(raw as any[]).map(r => ({ ...r, id: String(r.id) }))`。
- 所有 ID 比较使用字符串 `===`，避免类型不匹配。

---

## 7. 术语管理

术语表位于 `data/terminology.xlsx`，所有代码中的变量名、函数名、类型名、JSON 字段名和注释必须遵循术语表。

### 术语确认流程

UserPromptSubmit hook 会自动检测用户输入中重复出现（≥3 次）的未收录中文词汇，并注入提醒。看到提醒后：

1. 向用户确认：中文标准写法、英文翻译、中文别名
2. 由用户在 `data/terminology.xlsx` 中填入：
   - `term_zh`：正式中文术语
   - `term_en`：英文翻译（将用作代码标识符和 JSON 字段名）
   - `aliases_zh`：相近说法（分号分隔）
   - `source`：来源（如功能模块名）
   - `notes`：使用注意事项（如 "Avoid: xxx"）
3. 用户填完后运行 `data/convert.bat` 生成 `src/config/terms.json`
4. 后续所有代码中的标识符和注释统一使用 `term_en`

**严禁擅自在术语表中新增任何术语数据行。** 术语的 term_zh 和 term_en 必须经过用户亲自确认。

### 代码命名规范

- **标识符**（变量、函数、类型、JSON 字段）：使用术语表 `term_en`。例：`realmId`（非 `jingjieId`）、`cultivation`（非 `xiuwei`）
- **注释中的中文**：使用术语表 `term_zh` 的标准写法。例：`// 检查修为是否满足突破需求`（非 `// 检查经验值是否满足突破需求`）
- **禁止混用**：同一概念不得在代码中同时使用拼音命名和标准英文命名
- **新增类型/接口/字段**：其英文名如果对应某个游戏术语，必须查阅术语表确认 `term_en`

### 术语表维护

- **新增术语**：无破坏性影响，仅要求后续代码遵循。需用户确认后由用户填入。
- **修改 `term_en`**：属于破坏性变更，可能影响存档 JSON 字段名、配置表表头、代码标识符。须充分评估影响范围。
- **修改 `aliases_zh`**：影响检测 hook 的匹配，可随时补充。
- 修改术语表后必须运行 `data/convert.bat`。