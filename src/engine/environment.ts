import {
  Action,
  EnvironmentConfig,
  GridCoord,
  Hyperparameters,
  PlannerConfig,
  RewardConfig,
  RewardPreset,
  StepTransition,
  TileType,
} from '../types/rl';

export const ALL_ACTIONS: readonly Action[] = ['UP', 'RIGHT', 'DOWN', 'LEFT'];

export const ACTION_DELTAS: Record<Action, { dRow: number; dCol: number; symbol: string; label: string }> = {
  UP: { dRow: -1, dCol: 0, symbol: '↑', label: 'Up (North)' },
  RIGHT: { dRow: 0, dCol: 1, symbol: '→', label: 'Right (East)' },
  DOWN: { dRow: 1, dCol: 0, symbol: '↓', label: 'Down (South)' },
  LEFT: { dRow: 0, dCol: -1, symbol: '←', label: 'Left (West)' },
};

export function coordToKey(coord: GridCoord): string {
  return `${coord.row},${coord.col}`;
}

export function keyToCoord(key: string): GridCoord {
  const [r, c] = key.split(',').map(Number);
  return { row: r, col: c };
}

export function coordsEqual(a: GridCoord, b: GridCoord): boolean {
  return a.row === b.row && a.col === b.col;
}

export const DEFAULT_HYPERPARAMETERS: Hyperparameters = {
  alpha: 0.25,
  gamma: 0.95,
  epsilonStart: 0.35,
  epsilonMin: 0.1,
  epsilonDecay: 0.995,
  maxEpisodes: 250,
  maxStepsPerEpisode: 100,
  speed: 3,
  seed: 42,
};

export const DEFAULT_REWARD_CONFIG: RewardConfig = {
  goalReward: 100,
  stepCost: -1,
  obstaclePenalty: -5,
  hazardPenalty: -50,
  rewardTileValue: 15,
};

export const DEFAULT_PLANNER_CONFIG: PlannerConfig = {
  strategy: 'astar_reward_aware',
  avoidHazardsStrictly: true,
  collectRewards: true,
};

export const REWARD_PRESETS: RewardPreset[] = [
  {
    id: 'balanced',
    name: 'Balanced Navigation',
    description: 'Standard trade-off between reaching the goal quickly and avoiding hazards.',
    config: {
      goalReward: 100,
      stepCost: -1,
      obstaclePenalty: -5,
      hazardPenalty: -50,
      rewardTileValue: 15,
    },
  },
  {
    id: 'fastest',
    name: 'Fastest Route',
    description: 'High per-step penalty (-4) pressures agents to take the shortest path, even near hazards.',
    config: {
      goalReward: 100,
      stepCost: -4,
      obstaclePenalty: -8,
      hazardPenalty: -18,
      rewardTileValue: 5,
    },
  },
  {
    id: 'safest',
    name: 'Safest Route',
    description: 'Severe hazard penalty (-85) and low step cost (-0.5) incentivize wide detours around hazards.',
    config: {
      goalReward: 100,
      stepCost: -0.5,
      obstaclePenalty: -5,
      hazardPenalty: -85,
      rewardTileValue: 10,
    },
  },
  {
    id: 'collector',
    name: 'Reward Collection',
    description: 'High bonus tile value (+35) encourages detours to harvest sub-goal rewards before finishing.',
    config: {
      goalReward: 100,
      stepCost: -1,
      obstaclePenalty: -4,
      hazardPenalty: -30,
      rewardTileValue: 35,
    },
  },
];

function buildGridFromAscii(lines: string[]): {
  grid: TileType[][];
  startPos: GridCoord;
  goalPos: GridCoord;
} {
  const rows = lines.length;
  const cols = lines[0].length;
  const grid: TileType[][] = [];
  let startPos: GridCoord = { row: 0, col: 0 };
  let goalPos: GridCoord = { row: rows - 1, col: cols - 1 };

  for (let r = 0; r < rows; r++) {
    const rowTiles: TileType[] = [];
    for (let c = 0; c < cols; c++) {
      const ch = lines[r][c];
      if (ch === 'S') {
        startPos = { row: r, col: c };
        rowTiles.push('start');
      } else if (ch === 'G') {
        goalPos = { row: r, col: c };
        rowTiles.push('goal');
      } else if (ch === '#') {
        rowTiles.push('obstacle');
      } else if (ch === '!') {
        rowTiles.push('hazard');
      } else if (ch === '+') {
        rowTiles.push('reward');
      } else if (ch === 'T') {
        rowTiles.push('teleporter');
      } else {
        rowTiles.push('empty');
      }
    }
    grid.push(rowTiles);
  }
  return { grid, startPos, goalPos };
}

export const ENVIRONMENT_PRESETS: EnvironmentConfig[] = [
  (() => {
    const ascii = [
      'S...+.',
      '.##...',
      '....#.',
      '.!....',
      '....G.',
    ];
    const parsed = buildGridFromAscii(ascii);
    return {
      id: 'simple_nav',
      name: 'Simple Navigation',
      description: 'Compact 5×6 environment with a short optimal route, a few walls, and one optional bonus.',
      rows: 5,
      cols: 6,
      ...parsed,
    };
  })(),
  (() => {
    const ascii = [
      'S.#....',
      '..#.+#.',
      '.##..#.',
      '....##.',
      '.#..!..',
      '.#.##..',
      '...#..G',
    ];
    const parsed = buildGridFromAscii(ascii);
    return {
      id: 'maze_challenge',
      name: 'Maze Challenge',
      description: '7×7 strategic labyrinth requiring multi-turn exploration around dead ends and bottlenecks.',
      rows: 7,
      cols: 7,
      ...parsed,
    };
  })(),
  (() => {
    const ascii = [
      '........',
      '........',
      '........',
      '........',
      '........',
      'S!!!!!!G',
    ];
    const parsed = buildGridFromAscii(ascii);
    return {
      id: 'hazardous_grid',
      name: 'Hazardous Grid',
      description: 'Classic cliff-style 6×8 environment. Illustrates why off-policy Q-Learning hugs the risky edge while on-policy SARSA prefers a safer upper detour.',
      rows: 6,
      cols: 8,
      ...parsed,
    };
  })(),
  (() => {
    const ascii = [
      'S..#....+',
      '...#.##..',
      '.+...#...',
      '###..#.#.',
      '.....!.#.',
      '.#.###...',
      '.#...+.##',
      '.#..!...#',
      '....#...G',
    ];
    const parsed = buildGridFromAscii(ascii);
    return {
      id: 'long_horizon',
      name: 'Long-Horizon Navigation',
      description: '9×9 environment with distant delayed rewards that highlights the importance of a high discount factor (γ).',
      rows: 9,
      cols: 9,
      ...parsed,
    };
  })(),
  (() => {
    const ascii = [
      'S..#...+',
      '.T.#.!.#',
      '...###..',
      '.!......',
      '...###T.',
      '.+...#..',
      '.....#.G',
    ];
    const parsed = buildGridFromAscii(ascii);
    return {
      id: 'teleporter_lab',
      name: 'Teleporter & Reward Lab',
      description: '7×8 laboratory featuring paired quantum teleporters (T ↔ T), hazards, and collectible sub-goals.',
      rows: 7,
      cols: 8,
      ...parsed,
    };
  })(),
];

export function cloneEnvironment(env: EnvironmentConfig): EnvironmentConfig {
  return {
    ...env,
    grid: env.grid.map((row) => [...row]),
    startPos: { ...env.startPos },
    goalPos: { ...env.goalPos },
  };
}

export function findTeleporters(grid: TileType[][]): GridCoord[] {
  const portals: GridCoord[] = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] === 'teleporter') {
        portals.push({ row: r, col: c });
      }
    }
  }
  return portals;
}

export function getAvailableActions(env: EnvironmentConfig, state: GridCoord): Action[] {
  const valid: Action[] = [];
  for (const action of ALL_ACTIONS) {
    const { dRow, dCol } = ACTION_DELTAS[action];
    const nr = state.row + dRow;
    const nc = state.col + dCol;
    if (nr >= 0 && nr < env.rows && nc >= 0 && nc < env.cols && env.grid[nr][nc] !== 'obstacle') {
      valid.push(action);
    }
  }
  return valid;
}

/**
 * Deterministic Grid-World Transition & Reward Engine
 * - Moving out of bounds or into an 'obstacle' tile blocks movement (agent stays in `state`)
 *   and returns `rewardConfig.obstaclePenalty`.
 * - Moving onto a 'teleporter' transports the agent to the paired teleporter (if at least 2 exist).
 * - Moving onto 'goal' terminates the episode (`done = true`) and yields `goalReward + stepCost`.
 * - Moving onto 'hazard' yields `hazardPenalty + stepCost`.
 * - Moving onto an uncollected 'reward' tile yields `rewardTileValue + stepCost` and marks it collected for this episode.
 * - Moving onto 'empty' or 'start' yields `stepCost`.
 */
export function stepEnvironment(
  env: EnvironmentConfig,
  state: GridCoord,
  action: Action,
  rewardConfig: RewardConfig,
  collectedRewards: Set<string>,
  wasExploratory: boolean = false
): StepTransition {
  const stateKey = coordToKey(state);
  const { dRow, dCol } = ACTION_DELTAS[action];
  const candidateRow = state.row + dRow;
  const candidateCol = state.col + dCol;

  const outOfBounds =
    candidateRow < 0 ||
    candidateRow >= env.rows ||
    candidateCol < 0 ||
    candidateCol >= env.cols;

  if (outOfBounds || env.grid[candidateRow][candidateCol] === 'obstacle') {
    return {
      state: { ...state },
      stateKey,
      action,
      nextState: { ...state },
      nextStateKey: stateKey,
      reward: rewardConfig.obstaclePenalty,
      done: false,
      hitObstacle: true,
      hitHazard: false,
      collectedReward: false,
      usedTeleporter: false,
      wasExploratory,
    };
  }

  let nextState: GridCoord = { row: candidateRow, col: candidateCol };
  let usedTeleporter = false;

  if (env.grid[nextState.row][nextState.col] === 'teleporter') {
    const portals = findTeleporters(env.grid);
    if (portals.length >= 2) {
      const idx = portals.findIndex((p) => coordsEqual(p, nextState));
      if (idx !== -1) {
        const dest = portals[(idx + 1) % portals.length];
        nextState = { ...dest };
        usedTeleporter = true;
      }
    }
  }

  const nextStateKey = coordToKey(nextState);
  const tile = env.grid[nextState.row][nextState.col];

  if (tile === 'goal' || coordsEqual(nextState, env.goalPos)) {
    return {
      state: { ...state },
      stateKey,
      action,
      nextState,
      nextStateKey,
      reward: Number((rewardConfig.goalReward + rewardConfig.stepCost).toFixed(4)),
      done: true,
      hitObstacle: false,
      hitHazard: false,
      collectedReward: false,
      usedTeleporter,
      wasExploratory,
    };
  }

  if (tile === 'hazard') {
    return {
      state: { ...state },
      stateKey,
      action,
      nextState,
      nextStateKey,
      reward: Number((rewardConfig.hazardPenalty + rewardConfig.stepCost).toFixed(4)),
      done: false,
      hitObstacle: false,
      hitHazard: true,
      collectedReward: false,
      usedTeleporter,
      wasExploratory,
    };
  }

  if (tile === 'reward' && !collectedRewards.has(nextStateKey)) {
    collectedRewards.add(nextStateKey);
    return {
      state: { ...state },
      stateKey,
      action,
      nextState,
      nextStateKey,
      reward: Number((rewardConfig.rewardTileValue + rewardConfig.stepCost).toFixed(4)),
      done: false,
      hitObstacle: false,
      hitHazard: false,
      collectedReward: true,
      usedTeleporter,
      wasExploratory,
    };
  }

  return {
    state: { ...state },
    stateKey,
    action,
    nextState,
    nextStateKey,
    reward: Number(rewardConfig.stepCost.toFixed(4)),
    done: false,
    hitObstacle: false,
    hitHazard: false,
    collectedReward: false,
    usedTeleporter,
    wasExploratory,
  };
}

export interface EnvironmentValidation {
  valid: boolean;
  reachable: boolean;
  shortestSteps: number | null;
  errors: string[];
  warnings: string[];
}

export function validateEnvironment(env: EnvironmentConfig): EnvironmentValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (coordsEqual(env.startPos, env.goalPos)) {
    errors.push('Start and Goal positions cannot occupy the same grid cell.');
  }
  if (env.grid[env.startPos.row]?.[env.startPos.col] === 'obstacle') {
    errors.push('Start position cannot be placed on an obstacle.');
  }
  if (env.grid[env.goalPos.row]?.[env.goalPos.col] === 'obstacle') {
    errors.push('Goal position cannot be placed on an obstacle.');
  }

  const visited = new Set<string>();
  const queue: { pos: GridCoord; dist: number }[] = [{ pos: env.startPos, dist: 0 }];
  visited.add(coordToKey(env.startPos));
  let shortestSteps: number | null = null;
  const portals = findTeleporters(env.grid);

  while (queue.length > 0) {
    const { pos, dist } = queue.shift()!;
    if (coordsEqual(pos, env.goalPos)) {
      shortestSteps = dist;
      break;
    }
    for (const action of ALL_ACTIONS) {
      const { dRow, dCol } = ACTION_DELTAS[action];
      let nr = pos.row + dRow;
      let nc = pos.col + dCol;
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

      const key = `${nr},${nc}`;
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({ pos: { row: nr, col: nc }, dist: dist + 1 });
      }
    }
  }

  const reachable = shortestSteps !== null;
  if (!reachable) {
    warnings.push('Goal is currently unreachable from Start (blocked by obstacles). Agents will time out at max steps.');
  }

  return {
    valid: errors.length === 0,
    reachable,
    shortestSteps,
    errors,
    warnings,
  };
}
