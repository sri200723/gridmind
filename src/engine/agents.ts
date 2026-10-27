import {
  Action,
  EnvironmentConfig,
  GridCoord,
  PlannerConfig,
  QTable,
  QValues,
  RewardConfig,
} from '../types/rl';
import {
  ACTION_DELTAS,
  ALL_ACTIONS,
  coordToKey,
  coordsEqual,
  findTeleporters,
  stepEnvironment,
} from './environment';
import { SeededRNG } from './prng';

export function createEmptyQValues(): QValues {
  return { UP: 0, RIGHT: 0, DOWN: 0, LEFT: 0 };
}

export function createInitialQTable(env: EnvironmentConfig): QTable {
  const table: QTable = {};
  for (let r = 0; r < env.rows; r++) {
    for (let c = 0; c < env.cols; c++) {
      table[`${r},${c}`] = createEmptyQValues();
    }
  }
  return table;
}

export function cloneQTable(qTable: QTable): QTable {
  const copy: QTable = {};
  for (const key of Object.keys(qTable)) {
    copy[key] = { ...qTable[key] };
  }
  return copy;
}

export function getStateQValues(qTable: QTable, stateKey: string): QValues {
  if (!qTable[stateKey]) {
    qTable[stateKey] = createEmptyQValues();
  }
  return qTable[stateKey];
}

export function getMaxQValue(qTable: QTable, stateKey: string): number {
  const q = getStateQValues(qTable, stateKey);
  return Math.max(q.UP, q.RIGHT, q.DOWN, q.LEFT);
}

export function getBestActions(qTable: QTable, stateKey: string): Action[] {
  const q = getStateQValues(qTable, stateKey);
  const maxVal = Math.max(q.UP, q.RIGHT, q.DOWN, q.LEFT);
  return ALL_ACTIONS.filter((a) => Math.abs(q[a] - maxVal) <= 1e-9);
}

/**
 * Epsilon-Greedy Action Selection with uniform random tie-breaking among equally valued actions.
 */
export function selectEpsilonGreedyAction(
  qTable: QTable,
  stateKey: string,
  epsilon: number,
  rng: SeededRNG
): { action: Action; wasExploratory: boolean } {
  if (rng.next() < epsilon) {
    return {
      action: rng.choice(ALL_ACTIONS),
      wasExploratory: true,
    };
  }
  const bestActions = getBestActions(qTable, stateKey);
  return {
    action: rng.choice(bestActions),
    wasExploratory: false,
  };
}

/**
 * Agent 1: Off-Policy Q-Learning Update
 * Q(s,a) <- Q(s,a) + alpha * [ r + gamma * max_a' Q(s',a') - Q(s,a) ]
 * Terminal states do NOT bootstrap from future states (target = r when done = true).
 */
export function updateQLearning(
  qTable: QTable,
  stateKey: string,
  action: Action,
  reward: number,
  nextStateKey: string,
  done: boolean,
  alpha: number,
  gamma: number
): { qBefore: number; qAfter: number; tdTarget: number; tdError: number } {
  const stateQ = getStateQValues(qTable, stateKey);
  const qBefore = stateQ[action];
  const maxNextQ = done ? 0 : getMaxQValue(qTable, nextStateKey);
  const tdTarget = reward + gamma * maxNextQ;
  const tdError = tdTarget - qBefore;
  const qAfter = qBefore + alpha * tdError;
  stateQ[action] = Number(qAfter.toFixed(6));
  return { qBefore, qAfter: stateQ[action], tdTarget, tdError };
}

/**
 * Agent 2: On-Policy SARSA Update
 * Q(s,a) <- Q(s,a) + alpha * [ r + gamma * Q(s',a') - Q(s,a) ]
 * Uses the Q-value of the action `nextAction` actually selected by the behavior policy in `s'`.
 * Terminal states do NOT bootstrap from future states (target = r when done = true).
 */
export function updateSARSA(
  qTable: QTable,
  stateKey: string,
  action: Action,
  reward: number,
  nextStateKey: string,
  nextAction: Action | null,
  done: boolean,
  alpha: number,
  gamma: number
): { qBefore: number; qAfter: number; tdTarget: number; tdError: number } {
  const stateQ = getStateQValues(qTable, stateKey);
  const qBefore = stateQ[action];
  const nextQ = done || !nextAction ? 0 : getStateQValues(qTable, nextStateKey)[nextAction];
  const tdTarget = reward + gamma * nextQ;
  const tdError = tdTarget - qBefore;
  const qAfter = qBefore + alpha * tdError;
  stateQ[action] = Number(qAfter.toFixed(6));
  return { qBefore, qAfter: stateQ[action], tdTarget, tdError };
}

/**
 * Agent 3: Hand-Designed Goal-Based Planner (Deterministic BFS / Cost-Aware A* Baseline)
 * Explicitly searches the environment graph without training or updating a Q-table.
 */
export interface GoalPlanResult {
  reachable: boolean;
  actions: Action[];
  path: GridCoord[];
  expectedReward: number;
  hazardCount: number;
  rewardsCollected: number;
  policyMap: Record<string, Action>;
}

function findSingleTargetPath(
  env: EnvironmentConfig,
  from: GridCoord,
  to: GridCoord,
  rewardConfig: RewardConfig,
  plannerConfig: PlannerConfig,
  allowHazardsFallback: boolean
): { found: boolean; actions: Action[]; coords: GridCoord[] } {
  const portals = findTeleporters(env.grid);
  const baseStepPenalty = Math.max(0.1, Math.abs(rewardConfig.stepCost));
  const hazardExtraCost = Math.max(0, Math.abs(rewardConfig.hazardPenalty));

  interface Node {
    pos: GridCoord;
    gCost: number;
    fCost: number;
    actions: Action[];
    coords: GridCoord[];
  }

  const heuristic = (p: GridCoord): number => {
    if (plannerConfig.strategy === 'bfs_shortest') return 0;
    return (Math.abs(p.row - to.row) + Math.abs(p.col - to.col)) * baseStepPenalty;
  };

  const open: Node[] = [
    {
      pos: from,
      gCost: 0,
      fCost: heuristic(from),
      actions: [],
      coords: [from],
    },
  ];
  const bestCost = new Map<string, number>();
  bestCost.set(coordToKey(from), 0);

  while (open.length > 0) {
    open.sort((a, b) => a.fCost - b.fCost);
    const current = open.shift()!;

    if (coordsEqual(current.pos, to)) {
      return {
        found: true,
        actions: current.actions,
        coords: current.coords,
      };
    }

    for (const action of ALL_ACTIONS) {
      const { dRow, dCol } = ACTION_DELTAS[action];
      let nr = current.pos.row + dRow;
      let nc = current.pos.col + dCol;
      if (nr < 0 || nr >= env.rows || nc < 0 || nc >= env.cols) continue;
      if (env.grid[nr][nc] === 'obstacle') continue;

      if (env.grid[nr][nc] === 'teleporter' && portals.length >= 2) {
        const idx = portals.findIndex((p) => p.row === nr && p.col === nc);
        if (idx !== -1) {
          const dest = portals[(idx + 1) % portals.length];
          nr = dest.row;
          nc = dest.col;
        }
      }

      const tile = env.grid[nr][nc];
      if (tile === 'hazard' && plannerConfig.avoidHazardsStrictly && !allowHazardsFallback) {
        continue;
      }

      let edgeCost = 1;
      if (plannerConfig.strategy === 'astar_reward_aware') {
        edgeCost = baseStepPenalty;
        if (tile === 'hazard') {
          edgeCost += hazardExtraCost * (plannerConfig.avoidHazardsStrictly ? 5 : 1);
        }
      } else if (tile === 'hazard') {
        edgeCost += plannerConfig.avoidHazardsStrictly ? 1000 : hazardExtraCost;
      }

      const nextPos = { row: nr, col: nc };
      const nextKey = coordToKey(nextPos);
      const newG = current.gCost + edgeCost;

      if (!bestCost.has(nextKey) || newG < bestCost.get(nextKey)! - 1e-9) {
        bestCost.set(nextKey, newG);
        open.push({
          pos: nextPos,
          gCost: newG,
          fCost: newG + heuristic(nextPos),
          actions: [...current.actions, action],
          coords: [...current.coords, nextPos],
        });
      }
    }
  }

  return { found: false, actions: [], coords: [] };
}

export function computeGoalBasedPlan(
  env: EnvironmentConfig,
  rewardConfig: RewardConfig,
  plannerConfig: PlannerConfig,
  startOverride?: GridCoord
): GoalPlanResult {
  const start = startOverride ?? env.startPos;

  // First attempt respecting strict hazard avoidance
  let direct = findSingleTargetPath(env, start, env.goalPos, rewardConfig, plannerConfig, false);
  // Fallback if hazards completely block the only possible route
  if (!direct.found && plannerConfig.avoidHazardsStrictly) {
    direct = findSingleTargetPath(env, start, env.goalPos, rewardConfig, plannerConfig, true);
  }

  if (!direct.found) {
    return {
      reachable: false,
      actions: [],
      path: [start],
      expectedReward: 0,
      hazardCount: 0,
      rewardsCollected: 0,
      policyMap: {},
    };
  }

  let chosenActions = direct.actions;

  // If reward collection is enabled in A* mode and reward tiles have positive value,
  // check if routing via reachable reward tiles yields a higher total net return.
  if (
    plannerConfig.collectRewards &&
    plannerConfig.strategy === 'astar_reward_aware' &&
    rewardConfig.rewardTileValue > 0
  ) {
    const rewardCoords: GridCoord[] = [];
    for (let r = 0; r < env.rows; r++) {
      for (let c = 0; c < env.cols; c++) {
        if (env.grid[r][c] === 'reward') {
          rewardCoords.push({ row: r, col: c });
        }
      }
    }

    if (rewardCoords.length > 0) {
      let currentPos = start;
      const remaining = [...rewardCoords];
      const compositeActions: Action[] = [];

      while (remaining.length > 0) {
        let bestIdx = -1;
        let bestNetGain = 0;
        let bestLeg: Action[] = [];

        for (let i = 0; i < remaining.length; i++) {
          const target = remaining[i];
          const toReward = findSingleTargetPath(env, currentPos, target, rewardConfig, plannerConfig, false);
          const fromRewardToGoal = findSingleTargetPath(env, target, env.goalPos, rewardConfig, plannerConfig, false);
          const directNow = findSingleTargetPath(env, currentPos, env.goalPos, rewardConfig, plannerConfig, false);

          if (toReward.found && fromRewardToGoal.found && directNow.found) {
            const extraSteps =
              toReward.actions.length + fromRewardToGoal.actions.length - directNow.actions.length;
            const extraStepCost = extraSteps * Math.abs(rewardConfig.stepCost);
            const netGain = rewardConfig.rewardTileValue - extraStepCost;
            if (netGain > bestNetGain) {
              bestNetGain = netGain;
              bestIdx = i;
              bestLeg = toReward.actions;
            }
          }
        }

        if (bestIdx !== -1) {
          compositeActions.push(...bestLeg);
          currentPos = remaining[bestIdx];
          remaining.splice(bestIdx, 1);
        } else {
          break;
        }
      }

      if (compositeActions.length > 0) {
        const finalLeg = findSingleTargetPath(env, currentPos, env.goalPos, rewardConfig, plannerConfig, false);
        if (finalLeg.found) {
          chosenActions = [...compositeActions, ...finalLeg.actions];
        }
      }
    }
  }

  // Simulate chosen plan on the environment to record exact path, reward, hazards, and policy map
  const path: GridCoord[] = [{ ...start }];
  const policyMap: Record<string, Action> = {};
  const collected = new Set<string>();
  let simState = { ...start };
  let totalReward = 0;
  let hazardCount = 0;
  let rewardsCollected = 0;

  for (const act of chosenActions) {
    const key = coordToKey(simState);
    if (!policyMap[key]) {
      policyMap[key] = act;
    }
    const tr = stepEnvironment(env, simState, act, rewardConfig, collected, false);
    totalReward += tr.reward;
    if (tr.hitHazard) hazardCount++;
    if (tr.collectedReward) rewardsCollected++;
    simState = tr.nextState;
    path.push({ ...simState });
    if (tr.done) break;
  }

  return {
    reachable: true,
    actions: chosenActions,
    path,
    expectedReward: Number(totalReward.toFixed(2)),
    hazardCount,
    rewardsCollected,
    policyMap,
  };
}
