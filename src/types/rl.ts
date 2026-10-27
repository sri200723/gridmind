export type TileType = 'empty' | 'start' | 'goal' | 'obstacle' | 'hazard' | 'reward' | 'teleporter';

export type Action = 'UP' | 'RIGHT' | 'DOWN' | 'LEFT';

export type AlgorithmType = 'q_learning' | 'sarsa' | 'goal_based';

export type SimulationStatus = 'Idle' | 'Training' | 'Paused' | 'Completed';

export type VisualizationMode = 'training' | 'evaluation';

export type GoalPlannerStrategy = 'bfs_shortest' | 'astar_reward_aware';

export interface GridCoord {
  row: number;
  col: number;
}

export interface RewardConfig {
  goalReward: number;
  stepCost: number;
  obstaclePenalty: number;
  hazardPenalty: number;
  rewardTileValue: number;
}

export interface RewardPreset {
  id: string;
  name: string;
  description: string;
  config: RewardConfig;
}

export interface EnvironmentConfig {
  id: string;
  name: string;
  description: string;
  rows: number;
  cols: number;
  grid: TileType[][];
  startPos: GridCoord;
  goalPos: GridCoord;
}

export interface Hyperparameters {
  alpha: number;          // Learning rate (0.01 - 1.0)
  gamma: number;          // Discount factor (0.0 - 0.99)
  epsilonStart: number;   // Initial exploration rate (0.0 - 1.0)
  epsilonMin: number;     // Minimum exploration rate (0.0 - 0.5)
  epsilonDecay: number;   // Decay multiplier per episode (0.90 - 0.999)
  maxEpisodes: number;    // Max training episodes
  maxStepsPerEpisode: number; // Max steps per episode
  speed: number;          // 1 (slow step) to 5 (instant batch)
  seed: number;           // PRNG seed for reproducibility
}

export interface PlannerConfig {
  strategy: GoalPlannerStrategy;
  avoidHazardsStrictly: boolean;
  collectRewards: boolean;
}

export type QValues = Record<Action, number>;

export type QTable = Record<string, QValues>;

export type VisitTable = Record<string, number>;

export interface StepTransition {
  state: GridCoord;
  stateKey: string;
  action: Action;
  nextState: GridCoord;
  nextStateKey: string;
  reward: number;
  done: boolean;
  hitObstacle: boolean;
  hitHazard: boolean;
  collectedReward: boolean;
  usedTeleporter: boolean;
  wasExploratory: boolean;
  tdTarget?: number;
  tdError?: number;
  qBefore?: number;
  qAfter?: number;
}

export interface EpisodeRecord {
  episode: number;
  algorithm: AlgorithmType;
  totalReward: number;
  steps: number;
  reachedGoal: boolean;
  hazardHits: number;
  obstacleHits: number;
  rewardsCollected: number;
  epsilon: number;
  durationMs: number;
  movingAvgReward?: number;
  rollingSuccessRate?: number;
}

export interface CheckpointEvalRecord {
  episode: number;
  evalReward: number;
  evalSteps: number;
  reachedGoal: boolean;
  hazardHits: number;
}

export interface EvaluationSummary {
  algorithm: AlgorithmType;
  trials: number;
  successRate: number;
  avgReward: number;
  avgSteps: number;
  failureRate: number;
  avgHazardHits: number;
  episodesToThreshold: number | null;
  trainingTimeMs: number | null;
  evaluationTimeMs: number;
  pathTaken: GridCoord[];
  seedUsed: number;
}

export interface ControlledComparisonResult {
  mode: 'controlled' | 'baseline';
  seedsUsed: number[];
  thresholdReward: number;
  qLearningHistory: EpisodeRecord[];
  sarsaHistory: EpisodeRecord[];
  qLearningSummary: EvaluationSummary;
  sarsaSummary: EvaluationSummary;
  goalBasedSummary?: EvaluationSummary;
  multiSeedStats?: {
    qLearningRewardStd: number;
    sarsaRewardStd: number;
    qLearningSuccessStd: number;
    sarsaSuccessStd: number;
  };
}

export interface SavedExperiment {
  id: string;
  name: string;
  createdAt: string;
  kind: 'config_only' | 'completed_run';
  isDemo?: boolean;
  environment: EnvironmentConfig;
  algorithm: AlgorithmType;
  hyperparameters: Hyperparameters;
  rewardConfig: RewardConfig;
  plannerConfig: PlannerConfig;
  episodesCompleted: number;
  evaluationSummary?: EvaluationSummary;
  finalHistorySample?: EpisodeRecord[];
}

export interface UnitTestResult {
  id: string;
  name: string;
  category: string;
  passed: boolean;
  assertionDetails: string;
  durationMs: number;
}

export type BrainStatus = 'Fresh' | 'Trained' | 'Restored' | 'Modified';

export interface AgentBrainState {
  schemaVersion: 1;
  agentId: AlgorithmType;
  algorithm: AlgorithmType;
  status: BrainStatus;
  environmentId: string;
  environmentFingerprint: string;
  qTable: QTable | null;
  visitTable: VisitTable | null;
  hyperparameters: Hyperparameters;
  plannerConfig: PlannerConfig;
  rewardConfig: RewardConfig;
  currentEpsilon: number;
  completedEpisodes: number;
  cumulativeReward: number;
  randomSeed: number;
  lastEvaluation: EvaluationSummary | null;
  updatedAt: string;
  createdAt: string;
}

export interface BrainCheckpoint {
  schemaVersion: 1;
  id: string;
  agentId: AlgorithmType;
  environmentId: string;
  environmentFingerprint: string;
  qTable: QTable | null;
  visitTable: VisitTable | null;
  currentEpsilon: number;
  completedEpisodes: number;
  history: EpisodeRecord[];
  evaluations: CheckpointEvalRecord[];
  randomSeed: number;
  createdAt: string;
}
