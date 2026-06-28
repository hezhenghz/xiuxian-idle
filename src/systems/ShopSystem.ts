import { GameState } from '../core/GameState';
import { bus } from '../core/EventBus';
import { addTechnique } from './GongfaSystem';

import shopsRaw from '../config/shops.json';

interface ShopItem {
  id: string; qty: number; price: number; type: 'item' | 'technique';
}

interface ShopConfig {
  id: string; name: string; zone_unlock: string;
  items: ShopItem[];
}

const shops = shopsRaw as any as ShopConfig[];

export function getShopsForZone(zoneId: string): ShopConfig[] {
  return shops.filter(s => s.zone_unlock === zoneId);
}

export function buyItem(gs: GameState, shopId: string, itemId: string): { ok: boolean; reason?: string } {
  const shop = shops.find(s => s.id === shopId);
  if (!shop) return { ok: false, reason: '商店不存在' };

  const item = shop.items.find(i => i.id === itemId);
  if (!item) return { ok: false, reason: '商品不存在' };

  const spiritStones = gs.resources['spirit_stone'] || 0;
  if (spiritStones < item.price) {
    return { ok: false, reason: '灵石不足' };
  }

  gs.resources['spirit_stone'] = spiritStones - item.price;

  if (item.type === 'technique') {
    addTechnique(gs, item.id);
  } else {
    gs.items[item.id] = (gs.items[item.id] || 0) + item.qty;
  }

  bus.emit('shop:bought', { shopId, itemId });
  return { ok: true };
}

export function sellItem(gs: GameState, itemId: string, qty: number, sellPrice: number): { ok: boolean; reason?: string } {
  const owned = gs.items[itemId] || 0;
  if (owned < qty) return { ok: false, reason: '物品不足' };

  gs.items[itemId] = owned - qty;
  gs.resources['spirit_stone'] = (gs.resources['spirit_stone'] || 0) + sellPrice * qty;

  bus.emit('shop:sold', { itemId, qty, price: sellPrice });
  return { ok: true };
}

export function getSellPrice(_itemId: string): number {
  // Simplified: flat sell price
  return 2;
}
