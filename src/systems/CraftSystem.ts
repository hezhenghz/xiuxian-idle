import { GameState } from '../core/GameState';
import { bus } from '../core/EventBus';
import { skillLevelExp } from './CultivationSystem';

import recipesRaw from '../config/recipes.json';
import qualityTiersRaw from '../config/quality_tiers.json';

interface Recipe {
  id: string; name: string; tag: string; skill_id: string;
  time_per_cycle: number;
  skill_exp_per_cycle: number;
  inputs: { id: string; qty: number }[];
  output: { id: string; qty: number };
  base_success_rate: number;
  quality_pool: string;
}

interface QualityTier {
  pool_id: string; tier_id: string; name: string; multiplier: number; weight: number;
}

const recipes = recipesRaw as any as Recipe[];
const qualityPools = qualityTiersRaw as any as QualityTier[];

function getQualityPool(poolId: string): QualityTier[] {
  return qualityPools.filter(q => q.pool_id === poolId);
}

export function getRecipes(): Recipe[] { return recipes; }
export function getRecipe(id: string): Recipe | undefined {
  return recipes.find(r => r.id === id);
}

export function canCraft(recipe: Recipe, gs: GameState): { can: boolean; reason?: string } {
  for (const input of recipe.inputs) {
    const owned = gs.items[input.id] || 0;
    if (owned < input.qty) {
      return { can: false, reason: `缺少 ${input.id} x${input.qty}` };
    }
  }
  return { can: true };
}

export function craft(gs: GameState, recipeId: string): { success: boolean; quality?: QualityTier } {
  const recipe = getRecipe(recipeId);
  if (!recipe) return { success: false };

  // Check inputs
  const check = canCraft(recipe, gs);
  if (!check.can) return { success: false };

  // Consume inputs
  for (const input of recipe.inputs) {
    gs.items[input.id] -= input.qty;
  }

  // Roll success
  const skill = gs.skills[recipe.skill_id];
  const skillBonus = skill ? (skill.level - 1) * 0.02 : 0;
  const successRate = Math.min(recipe.base_success_rate + skillBonus, 0.95);

  if (Math.random() > successRate) {
    return { success: false };
  }

  // Roll quality
  const pool = getQualityPool(recipe.quality_pool);
  const quality = weightedPick(pool);

  // Produce output
  const itemId = recipe.output.id;
  const qty = recipe.output.qty;
  gs.items[itemId] = (gs.items[itemId] || 0) + qty;

  // Store quality instance if equipment type
  if (quality && recipe.quality_pool) {
    if (!gs.itemInstances[itemId]) gs.itemInstances[itemId] = [];
    gs.itemInstances[itemId].push({ id: itemId, quantity: 1, quality: quality.tier_id });
  }

  // Skill exp
  if (skill) {
    skill.exp += recipe.skill_exp_per_cycle;
    while (skill.exp >= skillLevelExp(skill.level)) {
      skill.exp -= skillLevelExp(skill.level);
      skill.level++;
      bus.emit('skill:levelup', { skillId: recipe.skill_id, level: skill.level });
    }
  }

  return { success: true, quality };
}

function weightedPick<T extends { weight: number }>(items: T[]): T | undefined {
  const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[0];
}
