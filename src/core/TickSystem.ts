import { GameState, ActionState } from './GameState';
import { bus } from './EventBus';
import { saveGame } from './SaveSystem';
import { advanceCombat, spawnEnemy, resolveCombatOffline } from '../systems/CombatSystem';

const OFFLINE_FULL_HOURS = 24;
const OFFLINE_DISCOUNT_START_HOURS = 24;
const OFFLINE_MAX_HOURS = 96;
const OFFLINE_DISCOUNT_RATE = 0.5;

let tickRaf = 0;
let lastTickTime = 0;
let slotIndex = 0;
let state: GameState | null = null;

export function startTick(gs: GameState, saveSlot: number) {
  state = gs;
  slotIndex = saveSlot;
  lastTickTime = performance.now();

  document.addEventListener('visibilitychange', onVisibilityChange);
  tickLoop(lastTickTime);
}

export function stopTick() {
  cancelAnimationFrame(tickRaf);
  document.removeEventListener('visibilitychange', onVisibilityChange);
  state = null;
}

function tickLoop(now: number) {
  if (!state) return;
  const dt = (now - lastTickTime) / 1000;
  lastTickTime = now;

  if (dt > 0 && dt < 10) {
    advanceAction(state, dt);
  }

  tickRaf = requestAnimationFrame(tickLoop);
}

function advanceAction(gs: GameState, dt: number) {
  const action = gs.currentAction;
  if (!action) return;

  if (action.type === 'combat') {
    advanceCombat(gs, dt);
    return;
  }

  action.progress += action.progressSpeed * dt;

  while (action.progress >= 1) {
    action.progress -= 1;
    bus.emit('action:complete', action);
  }
}

function onVisibilityChange() {
  if (!state) return;

  if (document.hidden) {
    state.lastOnlineTime = Date.now();
  } else {
    const now = Date.now();
    const offlineMs = now - state.lastOnlineTime;
    if (offlineMs > 1000) {
      settleOffline(state, offlineMs);
    }
    lastTickTime = performance.now();
  }
}

function settleOffline(gs: GameState, offlineMs: number) {
  const offlineHours = offlineMs / (1000 * 60 * 60);
  let effectiveSeconds: number;

  if (offlineHours <= OFFLINE_FULL_HOURS) {
    effectiveSeconds = offlineMs / 1000;
  } else if (offlineHours <= OFFLINE_MAX_HOURS) {
    const fullSeconds = OFFLINE_FULL_HOURS * 3600;
    const discountSeconds = (offlineHours - OFFLINE_DISCOUNT_START_HOURS) * 3600 * OFFLINE_DISCOUNT_RATE;
    effectiveSeconds = fullSeconds + discountSeconds;
  } else {
    const fullSeconds = OFFLINE_FULL_HOURS * 3600;
    const discountSeconds = (OFFLINE_MAX_HOURS - OFFLINE_DISCOUNT_START_HOURS) * 3600 * OFFLINE_DISCOUNT_RATE;
    effectiveSeconds = fullSeconds + discountSeconds;
  }

  const action = gs.currentAction;
  if (!action) return;

  const totalProgress = action.progress + action.progressSpeed * effectiveSeconds;
  const completions = Math.floor(totalProgress);
  action.progress = totalProgress - completions;

  if (action.type === 'combat') {
    resolveCombatOffline(gs, completions);
  } else {
    for (let i = 0; i < completions; i++) {
      bus.emit('action:complete', action);
    }
  }

  bus.emit('offline:settled', {
    offlineMs,
    completions,
    action,
  });

  saveGame(slotIndex, gs);
}

export { OFFLINE_FULL_HOURS, OFFLINE_MAX_HOURS, OFFLINE_DISCOUNT_RATE };
