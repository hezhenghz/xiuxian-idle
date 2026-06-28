import { GameState, ActionTag } from '../core/GameState';
import { bus } from '../core/EventBus';
import { getLevel } from './RealmSystem';
import { spawnEnemy } from './CombatSystem';

import landRaw from '../config/land.json';
import mapRaw from '../config/map.json';
import locationsRaw from '../config/locations.json';

export interface LandConfig { id: string; name: string; map_list: string; }
export interface MapConfig { id: string; name: string; location_list: string; unlock_realm: string | null; }
export interface LocationAction { tag: ActionTag; skill_id: string; time_per_cycle: number; value?: number; unlock_exploration: number; }
export interface Location { id: string; name: string; actions: LocationAction[]; exploration_max: number; enemy_id?: string; }

const lands = (landRaw as any[]).map(l => ({ ...l, id: String(l.id) })) as LandConfig[];
const maps = (mapRaw as any[]).map(m => ({
  ...m, id: String(m.id),
  unlock_realm: m.unlock_realm != null ? String(m.unlock_realm) : null,
})) as MapConfig[];
const locations = (locationsRaw as any[]).map(l => {
  const actions: LocationAction[] = [];
  for (let i = 1; i <= 4; i++) {
    const typeVal = l[`location_type_${i}`];
    const skillVal = l[`action_skill_id_${i}`];
    const timeVal = l[`action_time_per_cycle_${i}`];
    const valueVal = l[`location_value_${i}`];
    const unlockVal = l[`unlock_exploration_${i}`];
    if (typeVal && skillVal != null && timeVal != null) {
      actions.push({
        tag: typeVal,
        skill_id: String(skillVal),
        time_per_cycle: Number(timeVal),
        value: valueVal != null ? Number(valueVal) : undefined,
        unlock_exploration: unlockVal != null ? Number(unlockVal) : 0,
      });
    }
  }
  return {
    id: String(l.id), name: l.name,
    actions,
    exploration_max: l.exploration_max != null ? Number(l.exploration_max) : 0,
    enemy_id: l.enemy_id || '',
  } as Location;
});

function parseIdList(raw: any): string[] {
  if (!raw) return [];
  if (typeof raw === 'string') return raw.split('|').map(s => s.trim()).filter(Boolean);
  return [String(raw)];
}

export function getLands(): LandConfig[] { return lands; }

export function getMaps(landId: string): MapConfig[] {
  const land = lands.find(l => l.id === landId);
  if (!land) return [];
  const ids = parseIdList(land.map_list);
  return ids.map(id => maps.find(m => m.id === id)).filter(Boolean) as MapConfig[];
}

export function getLocations(mapId: string): Location[] {
  const map = maps.find(m => m.id === mapId);
  if (!map) return [];
  const ids = parseIdList(map.location_list);
  return ids.map(id => locations.find(l => l.id === id)).filter(Boolean) as Location[];
}

export function getLocation(id: string): Location | undefined {
  return locations.find(l => l.id === id);
}

export function findMapByLocation(locId: string): MapConfig | undefined {
  return maps.find(m => {
    const ids = parseIdList(m.location_list);
    return ids.includes(locId);
  });
}

export function isMapUnlocked(map: MapConfig, gs: GameState): boolean {
  if (!map.unlock_realm) return true;
  const level = getLevel(gs.player.realmId);
  if (!level) return false;
  return Number(level.realm_id) >= Number(map.unlock_realm);
}

export function moveToLocation(gs: GameState, locationId: string): boolean {
  const loc = getLocation(locationId);
  if (!loc) return false;

  const mapConfig = findMapByLocation(locationId);
  if (mapConfig && !isMapUnlocked(mapConfig, gs)) return false;

  // 找第一个已解锁的行为（探索度 >= 解锁所需探索度）
  if (!gs.exploration) gs.exploration = {};
  const explored = gs.exploration[locationId] || 0;
  const action = loc.actions.find(a => explored >= a.unlock_exploration);
  if (!action) return false;

  gs.currentAction = {
    type: action.tag,
    skillIds: [action.skill_id],
    locationId: loc.id,
    value: action.value,
    startedAt: Date.now(),
    progress: 0,
    progressSpeed: 1 / action.time_per_cycle,
  };

  if (action.tag === 'combat' && loc.enemy_id) {
    const enemy = spawnEnemy(loc.enemy_id);
    if (enemy) {
      gs.combat = { enemy, playerSkillIndex: 0 };
    }
  } else {
    gs.combat = undefined;
  }

  bus.emit('location:changed', { locationId: loc.id, action: gs.currentAction });
  return true;
}
