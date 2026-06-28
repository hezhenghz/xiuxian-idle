import { createApp, reactive } from 'petite-vue';
import { createDefaultGameState, GameState } from './core/GameState';
import initPlayerRaw from './config/init_player.json';
import { getSaveSlots, loadSave, saveGame, deleteSave, type SaveSlotMeta } from './core/SaveSystem';
import { startTick, stopTick } from './core/TickSystem';
import { initCultivation, getSkillLevelProgress } from './systems/CultivationSystem';
import { initGather } from './systems/GatherSystem';
import { getRecipes, canCraft, craft, getRecipe } from './systems/CraftSystem';
import { equip, unequip, getEquipBonus, type EquipSlot } from './systems/EquipmentSystem';
import {
  canBreakthroughLevel, breakthroughLevel,
  canBreakthroughRealm, breakthroughRealm,
  getLevel, getRealm,
  applyRealmStats,
} from './systems/RealmSystem';
import {
  getLands, getMaps, getLocations, getLocation,
  isMapUnlocked, moveToLocation,
  type LandConfig, type MapConfig, type Location,
} from './systems/MapSystem';
import { checkGoalProgress, getCurrentGoal, advanceGoal } from './systems/GoalSystem';
import { bus } from './core/EventBus';

interface MapZoneView extends MapConfig {
  unlocked: boolean;
}

interface MapState {
  currentLand: LandConfig | null;
  zones: MapZoneView[];
  activeZone: MapConfig | null;
  locations: Location[];
}

interface AppState {
  view: 'saveSelect' | 'createChar' | 'game';
  saveSlots: (SaveSlotMeta | null)[];
  selectedSlot: number;
  charName: string;
  guidance: string;
  activeNav: string;
  gameState: GameState | null;
}

let currentSlot = 0;
let autoSaveTimer: ReturnType<typeof setInterval> | null = null;

const mapState = reactive<MapState>({
  currentLand: null,
  zones: [],
  activeZone: null,
  locations: [],
});

function refreshMap(gs: GameState) {
  const lands = getLands();
  mapState.currentLand = lands[0] || null;
  if (mapState.currentLand) {
    mapState.zones = getMaps(mapState.currentLand.id).map(z => ({
      ...z,
      unlocked: isMapUnlocked(z, gs),
    }));
    // Select first unlocked zone by default
    if (!mapState.activeZone) {
      const firstUnlocked = mapState.zones.find(z => z.unlocked);
      if (firstUnlocked) {
        mapState.activeZone = firstUnlocked;
        mapState.locations = getLocations(firstUnlocked.id);
      }
    }
  }
}

function selectZone(map: MapZoneView) {
  if (!map.unlocked) return;
  mapState.activeZone = map;
  mapState.locations = getLocations(map.id);
}

function clickLocation(locId: string) {
  if (!state.gameState) return;
  moveToLocation(state.gameState, locId);
}

const state = reactive<AppState & { cultCurrent: number; cultNeeded: number; cultPct: number; btType: string }>({
  view: 'saveSelect',
  saveSlots: getSaveSlots(),
  selectedSlot: 0,
  charName: '',
  guidance: '',
  activeNav: 'map',
  gameState: null,
  cultCurrent: 0,
  cultNeeded: 0,
  cultPct: 0,
  btType: 'none',
});

// btState 废弃，改用 state.btType

function updateBtState() {
  if (!state.gameState || !state.gameState.player.realmId) return;
  const gs = state.gameState;
  const levelCheck = canBreakthroughLevel(gs);
  if (levelCheck.can) {
    state.btType = 'minor';
    return;
  }
  const realmCheck = canBreakthroughRealm(gs);
  if (realmCheck.can) {
    state.btType = 'major';
    return;
  }
  state.btType = 'none';
}

function getRealmDisplay(realmId: string): string {
  const level = getLevel(realmId);
  if (!level) return realmId;
  const realm = getRealm(level.realm_id);
  const realmName = realm?.name || level.realm_id;
  return `${realmName} ${level.layer + 1}级`;
}

function getActionName(action: any): string {
  const names: Record<string, string> = {
    cultivate: '打坐修炼',
    gather: '采集',
    produce: '生产',
    combat: '战斗',
    build: '建设',
  };
  return names[action.type] || action.type;
}

function doMinorBreakthrough() {
  if (!state.gameState) return;
  const gs = state.gameState;
  const result = breakthroughLevel(gs);
  if (result.success) {
    state.guidance = `突破成功！`;
    updateBtState();
  }
}

function doMajorBreakthroughFlow() {
  state.activeNav = 'breakthrough';
  state.guidance = '突破境界 — 后续开发';
}

function selectSlot(i: number) {
  const slot = state.saveSlots[i];
  if (slot) {
    const loaded = loadSave(i);
    if (loaded) {
      try {
        currentSlot = i;
        state.gameState = reactive(loaded) as GameState;
        state.view = 'game';
        state.guidance = `欢迎回来，${loaded.player.name}。`;
        startAutoSave();
        initCultivation(state.gameState);
        initGather(state.gameState);
        refreshMap(state.gameState);
        updateBtState();
        startTick(state.gameState, currentSlot);
        refreshCultivationProgress();
        bus.emit('game:loaded', loaded);
      } catch (e) {
        const msg = (e as Error).message || String(e);
        console.error('进入游戏失败:', e);
        state.view = 'saveSelect';
        alert(`进入游戏失败:\n${msg}\n\n（已复制到控制台，F12 可查看详情）`);
      }
    } else {
      alert('存档读取失败，请删除后重建。');
    }
  } else {
    state.selectedSlot = i;
    state.charName = '';
    state.view = 'createChar';
  }
}

function confirmCreate() {
  const name = state.charName.trim();
  if (!name) return;
  try {
    currentSlot = state.selectedSlot;
    const gs = createDefaultGameState(name);
    state.gameState = reactive(gs) as GameState;
    if (gs.player.realmId) {
      const initLevel = getLevel(gs.player.realmId);
      if (initLevel) applyRealmStats(gs, initLevel);
    }
    state.view = 'game';
    state.guidance = `${name}，你踏入了修仙之路。`;
    saveGame(currentSlot, gs);
    startAutoSave();
    initCultivation(state.gameState);
    initGather(state.gameState);
    refreshMap(state.gameState);
    updateBtState();
    startTick(state.gameState, currentSlot);
    const initCfg = Array.isArray(initPlayerRaw) ? initPlayerRaw[0] : initPlayerRaw;
    const initLocId = initCfg?.initial_location_id;
    if (initLocId) moveToLocation(state.gameState, String(initLocId));
    refreshCultivationProgress();
    bus.emit('game:started', gs);
  } catch (e) {
    const msg = (e as Error).message || String(e);
    console.error('创建角色失败:', e);
    state.guidance = `创建角色失败: ${msg}`;
    state.view = 'createChar';
    alert(`创建角色失败:\n${msg}\n\n（已复制到控制台，F12 可查看详情）`);
  }
}

function startAutoSave() {
  if (autoSaveTimer) clearInterval(autoSaveTimer);
  autoSaveTimer = setInterval(() => {
    if (state.gameState) {
      saveGame(currentSlot, state.gameState);
    }
  }, 30_000);
}

function backToMenu() {
  stopTick();
  if (autoSaveTimer) clearInterval(autoSaveTimer);
  state.gameState = null;
  state.saveSlots = getSaveSlots();
  state.view = 'saveSelect';
}

function deleteSlot(i: number) {
  deleteSave(i);
  state.saveSlots = getSaveSlots();
}

bus.on('inventory:full', (data: any) => {
  state.guidance = `背包已满，${data.itemId} 无法放入，已消失。`;
});

bus.on('offline:settled', (data: any) => {
  const { offlineMs, completions } = data;
  const hours = Math.floor(offlineMs / 3600000);
  const mins = Math.floor((offlineMs % 3600000) / 60000);
  state.guidance = `你闭关了 ${hours} 小时 ${mins} 分钟，完成了 ${completions} 次修炼。`;
});

window.addEventListener('beforeunload', () => {
  if (state.gameState) {
    saveGame(currentSlot, state.gameState);
  }
});

function skillLevelProgress(skill: { level: number; exp: number }): number {
  return Math.floor(getSkillLevelProgress(skill) * 100);
}

bus.on('combat:enemy_defeated', (data: any) => {
  const drops = data.drops?.map((d: any) => `${d.itemId} x${d.qty}`).join(', ') || '';
  state.guidance = `击败了敌人！获得: ${drops}`;
});

bus.on('combat:player_defeated', () => {
  state.guidance = `战斗失败，已切换为打坐修炼。`;
});

bus.on('realm:changed', () => {
  if (state.gameState) {
    refreshCultivationProgress();
    refreshMap(state.gameState);
    updateBtState();
  }
});

bus.on('action:complete', () => {
  if (!state.gameState) return;
  // 探索度 +1
  const locId = state.gameState.currentAction?.locationId;
  if (locId) {
    if (!state.gameState.exploration) state.gameState.exploration = {};
    const loc = getLocation(locId);
    const max = loc?.exploration_max ?? 0;
    const cur = state.gameState.exploration[locId] || 0;
    if (max === 0 || cur < max) {
      state.gameState.exploration[locId] = cur + 1;
    }
  }
  refreshCultivationProgress();
  updateBtState();
  const check = checkGoalProgress(state.gameState);
  if (check?.done) {
    advanceGoal(state.gameState);
    const next = getCurrentGoal();
    state.guidance = `目标完成！${next ? `下一个目标: ${next.desc}` : '全部完成！'}`;
  } else if (check) {
    state.guidance = `${check.step.desc} (${check.progress})`;
  }
});

function refreshCultivationProgress() {
  if (!state.gameState) return;
  const current = state.gameState.resources['cultivation'] || 0;
  const level = getLevel(state.gameState.player.realmId);
  const needed = level?.cultivation_needed ?? 0;
  state.cultCurrent = current;
  state.cultNeeded = needed;
  state.cultPct = needed > 0 ? Math.min(100, Math.floor((current / needed) * 100)) : 0;
}

createApp({
  state, mapState, selectSlot, confirmCreate, backToMenu, deleteSlot,
  skillLevelProgress, selectZone, clickLocation,
  getRealmDisplay, getActionName,
  doMinorBreakthrough, doMajorBreakthroughFlow,
}).mount('#app');
