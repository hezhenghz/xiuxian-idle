import { GameState } from '../core/GameState';
import { bus } from '../core/EventBus';

import realmRaw from '../config/realm.json';
import levelRaw from '../config/level.json';

interface Realm {
  id: string; name: string;
  required_skills: { id: string; level: number }[];
  required_items: { id: string; qty: number }[];
  optional_items: { id: string; qty: number }[];
  base_success_rate: number;
  failure_exp_loss_pct: number;
}

interface Level {
  id: string; name: string; realm_id: string; layer: number;
  cultivation_needed: number;
  base_hp: number;
  base_mp: number;
  item_cost: string;
}

const realms = (realmRaw as any[]).map(r => ({ ...r, id: String(r.id) })) as Realm[];
const levels = (levelRaw as any[]).map(l => ({ ...l, id: String(l.id), realm_id: String(l.realm_id) })) as Level[];

function parseItemCost(raw: string | null): { id: string; qty: number }[] {
  if (!raw) return [];
  return raw.split('|').map(part => {
    const [id, qty] = part.split(',');
    return { id: id.trim(), qty: parseInt(qty) || 0 };
  }).filter(i => i.id && i.qty > 0);
}

export function getLevel(id: string): Level | undefined {
  return levels.find(l => l.id === id);
}

export function getRealm(id: string): Realm | undefined {
  return realms.find(r => r.id === id);
}

export function getNextLevel(currentId: string): Level | undefined {
  const current = getLevel(currentId);
  if (!current) return undefined;
  return levels.find(l =>
    l.realm_id === current.realm_id && l.layer === current.layer + 1
  );
}

export function getNextRealmFirstLevel(currentRealmId: string): Level | undefined {
  const realm = getRealm(currentRealmId);
  if (!realm) return undefined;
  const nextRealm = realms.find(r => r.id > realm.id);
  if (!nextRealm) return undefined;
  return levels.find(l => l.realm_id === nextRealm.id && l.layer === 0);
}

export function canBreakthroughLevel(gs: GameState): {
  can: boolean; reason?: string; cost: { id: string; qty: number }[];
} {
  const current = getLevel(gs.player.realmId);
  if (!current) return { can: false, reason: '未知境界', cost: [] };

  const cost = parseItemCost(current.item_cost);

  if (gs.resources['cultivation'] < current.cultivation_needed) {
    return { can: false, reason: '修为不足', cost: cost };
  }
  for (const item of cost) {
    const owned = gs.items[item.id] || 0;
    if (owned < item.qty) {
      return { can: false, reason: `缺少 ${item.id}`, cost: cost };
    }
  }

  return { can: true, cost: cost };
}

export function breakthroughLevel(gs: GameState): { success: boolean; newId?: string } {
  const result = canBreakthroughLevel(gs);
  if (!result.can) return { success: false };

  const current = getLevel(gs.player.realmId)!;

  gs.resources['cultivation'] -= current.cultivation_needed;

  for (const item of parseItemCost(current.item_cost)) {
    if (gs.resources[item.id] !== undefined) {
      gs.resources[item.id] -= item.qty;
    } else {
      gs.items[item.id] = (gs.items[item.id] || 0) - item.qty;
    }
  }

  const next = getNextLevel(current.id);
  if (next) {
    applyRealmStats(gs, next);
    gs.player.realmId = next.id;
    bus.emit('realm:changed', { from: current.id, to: next.id });
    return { success: true, newId: next.id };
  }

  return { success: true };
}

export function canBreakthroughRealm(gs: GameState): {
  can: boolean; realm?: Realm; reason?: string;
  successRate?: number;
} {
  const currentLevel = getLevel(gs.player.realmId);
  if (!currentLevel) return { can: false, reason: '未知境界' };

  const currentRealm = getRealm(currentLevel.realm_id);
  if (!currentRealm) return { can: false, reason: '未知境界' };

  const lastLevel = levels
    .filter(l => l.realm_id === currentRealm.id)
    .reduce((a, b) => (a.layer > b.layer ? a : b));

  if (currentLevel.id !== lastLevel.id) {
    return { can: false, reason: '尚未达到当前境界圆满' };
  }

  const nextRealm = realms.find(r => r.id > currentRealm.id);
  if (!nextRealm) return { can: false, reason: '已至最高境界' };

  for (const req of nextRealm.required_skills || []) {
    const skill = gs.skills[req.id];
    if (!skill || skill.level < req.level) {
      return { can: false, reason: `技能 ${req.id} 不足 Lv.${req.level}`, realm: nextRealm };
    }
  }

  for (const req of nextRealm.required_items || []) {
    const owned = gs.items[req.id] || 0;
    if (owned < req.qty) {
      return { can: false, reason: `缺少 ${req.id} x${req.qty}`, realm: nextRealm };
    }
  }

  let rate = nextRealm.base_success_rate;
  for (const opt of nextRealm.optional_items || []) {
    const owned = gs.items[opt.id] || 0;
    if (owned >= opt.qty) rate += 10;
  }
  rate = Math.min(rate, 95);

  return { can: true, realm: nextRealm, successRate: rate };
}

export function breakthroughRealm(gs: GameState): {
  success: boolean; realm?: Realm; newId?: string;
  loss?: { resources?: Record<string, number>; items?: Record<string, number> };
} {
  const check = canBreakthroughRealm(gs);
  if (!check.can || !check.realm) return { success: false };

  for (const req of check.realm.required_items || []) {
    gs.items[req.id] -= req.qty;
  }
  for (const opt of check.realm.optional_items || []) {
    if ((gs.items[opt.id] || 0) >= opt.qty) {
      gs.items[opt.id] -= opt.qty;
    }
  }

  const roll = Math.random() * 100;
  if (roll < check.successRate!) {
    const nextLevel = getNextRealmFirstLevel(check.realm.id);
    if (nextLevel) {
      applyRealmStats(gs, nextLevel);
      gs.player.realmId = nextLevel.id;
      bus.emit('realm:changed', { to: nextLevel.id });
      return { success: true, realm: check.realm, newId: nextLevel.id };
    }
    return { success: true, realm: check.realm };
  }

  const lossPct = check.realm.failure_exp_loss_pct;
  const cultivationLoss = Math.floor(gs.resources['cultivation'] * (lossPct / 100));
  gs.resources['cultivation'] -= cultivationLoss;

  bus.emit('realm:breakthrough_failed', check.realm);
  return {
    success: false,
    realm: check.realm,
    loss: {
      resources: { cultivation: cultivationLoss },
      items: Object.fromEntries((check.realm.required_items || []).map(i => [i.id, i.qty])),
    },
  };
}

export function applyRealmStats(gs: GameState, level: Level) {
  gs.player.hp = level.base_hp;
  gs.player.maxHp = level.base_hp;
  gs.player.mp = level.base_mp;
  gs.player.maxMp = level.base_mp;
}
