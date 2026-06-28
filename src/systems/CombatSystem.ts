import { GameState, EnemyState } from '../core/GameState';
import { bus } from '../core/EventBus';
import { getEquipBonus } from './EquipmentSystem';
import { skillLevelExp } from './CultivationSystem';

import enemiesRaw from '../config/enemies.json';
import techniquesRaw from '../config/battle_skill.json';

interface EnemyConfig {
  id: string; name: string; hp: number; maxHp: number;
  attack: number; defense: number;
  hit: number; dodge: number; crit: number; speed: number;
  skills: { id: string; name: string; damage: number; cast_time: number }[];
  loot: { item_id: string; qty: number; chance: number }[];
}

interface TechniqueConfig {
  id: string; name: string; type: string;
  unlock_realm: string | null;
  effects: { attr: string; op: string; value: number }[];
  skills: { id: string; name: string; damage: number; cast_time: number; mp_cost: number }[];
}

const enemies = enemiesRaw as any as EnemyConfig[];
const techniques = techniquesRaw as any as TechniqueConfig[];

export function getEnemyConfig(id: string): EnemyConfig | undefined {
  return enemies.find(e => e.id === id);
}

export function getTechnique(id: string): TechniqueConfig | undefined {
  return techniques.find(t => t.id === id);
}

export function spawnEnemy(enemyId: string): EnemyState | null {
  const cfg = getEnemyConfig(enemyId);
  if (!cfg) return null;
  return {
    id: cfg.id,
    name: cfg.name,
    hp: cfg.hp,
    maxHp: cfg.maxHp,
    attack: cfg.attack,
    defense: cfg.defense,
    hit: cfg.hit,
    dodge: cfg.dodge,
    crit: cfg.crit,
    speed: cfg.speed,
    skills: cfg.skills.map(s => ({ ...s })),
    combatProgress: 0,
    currentSkillIndex: 0,
  };
}

export function advanceCombat(gs: GameState, dt: number) {
  const action = gs.currentAction;
  if (!action || action.type !== 'combat') return;

  // Ensure enemy exists
  if (!gs.combat?.enemy) return;

  const enemy = gs.combat.enemy;

  // Advance player combat bar
  const playerSpeed = 0.02 * (1 + (gs.skills['combat']?.level || 1) * 0.05);
  action.progress += playerSpeed * dt;

  // Player attack
  while (action.progress >= 1) {
    action.progress -= 1;
    playerAttack(gs, enemy);
    if (enemy.hp <= 0) {
      onEnemyDefeated(gs, enemy);
      return;
    }
  }

  // Advance enemy combat bar
  enemy.combatProgress += enemy.speed * dt;
  while (enemy.combatProgress >= 1) {
    enemy.combatProgress -= 1;
    enemyAttack(gs, enemy);
    if (gs.player.hp <= 0) {
      onPlayerDefeated(gs);
      return;
    }
  }
}

function playerAttack(gs: GameState, enemy: EnemyState) {
  const bonuses = getEquipBonus(gs);
  const baseAtk = 10 + (bonuses['attack'] || 0);
  const tech = getTechnique(gs.currentTechniqueId);

  // Use player technique skill
  const skill = tech?.skills[gs.combat?.playerSkillIndex ?? 0];
  const dmg = skill ? skill.damage + baseAtk : baseAtk;

  // Hit check
  const hitChance = 0.9 + (gs.skills['combat']?.level || 1) * 0.01;
  if (Math.random() > hitChance - enemy.dodge) return; // Miss

  // Crit check
  const isCrit = Math.random() < 0.05;
  const finalDmg = Math.max(1, isCrit ? dmg * 1.5 : dmg - enemy.defense);

  enemy.hp = Math.max(0, enemy.hp - finalDmg);

  // Cycle to next skill
  if (tech?.skills && tech.skills.length > 1) {
    if (!gs.combat) gs.combat = { enemy, playerSkillIndex: 0 };
    gs.combat.playerSkillIndex = (gs.combat.playerSkillIndex + 1) % tech.skills.length;
  }
}

function enemyAttack(gs: GameState, enemy: EnemyState) {
  const skill = enemy.skills[enemy.currentSkillIndex];
  const dmg = skill ? skill.damage + enemy.attack : enemy.attack;

  // Simple hit check
  if (Math.random() > enemy.hit) return;

  const finalDmg = Math.max(1, dmg);
  gs.player.hp = Math.max(0, gs.player.hp - finalDmg);

  // Cycle enemy skill
  enemy.currentSkillIndex = (enemy.currentSkillIndex + 1) % enemy.skills.length;
}

function onEnemyDefeated(gs: GameState, enemy: EnemyState) {
  const cfg = getEnemyConfig(enemy.id);
  if (!cfg) return;

  // Loot
  const drops: { itemId: string; qty: number }[] = [];
  for (const loot of cfg.loot) {
    if (Math.random() < loot.chance) {
      gs.items[loot.item_id] = (gs.items[loot.item_id] || 0) + loot.qty;
      drops.push({ itemId: loot.item_id, qty: loot.qty });
    }
  }

  // Skill exp
  const skill = gs.skills['combat'];
  if (skill) {
    skill.exp += 10;
    while (skill.exp >= skillLevelExp(skill.level)) {
      skill.exp -= skillLevelExp(skill.level);
      skill.level++;
      bus.emit('skill:levelup', { skillId: 'combat', level: skill.level });
    }
  }

  // Discover enemy
  if (!gs.discovered.enemies.includes(enemy.id)) {
    gs.discovered.enemies.push(enemy.id);
  }

  // Respawn
  const newEnemy = spawnEnemy(enemy.id);
  gs.combat = { enemy: newEnemy!, playerSkillIndex: 0 };

  bus.emit('combat:enemy_defeated', { enemyId: enemy.id, drops });
}

function onPlayerDefeated(gs: GameState) {
  gs.player.hp = gs.player.maxHp;
  gs.currentAction = {
    type: 'cultivate',
    skillIds: ['breathing'],
    locationId: 'wild_clearing',
    startedAt: Date.now(),
    progress: 0,
    progressSpeed: 1 / 3,
  };
  gs.combat = undefined;
  bus.emit('combat:player_defeated');
}

export function resolveCombatOffline(gs: GameState, completions: number) {
  const action = gs.currentAction;
  if (!action || action.type !== 'combat') return;

  // Use the enemy from the combat state if available, otherwise from spawn
  const enemyId = gs.combat?.enemy.id;
  if (!enemyId) return;

  const cfg = getEnemyConfig(enemyId);
  if (!cfg) return;

  for (let i = 0; i < completions; i++) {
    for (const loot of cfg.loot) {
      if (Math.random() < loot.chance) {
        gs.items[loot.item_id] = (gs.items[loot.item_id] || 0) + loot.qty;
      }
    }

    const skill = gs.skills['combat'];
    if (skill) {
      skill.exp += 10;
      while (skill.exp >= skillLevelExp(skill.level)) {
        skill.exp -= skillLevelExp(skill.level);
        skill.level++;
      }
    }
  }

  if (!gs.discovered.enemies.includes(cfg.id)) {
    gs.discovered.enemies.push(cfg.id);
  }

  const enemy = spawnEnemy(cfg.id);
  if (enemy) {
    gs.combat = { enemy, playerSkillIndex: 0 };
  }
}
