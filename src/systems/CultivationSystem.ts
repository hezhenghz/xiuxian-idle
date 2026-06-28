import { GameState } from '../core/GameState';
import { bus } from '../core/EventBus';
import lifeSkillRaw from '../config/life_skill.json';
import lifeSkillLevelupRaw from '../config/life_skill_levelup.json';

// life_skill 查找表（key = skill_id 字符串）
const lifeSkillMap = new Map<string, any>();
for (const s of lifeSkillRaw as any[]) {
  lifeSkillMap.set(String(s.skill_id), s);
}

// 技能升级经验查找表（key = 当前等级，value = 升至下一级所需经验）
const levelExpMap = new Map<number, number>();
for (const row of lifeSkillLevelupRaw as any[]) {
  if (row.level != null && row.exp != null) {
    levelExpMap.set(Number(row.level), Number(row.exp));
  }
}

export function initCultivation(gs: GameState) {
  bus.on('action:complete', (action) => {
    if (action.type !== 'cultivate') return;
    processCultivation(gs, action);
  });
}

function processCultivation(gs: GameState, action: any) {
  const skillId = action.skillIds?.[0];
  if (!skillId) return;

  // 修为获得量 = 地点配置的 action_value
  const cultivationGain = action.value || 0;
  gs.resources['cultivation'] = (gs.resources['cultivation'] || 0) + cultivationGain;

  // 技能经验 = life_skill 表 exp_get 列
  const lifeSkillCfg = lifeSkillMap.get(skillId);
  const expGain = lifeSkillCfg?.exp_get || 0;

  const skill = gs.skills[skillId];
  if (skill && expGain > 0) {
    skill.exp += expGain;
    const expNeeded = levelExpMap.get(skill.level) ?? Infinity;
    while (skill.exp >= expNeeded) {
      skill.exp -= expNeeded;
      skill.level++;
      bus.emit('skill:levelup', { skillId, level: skill.level });
    }
  }
}

// getSkillLevelProgress 供 UI 显示技能经验条
export function getSkillLevelProgress(skill: { level: number; exp: number }): number {
  const needed = levelExpMap.get(skill.level);
  if (!needed || needed <= 0) return 1;
  return skill.exp / needed;
}

// 技能升级所需经验（从 life_skill_levelup 配表读取）
export function skillLevelExp(level: number): number {
  return levelExpMap.get(level) ?? Infinity;
}
