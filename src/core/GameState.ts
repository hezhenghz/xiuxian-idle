export type ActionTag = 'combat' | 'cultivate' | 'gather' | 'produce' | 'build';

export interface SkillState {
  level: number;
  exp: number;
}

export interface ActionState {
  type: ActionTag;
  skillIds: string[];
  locationId: string;
  value?: number;         // 来自 location.action_value
  startedAt: number;     // timestamp ms
  progress: number;       // 0–1
  progressSpeed: number;  // 每秒进度
}

export interface EnemyState {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  hit: number;
  dodge: number;
  crit: number;
  speed: number;
  skills: EnemySkill[];
  combatProgress: number;
  currentSkillIndex: number;
}

export interface EnemySkill {
  id: string;
  name: string;
  damage: number;
  cast_time: number;
}

export interface ItemInstance {
  id: string;
  quantity: number;
  quality?: string;
}

export interface GameState {
  version: number;
  player: {
    name: string;
    realmId: string;      // 当前小境界 ID
    hp: number;
    maxHp: number;
    mp: number;
    maxMp: number;
  };
  skills: Record<string, SkillState>;
  items: Record<string, number>;
  itemInstances: Record<string, ItemInstance[]>;
  resources: Record<string, number>;
  equipment: {
    weapon: string | null;
    armor: string | null;
    accessory: string | null;
    tool: string | null;
  };
  techniques: string[];
  currentTechniqueId: string;
  currentAction: ActionState | null;
  combat?: {
    enemy: EnemyState;
    playerSkillIndex: number;
  };
  discovered: {
    items: string[];
    enemies: string[];
  };
  exploration: Record<string, number>;
  currentGoalChainId: string | null;
  goalProgress: Record<string, number>;
  lastOnlineTime: number;
  lastSaveTime: number;
}

import initPlayerRaw from '../config/init_player.json';

interface InitPlayer {
  initial_realm_id: string | null;
  initial_level_id: string | null;
  initial_location_id: string | null;
  initial_life_skill: { id: string; level: number }[];
  initial_battle_skill: string[];
  initial_equipment: { weapon: string | null; armor: string | null; accessory: string | null; tool: string | null };
}

const initPlayerRawData: any = initPlayerRaw;
const initPlayer: InitPlayer = Array.isArray(initPlayerRawData) ? (initPlayerRawData[0] || {}) : initPlayerRawData;

function parseIdList(raw: any): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') return raw.split('|').map(s => s.trim()).filter(Boolean);
  if (raw != null) return [String(raw)];
  return [];
}

export function createDefaultGameState(name: string): GameState {
  const skills: Record<string, SkillState> = {};
  const initSkillIds = parseIdList(initPlayer.initial_life_skill);
  for (const id of initSkillIds) {
    skills[id] = { level: 1, exp: 0 };
  }

  const initTechniques = parseIdList(initPlayer.initial_battle_skill);
  const initEquip = initPlayer.initial_equipment || {};

  return {
    version: 1,
    player: {
      name,
      realmId: String(initPlayer.initial_level_id || '1'),
      hp: 0,
      maxHp: 0,
      mp: 0,
      maxMp: 0,
    },
    skills,
    items: {},
    itemInstances: {},
    resources: {},
    equipment: {
      weapon: initEquip.weapon || null,
      armor: initEquip.armor || null,
      accessory: initEquip.accessory || null,
      tool: initEquip.tool || null,
    },
    techniques: initTechniques,
    currentTechniqueId: initTechniques[0] || '',
    currentAction: null,
    discovered: {
      items: [],
      enemies: [],
    },
    exploration: {},
    currentGoalChainId: null,
    goalProgress: {},
    lastOnlineTime: Date.now(),
    lastSaveTime: Date.now(),
  };
}
