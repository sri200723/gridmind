import {
  Action,
  AlgorithmType,
  CheckpointEvalRecord,
  ControlledComparisonResult,
  EnvironmentConfig,
  EpisodeRecord,
  EvaluationSummary,
  GridCoord,
  Hyperparameters,
  PlannerConfig,
  QTable,
  RewardConfig,
  StepTransition,
  VisitTable,
} from '../types/rl';
import {
  cloneQTable,
  computeGoalBasedPlan,
  createInitialQTable,
  selectEpsilonGreedyAction,
  updateQLearning,
  updateSARSA,
} from './agents';
import { coordToKey, stepEnvironment } from './environment';
import { SeededRNG } from './prng';

export function createInitialVisitTable(env: EnvironmentConfig): VisitTable {
  const visits: VisitTable = {};
  for (let r = 0; r < env.rows; r++) {
    for (let c = 0; c < env.cols; c++) {
      visits[`${r},${c}`] = 0;
    }
  }
  visits[coordToKey(env.startPos)] = 1;
  return visits;
}

export function decayEpsilon(
  currentEpsilon: number,
  epsilonDecay: number,
  epsilonMin: number
): number {
  return Number(Math.max(epsilonMin, currentEpsilon * epsilonDecay).toFixed(5));
}

export interface TrainingEpisodeOutput {
  record: EpisodeRecord;
  trajectory: GridCoord[];
  lastTransition: StepTransition | null;
  nextEpsilon: number;
}

/**
 * Runs one complete training episode for Q-Learning or SARSA, mutating qTable and visitTable in place.
 */
export function runTrainingEpisode(
  env: EnvironmentConfig,
  algorithm: 'q_learning' | 'sarsa',
  qTable: QTable,
  visitTable: VisitTable,
  episodeNumber: number,
  epsilon: number,
  hyperparams: Hyperparameters,
  rewardConfig: RewardConfig,
  rng: SeededRNG
): TrainingEpisodeOutput {
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  let state: GridCoord = { ...env.startPos };
  const collected = new Set<string>();
  const trajectory: GridCoord[] = [{ ...state }];

  let totalReward = 0;
  let steps = 0;
  let reachedGoal = false;
  let hazardHits = 0;
  let obstacleHits = 0;
  let rewardsCollected = 0;
  let lastTransition: StepTransition | null = null;

  const startKey = coordToKey(state);
  visitTable[startKey] = (visitTable[startKey] || 0) + 1;

  // For on-policy SARSA, select initial action a_0 before the step loop
  let sarsaCommittedAction: { action: Action; wasExploratory: boolean } | null =
    algorithm === 'sarsa'
      ? selectEpsilonGreedyAction(qTable, startKey, epsilon, rng)
      : null;

  for (let step = 0; step < hyperparams.maxStepsPerEpisode; step++) {
    const stateKey = coordToKey(state);
    const chosen =
      algorithm === 'sarsa' && sarsaCommittedAction
        ? sarsaCommittedAction
        : selectEpsilonGreedyAction(qTable, stateKey, epsilon, rng);

    const tr = stepEnvironment(
      env,
      state,
      chosen.action,
      rewardConfig,
      collected,
      chosen.wasExploratory
    );

    steps++;
    totalReward += tr.reward;
    if (tr.hitHazard) hazardHits++;
    if (tr.hitObstacle) obstacleHits++;
    if (tr.collectedReward) rewardsCollected++;

    visitTable[tr.nextStateKey] = (visitTable[tr.nextStateKey] || 0) + 1;

    if (algorithm === 'q_learning') {
      const upd = updateQLearning(
        qTable,
        stateKey,
        chosen.action,
        tr.reward,
        tr.nextStateKey,
        tr.done,
        hyperparams.alpha,
        hyperparams.gamma
      );
      tr.qBefore = upd.qBefore;
      tr.qAfter = upd.qAfter;
      tr.tdTarget = upd.tdTarget;
      tr.tdError = upd.tdError;
    } else {
      const nextChoice = tr.done
        ? null
        : selectEpsilonGreedyAction(qTable, tr.nextStateKey, epsilon, rng);
      const upd = updateSARSA(
        qTable,
        stateKey,
        chosen.action,
        tr.reward,
        tr.nextStateKey,
        nextChoice ? nextChoice.action : null,
        tr.done,
        hyperparams.alpha,
        hyperparams.gamma
      );
      tr.qBefore = upd.qBefore;
      tr.qAfter = upd.qAfter;
      tr.tdTarget = upd.tdTarget;
      tr.tdError = upd.tdError;
      sarsaCommittedAction = nextChoice;
    }

    state = tr.nextState;
    trajectory.push({ ...state });
    lastTransition = tr;

    if (tr.done) {
      reachedGoal = true;
      break;
    }
  }

  const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const nextEpsilon = decayEpsilon(epsilon, hyperparams.epsilonDecay, hyperparams.epsilonMin);

  return {
    record: {
      episode: episodeNumber,
      algorithm,
      totalReward: Number(totalReward.toFixed(2)),
      steps,
      reachedGoal,
      hazardHits,
      obstacleHits,
      rewardsCollected,
      epsilon: Number(epsilon.toFixed(4)),
      durationMs: Math.max(0.05, Number((endTime - startTime).toFixed(3))),
    },
    trajectory,
    lastTransition,
    nextEpsilon,
  };
}

/**
 * Pure Evaluation Engine — Evaluates a learned Q-table (greedy policy, epsilon = 0)
 * or the Hand-Designed Goal-Based Planner WITHOUT mutating any Q-values or training stats.
 */
export function evaluatePolicy(
  env: EnvironmentConfig,
  algorithm: AlgorithmType,
  qTable: QTable | null,
  rewardConfig: RewardConfig,
  plannerConfig: PlannerConfig,
  maxSteps: number = 100,
  trials: number = 5,
  seed: number = 42,
  trainingTimeMs: number | null = null,
  episodesToThreshold: number | null = null
): EvaluationSummary {
  const evalStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
  // Defensive clone so evaluation is strictly guaranteed never to mutate Q-values
  const frozenQ = qTable ? cloneQTable(qTable) : createInitialQTable(env);

  if (algorithm === 'goal_based') {
    const plan = computeGoalBasedPlan(env, rewardConfig, plannerConfig);
    const evalEnd = typeof performance !== 'undefined' ? performance.now() : Date.now();
    return {
      algorithm: 'goal_based',
      trials: 1,
      successRate: plan.reachable ? 100 : 0,
      avgReward: plan.reachable ? plan.expectedReward : 0,
      avgSteps: plan.reachable ? plan.actions.length : maxSteps,
      failureRate: plan.reachable ? 0 : 100,
      avgHazardHits: plan.hazardCount,
      episodesToThreshold: null,
      trainingTimeMs: null,
      evaluationTimeMs: Math.max(0.05, Number((evalEnd - evalStart).toFixed(3))),
      pathTaken: plan.path,
      seedUsed: seed,
    };
  }

  let successes = 0;
  let sumReward = 0;
  let sumSteps = 0;
  let sumHazards = 0;
  let samplePath: GridCoord[] = [{ ...env.startPos }];

  for (let t = 0; t < trials; t++) {
    const evalRng = new SeededRNG(seed + 1000 + t);
    let state = { ...env.startPos };
    const collected = new Set<string>();
    const path: GridCoord[] = [{ ...state }];
    let epReward = 0;
    let epSteps = 0;
    let epHazards = 0;
    let reached = false;

    for (let s = 0; s < maxSteps; s++) {
      const stateKey = coordToKey(state);
      // Strictly greedy: epsilon = 0
      const { action } = selectEpsilonGreedyAction(frozenQ, stateKey, 0, evalRng);
      const tr = stepEnvironment(env, state, action, rewardConfig, collected, false);
      epSteps++;
      epReward += tr.reward;
      if (tr.hitHazard) epHazards++;
      state = tr.nextState;
      path.push({ ...state });
      if (tr.done) {
        reached = true;
        break;
      }
    }

    if (reached) successes++;
    sumReward += epReward;
    sumSteps += epSteps;
    sumHazards += epHazards;
    if (t === 0) samplePath = path;
  }

  const evalEnd = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const successRate = Number(((successes / trials) * 100).toFixed(1));

  return {
    algorithm,
    trials,
    successRate,
    avgReward: Number((sumReward / trials).toFixed(2)),
    avgSteps: Number((sumSteps / trials).toFixed(1)),
    failureRate: Number((100 - successRate).toFixed(1)),
    avgHazardHits: Number((sumHazards / trials).toFixed(2)),
    episodesToThreshold,
    trainingTimeMs,
    evaluationTimeMs: Math.max(0.05, Number((evalEnd - evalStart).toFixed(3))),
    pathTaken: samplePath,
    seedUsed: seed,
  };
}

export function findEpisodesToThreshold(
  history: EpisodeRecord[],
  thresholdReward: number,
  windowSize: number = 10
): number | null {
  for (let i = 0; i < history.length; i++) {
    const startIdx = Math.max(0, i - windowSize + 1);
    const slice = history.slice(startIdx, i + 1);
    const avg = slice.reduce((acc, r) => acc + r.totalReward, 0) / slice.length;
    if (avg >= thresholdReward && slice.some((r) => r.reachedGoal)) {
      return history[i].episode;
    }
  }
  return null;
}

/**
 * Runs a complete Controlled & Baseline Comparison across Q-Learning, SARSA, and Goal-Based Planner
 * using identical environments, hyperparameters, episode budgets, and seeds.
 */
export function runAlgorithmComparisonExperiment(
  env: EnvironmentConfig,
  hyperparams: Hyperparameters,
  rewardConfig: RewardConfig,
  plannerConfig: PlannerConfig,
  mode: 'controlled' | 'baseline',
  thresholdReward: number = 60,
  numSeeds: number = 1
): {
  result: ControlledComparisonResult;
  trainedQLearningTable: QTable;
  trainedSarsaTable: QTable;
  qCheckpoints: CheckpointEvalRecord[];
  sarsaCheckpoints: CheckpointEvalRecord[];
} {
  const seeds: number[] = [];
  for (let i = 0; i < Math.max(1, numSeeds); i++) {
    seeds.push(hyperparams.seed + i * 17);
  }

  let primaryQHistory: EpisodeRecord[] = [];
  let primarySarsaHistory: EpisodeRecord[] = [];
  let primaryQTable: QTable = createInitialQTable(env);
  let primarySarsaTable: QTable = createInitialQTable(env);
  const qCheckpoints: CheckpointEvalRecord[] = [];
  const sarsaCheckpoints: CheckpointEvalRecord[] = [];

  const qSeedSummaries: EvaluationSummary[] = [];
  const sarsaSeedSummaries: EvaluationSummary[] = [];

  const checkpointInterval = Math.max(5, Math.floor(hyperparams.maxEpisodes / 10));

  for (let sIdx = 0; sIdx < seeds.length; sIdx++) {
    const seed = seeds[sIdx];

    // 1. Train Q-Learning with `seed`
    const qTable = createInitialQTable(env);
    const qVisits = createInitialVisitTable(env);
    const qRng = new SeededRNG(seed);
    let qEps = hyperparams.epsilonStart;
    const qHistory: EpisodeRecord[] = [];
    const qStartMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

    for (let ep = 1; ep <= hyperparams.maxEpisodes; ep++) {
      const out = runTrainingEpisode(
        env,
        'q_learning',
        qTable,
        qVisits,
        ep,
        qEps,
        hyperparams,
        rewardConfig,
        qRng
      );
      qEps = out.nextEpsilon;
      qHistory.push(out.record);

      if (sIdx === 0 && (ep === 1 || ep % checkpointInterval === 0 || ep === hyperparams.maxEpisodes)) {
        const ckEval = evaluatePolicy(
          env,
          'q_learning',
          qTable,
          rewardConfig,
          plannerConfig,
          hyperparams.maxStepsPerEpisode,
          1,
          seed
        );
        qCheckpoints.push({
          episode: ep,
          evalReward: ckEval.avgReward,
          evalSteps: ckEval.avgSteps,
          reachedGoal: ckEval.successRate === 100,
          hazardHits: ckEval.avgHazardHits,
        });
      }
    }
    const qTrainMs = Number(
      ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - qStartMs).toFixed(2)
    );
    const qEpToThresh = findEpisodesToThreshold(qHistory, thresholdReward, 10);
    const qEval = evaluatePolicy(
      env,
      'q_learning',
      qTable,
      rewardConfig,
      plannerConfig,
      hyperparams.maxStepsPerEpisode,
      5,
      seed,
      qTrainMs,
      qEpToThresh
    );
    qSeedSummaries.push(qEval);

    // 2. Train SARSA with identical `seed`
    const sTable = createInitialQTable(env);
    const sVisits = createInitialVisitTable(env);
    const sRng = new SeededRNG(seed);
    let sEps = hyperparams.epsilonStart;
    const sHistory: EpisodeRecord[] = [];
    const sStartMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

    for (let ep = 1; ep <= hyperparams.maxEpisodes; ep++) {
      const out = runTrainingEpisode(
        env,
        'sarsa',
        sTable,
        sVisits,
        ep,
        sEps,
        hyperparams,
        rewardConfig,
        sRng
      );
      sEps = out.nextEpsilon;
      sHistory.push(out.record);

      if (sIdx === 0 && (ep === 1 || ep % checkpointInterval === 0 || ep === hyperparams.maxEpisodes)) {
        const ckEval = evaluatePolicy(
          env,
          'sarsa',
          sTable,
          rewardConfig,
          plannerConfig,
          hyperparams.maxStepsPerEpisode,
          1,
          seed
        );
        sarsaCheckpoints.push({
          episode: ep,
          evalReward: ckEval.avgReward,
          evalSteps: ckEval.avgSteps,
          reachedGoal: ckEval.successRate === 100,
          hazardHits: ckEval.avgHazardHits,
        });
      }
    }
    const sTrainMs = Number(
      ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - sStartMs).toFixed(2)
    );
    const sEpToThresh = findEpisodesToThreshold(sHistory, thresholdReward, 10);
    const sEval = evaluatePolicy(
      env,
      'sarsa',
      sTable,
      rewardConfig,
      plannerConfig,
      hyperparams.maxStepsPerEpisode,
      5,
      seed,
      sTrainMs,
      sEpToThresh
    );
    sarsaSeedSummaries.push(sEval);

    if (sIdx === 0) {
      primaryQHistory = qHistory;
      primarySarsaHistory = sHistory;
      primaryQTable = qTable;
      primarySarsaTable = sTable;
    }
  }

  const aggregateSummaries = (list: EvaluationSummary[]): EvaluationSummary => {
    if (list.length === 1) return list[0];
    const n = list.length;
    const avg = (fn: (x: EvaluationSummary) => number) =>
      Number((list.reduce((a, b) => a + fn(b), 0) / n).toFixed(2));
    const validThresh = list
      .map((x) => x.episodesToThreshold)
      .filter((x): x is number => x !== null);
    return {
      ...list[0],
      trials: list.reduce((a, b) => a + b.trials, 0),
      successRate: avg((x) => x.successRate),
      avgReward: avg((x) => x.avgReward),
      avgSteps: avg((x) => x.avgSteps),
      failureRate: avg((x) => x.failureRate),
      avgHazardHits: avg((x) => x.avgHazardHits),
      trainingTimeMs: avg((x) => x.trainingTimeMs ?? 0),
      evaluationTimeMs: avg((x) => x.evaluationTimeMs),
      episodesToThreshold:
        validThresh.length > 0
          ? Math.round(validThresh.reduce((a, b) => a + b, 0) / validThresh.length)
          : null,
    };
  };

  const stdDev = (vals: number[]): number => {
    if (vals.length <= 1) return 0;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
    return Number(Math.sqrt(variance).toFixed(2));
  };

  const goalSummary = evaluatePolicy(
    env,
    'goal_based',
    null,
    rewardConfig,
    plannerConfig,
    hyperparams.maxStepsPerEpisode,
    1,
    hyperparams.seed
  );

  return {
    result: {
      mode,
      seedsUsed: seeds,
      thresholdReward,
      qLearningHistory: primaryQHistory,
      sarsaHistory: primarySarsaHistory,
      qLearningSummary: aggregateSummaries(qSeedSummaries),
      sarsaSummary: aggregateSummaries(sarsaSeedSummaries),
      goalBasedSummary: goalSummary,
      multiSeedStats:
        seeds.length > 1
          ? {
              qLearningRewardStd: stdDev(qSeedSummaries.map((s) => s.avgReward)),
              sarsaRewardStd: stdDev(sarsaSeedSummaries.map((s) => s.avgReward)),
              qLearningSuccessStd: stdDev(qSeedSummaries.map((s) => s.successRate)),
              sarsaSuccessStd: stdDev(sarsaSeedSummaries.map((s) => s.successRate)),
            }
          : undefined,
    },
    trainedQLearningTable: primaryQTable,
    trainedSarsaTable: primarySarsaTable,
    qCheckpoints,
    sarsaCheckpoints,
  };
}
