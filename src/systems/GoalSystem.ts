import { GameState } from '../core/GameState';
import { bus } from '../core/EventBus';

interface GoalStep {
  id: string;
  desc: string;
  type: string;
  target: string;
  qty?: number;
  reward?: { type: string; id: string; qty: number }[];
}

const goalChain: GoalStep[] = [];

let currentStepIndex = 0;

export function getCurrentGoal(): GoalStep | null {
  if (currentStepIndex >= goalChain.length) return null;
  return goalChain[currentStepIndex];
}

export function checkGoalProgress(gs: GameState): { step: GoalStep; done: boolean; progress: string } | null {
  const step = getCurrentGoal();
  if (!step) return null;

  let done = false;
  let progress = '';

  switch (step.type) {
    case 'have_resource':
      done = (gs.resources[step.target] || 0) >= (step.qty || 0);
      progress = `${gs.resources[step.target] || 0}/${step.qty}`;
      break;
    case 'have_item':
      done = (gs.items[step.target] || 0) >= (step.qty || 0);
      progress = `${gs.items[step.target] || 0}/${step.qty}`;
      break;
    case 'reach_realm':
      done = gs.player.realmId === step.target;
      progress = done ? '已达成' : '未达成';
      break;
    case 'defeat_enemy':
      done = gs.discovered.enemies.includes(step.target);
      progress = done ? '已击败' : '未击败';
      break;
  }

  return { step, done, progress };
}

export function advanceGoal(gs: GameState) {
  const step = getCurrentGoal();
  if (!step) return;

  if (step.reward) {
    for (const r of step.reward) {
      if (r.type === 'resource') {
        gs.resources[r.id] = (gs.resources[r.id] || 0) + r.qty;
      } else if (r.type === 'item') {
        gs.items[r.id] = (gs.items[r.id] || 0) + r.qty;
      }
    }
  }

  currentStepIndex++;
  bus.emit('goal:advanced', { step, next: getCurrentGoal() });
}
