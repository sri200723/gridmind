import {
  EpisodeRecord,
  SavedExperiment,
} from '../types/rl';
import {
  DEFAULT_HYPERPARAMETERS,
  DEFAULT_PLANNER_CONFIG,
  DEFAULT_REWARD_CONFIG,
  ENVIRONMENT_PRESETS,
  cloneEnvironment,
} from './environment';

const STORAGE_KEY = 'rl_grid_world_studio_experiments_v1';

export const PRECONFIGURED_DEMO_EXPERIMENTS: SavedExperiment[] = [
  {
    id: 'demo_cliff_q_vs_sarsa',
    name: '[Demo Baseline] Hazardous Grid — Off-Policy Q-Learning Run',
    createdAt: '2026-10-27T09:00:00.000Z',
    kind: 'completed_run',
    isDemo: true,
    environment: cloneEnvironment(ENVIRONMENT_PRESETS[2]), // Hazardous Grid
    algorithm: 'q_learning',
    hyperparameters: { ...DEFAULT_HYPERPARAMETERS, maxEpisodes: 250, seed: 42 },
    rewardConfig: { ...DEFAULT_REWARD_CONFIG },
    plannerConfig: { ...DEFAULT_PLANNER_CONFIG },
    episodesCompleted: 250,
    evaluationSummary: {
      algorithm: 'q_learning',
      trials: 5,
      successRate: 100,
      avgReward: 91,
      avgSteps: 9,
      failureRate: 0,
      avgHazardHits: 0,
      episodesToThreshold: 54,
      trainingTimeMs: 14.2,
      evaluationTimeMs: 0.4,
      pathTaken: [
        { row: 5, col: 0 },
        { row: 4, col: 0 },
        { row: 4, col: 1 },
        { row: 4, col: 2 },
        { row: 4, col: 3 },
        { row: 4, col: 4 },
        { row: 4, col: 5 },
        { row: 4, col: 6 },
        { row: 4, col: 7 },
        { row: 5, col: 7 },
      ],
      seedUsed: 42,
    },
  },
  {
    id: 'demo_maze_config',
    name: '[Template Config] Maze Challenge — High Discount Exploration',
    createdAt: '2026-10-27T09:15:00.000Z',
    kind: 'config_only',
    isDemo: true,
    environment: cloneEnvironment(ENVIRONMENT_PRESETS[1]), // Maze Challenge
    algorithm: 'sarsa',
    hyperparameters: {
      ...DEFAULT_HYPERPARAMETERS,
      alpha: 0.25,
      gamma: 0.98,
      epsilonDecay: 0.99,
      maxEpisodes: 350,
      seed: 101,
    },
    rewardConfig: { ...DEFAULT_REWARD_CONFIG },
    plannerConfig: { ...DEFAULT_PLANNER_CONFIG },
    episodesCompleted: 0,
  },
];

export function loadSavedExperiments(): SavedExperiment[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return [...PRECONFIGURED_DEMO_EXPERIMENTS];
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [...PRECONFIGURED_DEMO_EXPERIMENTS];
    }
    const parsed = JSON.parse(raw) as SavedExperiment[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [...PRECONFIGURED_DEMO_EXPERIMENTS];
    }
    return parsed;
  } catch {
    return [...PRECONFIGURED_DEMO_EXPERIMENTS];
  }
}

export function persistExperiments(experiments: SavedExperiment[]): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(experiments));
    }
  } catch {
    // Ignore storage quota or sandbox restrictions gracefully
  }
}

export function exportEpisodesToCSV(history: EpisodeRecord[]): string {
  const headers = [
    'episode',
    'algorithm',
    'totalReward',
    'steps',
    'reachedGoal',
    'hazardHits',
    'obstacleHits',
    'rewardsCollected',
    'epsilon',
    'durationMs',
  ];
  const rows = history.map((r) =>
    [
      r.episode,
      r.algorithm,
      r.totalReward,
      r.steps,
      r.reachedGoal,
      r.hazardHits,
      r.obstacleHits,
      r.rewardsCollected,
      r.epsilon,
      r.durationMs,
    ].join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

export function exportExperimentToJSON(experiment: SavedExperiment): string {
  return JSON.stringify(experiment, null, 2);
}
