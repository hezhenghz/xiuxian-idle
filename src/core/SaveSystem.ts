import { GameState } from './GameState';

import realmRaw from '../config/realm.json';
import levelRaw from '../config/level.json';

const SAVE_KEY_PREFIX = 'xiuxian_save_';
const MAX_SLOTS = 3;

interface RealmRow { id: string; name: string; order: number; }
interface LevelRow { id: string; realm_id: string; layer: number; }

const realms = realmRaw as any as RealmRow[];
const levels = levelRaw as any as LevelRow[];

export interface SaveSlotMeta {
  name: string;
  realm: string;
  playTime: string;
}

function getRealmDisplay(realmId: string): string {
  const level = levels.find(l => l.id === realmId);
  if (!level) return realmId;
  const realm = realms.find(r => r.id === level.realm_id);
  const realmName = realm?.name || level.realm_id;
  return `${realmName} ${level.layer + 1}级`;
}

export function getSaveSlots(): (SaveSlotMeta | null)[] {
  const slots: (SaveSlotMeta | null)[] = [];
  for (let i = 0; i < MAX_SLOTS; i++) {
    const raw = localStorage.getItem(`${SAVE_KEY_PREFIX}${i}`);
    if (raw) {
      try {
        const state: GameState = JSON.parse(raw);
        slots.push(buildMeta(state));
      } catch {
        slots.push(null);
      }
    } else {
      slots.push(null);
    }
  }
  return slots;
}

export function loadSave(slotIndex: number): GameState | null {
  const raw = localStorage.getItem(`${SAVE_KEY_PREFIX}${slotIndex}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GameState;
  } catch {
    return null;
  }
}

export function saveGame(slotIndex: number, state: GameState) {
  state.lastSaveTime = Date.now();
  localStorage.setItem(`${SAVE_KEY_PREFIX}${slotIndex}`, JSON.stringify(state));
}

export function deleteSave(slotIndex: number) {
  localStorage.removeItem(`${SAVE_KEY_PREFIX}${slotIndex}`);
}

function buildMeta(state: GameState): SaveSlotMeta {
  const playSeconds = Math.floor(
    (state.lastSaveTime - state.lastOnlineTime + (Date.now() - state.lastSaveTime)) / 1000
  );
  const h = Math.floor(playSeconds / 3600);
  const m = Math.floor((playSeconds % 3600) / 60);
  return {
    name: state.player.name,
    realm: getRealmDisplay(state.player.realmId),
    playTime: `${h}h ${m}m`,
  };
}
