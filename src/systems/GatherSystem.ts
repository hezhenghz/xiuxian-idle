import { GameState } from '../core/GameState';
import { bus } from '../core/EventBus';
import { skillLevelExp } from './CultivationSystem';

import gatherTablesRaw from '../config/life_skill.json';

interface LifeSkillEntry {
  skill_id: string;
  time_per_cycle: number;
  skill_exp_per_cycle: number;
  output_item_id: string;
  output_qty: number;
  output_weight: number;
}

const lifeSkills = gatherTablesRaw as any as LifeSkillEntry[];

export function initGather(gs: GameState) {
  bus.on('action:complete', (action) => {
    if (action.type !== 'gather') return;
    processGather(gs, action);
  });
}

function processGather(gs: GameState, action: any) {
  for (const skillId of action.skillIds) {
    const table = lifeSkills.find(t => t.skill_id === skillId);
    if (!table) continue;

    const skill = gs.skills[skillId];
    const skillBonus = skill ? 1 + (skill.level - 1) * 0.1 : 1;

    const qty = Math.floor(table.output_qty * skillBonus);
    const existing = gs.items[table.output_item_id] || 0;

    if (existing + qty > 50) {
      bus.emit('inventory:full', { itemId: table.output_item_id });
      continue;
    }

    gs.items[table.output_item_id] = existing + qty;

    if (!gs.discovered.items.includes(table.output_item_id)) {
      gs.discovered.items.push(table.output_item_id);
    }

    if (skill) {
      skill.exp += table.skill_exp_per_cycle;
      while (skill.exp >= skillLevelExp(skill.level)) {
        skill.exp -= skillLevelExp(skill.level);
        skill.level++;
        bus.emit('skill:levelup', { skillId, level: skill.level });
      }
    }
  }
}
