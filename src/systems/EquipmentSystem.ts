import { GameState } from '../core/GameState';
import { bus } from '../core/EventBus';

export type EquipSlot = 'weapon' | 'armor' | 'accessory' | 'tool';

export function equip(gs: GameState, slot: EquipSlot, itemId: string): boolean {
  // Check item exists in inventory
  const owned = gs.items[itemId] || 0;
  if (owned <= 0) return false;

  // Unequip current
  const current = gs.equipment[slot];
  if (current) {
    gs.items[current] = (gs.items[current] || 0) + 1;
  }

  // Equip new
  gs.equipment[slot] = itemId;
  gs.items[itemId]--;

  bus.emit('equipment:changed', { slot, itemId, previous: current });
  return true;
}

export function unequip(gs: GameState, slot: EquipSlot): boolean {
  const current = gs.equipment[slot];
  if (!current) return false;

  gs.items[current] = (gs.items[current] || 0) + 1;
  gs.equipment[slot] = null;

  bus.emit('equipment:changed', { slot, itemId: null, previous: current });
  return true;
}

export function getEquipBonus(gs: GameState): Record<string, number> {
  const bonuses: Record<string, number> = {};

  for (const [slot, itemId] of Object.entries(gs.equipment)) {
    if (!itemId) continue;
    // Get quality bonus from instance
    const instances = gs.itemInstances[itemId];
    if (instances && instances.length > 0) {
      // Use best quality instance
      // Simple: just add attack bonus based on slot
      if (slot === 'weapon') bonuses['attack'] = (bonuses['attack'] || 0) + 5;
      else if (slot === 'armor') bonuses['defense'] = (bonuses['defense'] || 0) + 3;
    }
  }

  return bonuses;
}
