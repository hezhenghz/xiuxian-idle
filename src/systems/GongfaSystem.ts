import { GameState } from '../core/GameState';
import { bus } from '../core/EventBus';

import techniquesRaw from '../config/battle_skill.json';

interface TechniqueConfig {
  id: string; name: string; type: string;
  unlock_realm: string | null;
  effects: { attr: string; op: string; value: number }[];
  skills: { id: string; name: string; damage: number; cast_time: number; mp_cost: number }[];
}

const techniques = techniquesRaw as any as TechniqueConfig[];

export function getAllTechniques(): TechniqueConfig[] { return techniques; }

export function getTechnique(id: string): TechniqueConfig | undefined {
  return techniques.find(t => t.id === id);
}

export function hasTechnique(gs: GameState, id: string): boolean {
  return gs.techniques.includes(id);
}

export function addTechnique(gs: GameState, id: string): boolean {
  if (gs.techniques.includes(id)) return false;
  gs.techniques.push(id);
  bus.emit('technique:added', { id });
  return true;
}

export function equipTechnique(gs: GameState, id: string): boolean {
  if (!gs.techniques.includes(id)) return false;
  gs.currentTechniqueId = id;
  bus.emit('technique:equipped', { id });
  return true;
}

export function getTechEffects(gs: GameState): Record<string, number> {
  const result: Record<string, number> = {};
  for (const techId of gs.techniques) {
    const tech = getTechnique(techId);
    if (!tech) continue;
    for (const effect of tech.effects) {
      const key = effect.attr;
      const val = result[key] || 0;
      if (effect.op === 'add') {
        result[key] = val + effect.value;
      } else if (effect.op === 'mul') {
        result[key] = val === 0 ? effect.value : val * effect.value;
      }
    }
  }
  return result;
}
