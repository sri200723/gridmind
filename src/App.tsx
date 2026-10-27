import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Award,
  BarChart3,
  BookOpen,
  Bot,
  ChevronLeft,
  ChevronRight,
  Compass,
  Cpu,
  Database,
  Download,
  FastForward,
  FlaskConical,
  GitCompare,
  Grid,
  Info,
  Layers,
  Pause,
  Play,
  RotateCcw,
  Save,
  Sliders,
  Sparkles,
  Square,
  StepForward,
  Table,
  Target,
  Upload,
  Zap,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Action,
  AgentBrainState,
  AlgorithmType,
  BrainCheckpoint,
  CheckpointEvalRecord,
  ControlledComparisonResult,
  EnvironmentConfig,
  EpisodeRecord,
  GridCoord,
  Hyperparameters,
  PlannerConfig,
  QTable,
  RewardConfig,
  SavedExperiment,
  SimulationStatus,
  StepTransition,
  VisitTable,
  VisualizationMode,
} from './types/rl';
import {
  ACTION_DELTAS,
  ALL_ACTIONS,
  DEFAULT_HYPERPARAMETERS,
  DEFAULT_PLANNER_CONFIG,
  DEFAULT_REWARD_CONFIG,
  ENVIRONMENT_PRESETS,
  cloneEnvironment,
  coordToKey,
  getAvailableActions,
  stepEnvironment,
} from './engine/environment';
import {
  computeGoalBasedPlan,
  createInitialQTable,
  getBestActions,
  getStateQValues,
  selectEpsilonGreedyAction,
  updateQLearning,
  updateSARSA,
} from './engine/agents';
import {
  createInitialVisitTable,
  decayEpsilon,
  evaluatePolicy,
  runAlgorithmComparisonExperiment,
  runTrainingEpisode,
} from './engine/training';
import { computeAnalyticsSeries } from './engine/analytics';
import {
  loadSavedExperiments,
  persistExperiments,
} from './engine/experiments';
import {
  environmentFingerprint,
  archiveAgentBrain,
  deleteExperiment,
  exportBrain,
  getStorageDiagnostics,
  importBrain,
  loadAgentBrain,
  loadEnvironment,
  loadExperiments,
  loadTrainingCheckpoint,
  saveAgentBrain,
  saveEnvironment,
  saveBrainImportBundle,
  saveTrainingCheckpoint,
  saveExperiment,
  type BrainImportBundle,
} from './engine/brainPersistence';
import { SeededRNG } from './engine/prng';
import { GridCanvas, GridOverlayMode } from './components/GridCanvas';
import { EnvironmentStudioView } from './components/EnvironmentStudioView';
import { PolicyQTableView } from './components/PolicyQTableView';
import { AnalyticsView } from './components/AnalyticsView';
import { ComparisonLabView } from './components/ComparisonLabView';
import { ExperimentsAndTestsView } from './components/ExperimentsAndTestsView';
import { LearningGuideView } from './components/LearningGuideView';
import { BrainMemoryView } from './components/BrainMemoryView';
import {
  ConfirmationDialog,
  EmptyState,
  ErrorState,
  OperationStatus,
  PageLoader,
  ToastViewport,
  type ToastMessage,
} from './components/UIStates';

type NavTabId =
  | 'overview'
  | 'environment'
  | 'train'
  | 'comparison'
  | 'policy'
  | 'analytics'
  | 'experiments'
  | 'memory'
  | 'guide';

export default function App() {
  // Navigation & Sidebar state
  const [activeTab, setActiveTab] = useState<NavTabId>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  // Core Environment, Algorithm, Hyperparameter & Reward State
  const [activePresetId, setActivePresetId] = useState<string>(ENVIRONMENT_PRESETS[2].id); // Hazardous Grid default
  const [env, setEnv] = useState<EnvironmentConfig>(() =>
    cloneEnvironment(ENVIRONMENT_PRESETS[2])
  );
  const [algorithm, setAlgorithm] = useState<AlgorithmType>('q_learning');
  const [hyperparams, setHyperparams] = useState<Hyperparameters>({
    ...DEFAULT_HYPERPARAMETERS,
  });
  const [rewardConfig, setRewardConfig] = useState<RewardConfig>({
    ...DEFAULT_REWARD_CONFIG,
  });
  const [plannerConfig, setPlannerConfig] = useState<PlannerConfig>({
    ...DEFAULT_PLANNER_CONFIG,
  });

  // Separate Q-tables & visit tables for Q-Learning and SARSA so switching/inspecting preserves both
  const [qLearningTable, setQLearningTable] = useState<QTable>(() =>
    createInitialQTable(ENVIRONMENT_PRESETS[2])
  );
  const [sarsaTable, setSarsaTable] = useState<QTable>(() =>
    createInitialQTable(ENVIRONMENT_PRESETS[2])
  );
  const [qLearningVisits, setQLearningVisits] = useState<VisitTable>(() =>
    createInitialVisitTable(ENVIRONMENT_PRESETS[2])
  );
  const [sarsaVisits, setSarsaVisits] = useState<VisitTable>(() =>
    createInitialVisitTable(ENVIRONMENT_PRESETS[2])
  );

  // Live Simulation & Step Telemetry State
  const [simStatus, setSimStatus] = useState<SimulationStatus>('Idle');
  const [vizMode, setVizMode] = useState<VisualizationMode>('training');
  const [isDemoBannerActive, setIsDemoBannerActive] = useState<boolean>(false);
  const [gridOverlay, setGridOverlay] = useState<GridOverlayMode>('policy_arrows');

  const [currentEpisode, setCurrentEpisode] = useState<number>(0);
  const [currentEpsilon, setCurrentEpsilon] = useState<number>(
    DEFAULT_HYPERPARAMETERS.epsilonStart
  );
  const [agentPos, setAgentPos] = useState<GridCoord>(() => ({
    ...ENVIRONMENT_PRESETS[2].startPos,
  }));
  const [episodeTrail, setEpisodeTrail] = useState<GridCoord[]>(() => [
    { ...ENVIRONMENT_PRESETS[2].startPos },
  ]);
  const [episodeReward, setEpisodeReward] = useState<number>(0);
  const [episodeSteps, setEpisodeSteps] = useState<number>(0);
  const [episodeHazardHits, setEpisodeHazardHits] = useState<number>(0);
  const [episodeObstacleHits, setEpisodeObstacleHits] = useState<number>(0);
  const [episodeBonuses, setEpisodeBonuses] = useState<number>(0);
  const [lastTransition, setLastTransition] = useState<StepTransition | null>(null);

  // Recorded Episode Histories & Checkpoints
  const [episodeHistory, setEpisodeHistory] = useState<EpisodeRecord[]>([]);
  const [checkpoints, setCheckpoints] = useState<CheckpointEvalRecord[]>([]);
  const [comparisonResult, setComparisonResult] =
    useState<ControlledComparisonResult | null>(null);

  // Policy Explorer inspected algorithm
  const [inspectedTableAlg, setInspectedTableAlg] = useState<'q_learning' | 'sarsa'>(
    'q_learning'
  );

  // Saved Experiments Registry
  const [savedExperiments, setSavedExperiments] = useState<SavedExperiment[]>(() =>
    loadSavedExperiments()
  );
  const [brainStates, setBrainStates] = useState<
    Partial<Record<AlgorithmType, AgentBrainState | null>>
  >({});
  const [brainCheckpoints, setBrainCheckpoints] = useState<
    Partial<Record<AlgorithmType, BrainCheckpoint | null>>
  >({});
  const [storageMessage, setStorageMessage] = useState(
    getStorageDiagnostics().message
  );
  const [restorationMessage, setRestorationMessage] = useState('');
  const [isMemoryReady, setIsMemoryReady] = useState(false);
  const [restoreError, setRestoreError] = useState('');
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    destructive?: boolean;
    onConfirm: () => void;
  } | null>(null);
  const [isSavingBrain, setIsSavingBrain] = useState(false);
  const [isImportingBrain, setIsImportingBrain] = useState(false);
  const saveTimerRef = useRef<number | null>(null);

  const notify = (kind: ToastMessage['kind'], message: string) => {
    setToast({ id: Date.now(), kind, message });
  };

  // Mutable refs for incremental step state (collected rewards per episode, SARSA committed next action, PRNG)
  const collectedRewardsRef = useRef<Set<string>>(new Set());
  const sarsaCommittedRef = useRef<{ action: Action; wasExploratory: boolean } | null>(
    null
  );
  const rngRef = useRef<SeededRNG>(new SeededRNG(DEFAULT_HYPERPARAMETERS.seed));
  const stepStartMsRef = useRef<number>(Date.now());
  const previousSimStatusRef = useRef<SimulationStatus>(simStatus);
  const batchInputCountRef = useRef<number>(50);
  const [batchEpisodesCount, setBatchEpisodesCount] = useState<number>(50);

  // Computed Goal-Based Plan for current environment & reward settings
  const goalPlan = computeGoalBasedPlan(env, rewardConfig, plannerConfig);

  // Active Q-table & visits based on selected algorithm
  const activeQTable =
    algorithm === 'sarsa' ? sarsaTable : qLearningTable;
  const activeVisits =
    algorithm === 'sarsa' ? sarsaVisits : qLearningVisits;

  // Reset training state helper
  const handleResetTraining = (targetEnv: EnvironmentConfig = env, newSeed?: number) => {
    setSimStatus('Idle');
    setIsDemoBannerActive(false);
    const seedToUse = newSeed ?? hyperparams.seed;
    rngRef.current = new SeededRNG(seedToUse);
    collectedRewardsRef.current = new Set();
    sarsaCommittedRef.current = null;

    setQLearningTable(createInitialQTable(targetEnv));
    setSarsaTable(createInitialQTable(targetEnv));
    setQLearningVisits(createInitialVisitTable(targetEnv));
    setSarsaVisits(createInitialVisitTable(targetEnv));

    setCurrentEpisode(0);
    setCurrentEpsilon(hyperparams.epsilonStart);
    setAgentPos({ ...targetEnv.startPos });
    setEpisodeTrail([{ ...targetEnv.startPos }]);
    setEpisodeReward(0);
    setEpisodeSteps(0);
    setEpisodeHazardHits(0);
    setEpisodeObstacleHits(0);
    setEpisodeBonuses(0);
    setLastTransition(null);
    setEpisodeHistory([]);
    setCheckpoints([]);
  };

  const handleRequestTrainingReset = () => {
    if (currentEpisode === 0 && episodeHistory.length === 0) {
      handleResetTraining(env);
      return;
    }
    setConfirmation({
      title: 'Reset this training session?',
      description: 'This clears the current in-memory Q-tables, counters, and episode history for the selected run. The next autosave will save a fresh brain for this environment; export a backup first if you need the current model.',
      confirmLabel: 'Reset Training',
      destructive: true,
      onConfirm: () => {
        handleResetTraining(env);
        notify('warning', 'Training was reset. The selected agent starts fresh on this environment.');
      },
    });
  };

  // Reset agent position only (without erasing learned Q-table)
  const handleResetAgentPosition = () => {
    collectedRewardsRef.current = new Set();
    sarsaCommittedRef.current = null;
    setAgentPos({ ...env.startPos });
    setEpisodeTrail([{ ...env.startPos }]);
    setEpisodeReward(0);
    setEpisodeSteps(0);
    setEpisodeHazardHits(0);
    setEpisodeObstacleHits(0);
    setEpisodeBonuses(0);
    setLastTransition(null);
  };

  // Update environment and reset Q-tables to fit new dimensions/topology
  const handleUpdateEnvironment = (newEnv: EnvironmentConfig) => {
    const cloned = cloneEnvironment(newEnv);
    if (isMemoryReady && algorithm !== 'goal_based' && currentEpisode > 0) {
      void archiveAgentBrain(
        buildBrainState(
          algorithm,
          algorithm === 'q_learning' ? qLearningTable : sarsaTable,
          algorithm === 'q_learning' ? qLearningVisits : sarsaVisits,
          currentEpsilon,
          currentEpisode
        )
      ).catch(() => {
        setStorageMessage('The previous brain could not be archived before changing environments.');
      });
    }
    if (ENVIRONMENT_PRESETS.some((p) => p.id === cloned.id)) {
      setActivePresetId(cloned.id);
    }
    setEnv(cloned);
    handleResetTraining(cloned);
    setRestorationMessage(
      'Environment changed. The previous brain remains archived under its original environment fingerprint.'
    );
  };

  const handleRestorePresetEnvironment = () => {
    const found =
      ENVIRONMENT_PRESETS.find((p) => p.id === activePresetId) ??
      ENVIRONMENT_PRESETS[2];
    handleUpdateEnvironment(found);
  };

  // Execute a single step in Training or Evaluation mode
  const handleExecuteSingleStep = () => {
    setIsDemoBannerActive(false);

    // Goal-based agent or Evaluation Mode: step without modifying Q-tables or training history
    if (algorithm === 'goal_based' || vizMode === 'evaluation') {
      const stateKey = coordToKey(agentPos);
      let chosenAction: Action = 'RIGHT';

      if (algorithm === 'goal_based') {
        const dynamicPlan = computeGoalBasedPlan(
          env,
          rewardConfig,
          plannerConfig,
          agentPos
        );
        chosenAction = dynamicPlan.actions[0] ?? 'RIGHT';
      } else {
        const evalSelection = selectEpsilonGreedyAction(
          activeQTable,
          stateKey,
          0,
          rngRef.current
        );
        chosenAction = evalSelection.action;
      }

      const tr = stepEnvironment(
        env,
        agentPos,
        chosenAction,
        rewardConfig,
        collectedRewardsRef.current,
        false
      );

      const nextSteps = episodeSteps + 1;
      setAgentPos(tr.nextState);
      setEpisodeTrail((prev) => [...prev, tr.nextState]);
      setEpisodeReward((prev) => Number((prev + tr.reward).toFixed(2)));
      setEpisodeSteps(nextSteps);
      if (tr.hitHazard) setEpisodeHazardHits((h) => h + 1);
      if (tr.hitObstacle) setEpisodeObstacleHits((o) => o + 1);
      if (tr.collectedReward) setEpisodeBonuses((b) => b + 1);
      setLastTransition(tr);

      if (tr.done || nextSteps >= hyperparams.maxStepsPerEpisode) {
        if (simStatus === 'Training') {
          setSimStatus('Completed');
        }
        setTimeout(() => {
          collectedRewardsRef.current = new Set();
          setAgentPos({ ...env.startPos });
          setEpisodeTrail([{ ...env.startPos }]);
          setEpisodeReward(0);
          setEpisodeSteps(0);
        }, 350);
      }
      return;
    }

    // Training Mode step for Q-Learning or SARSA
    if (episodeSteps === 0) {
      stepStartMsRef.current =
        typeof performance !== 'undefined' ? performance.now() : Date.now();
    }

    const workingQ: QTable = JSON.parse(
      JSON.stringify(algorithm === 'q_learning' ? qLearningTable : sarsaTable)
    );
    const workingVisits: VisitTable = {
      ...(algorithm === 'q_learning' ? qLearningVisits : sarsaVisits),
    };

    const stateKey = coordToKey(agentPos);
    const chosen =
      algorithm === 'sarsa' && sarsaCommittedRef.current
        ? sarsaCommittedRef.current
        : selectEpsilonGreedyAction(
            workingQ,
            stateKey,
            currentEpsilon,
            rngRef.current
          );

    const tr = stepEnvironment(
      env,
      agentPos,
      chosen.action,
      rewardConfig,
      collectedRewardsRef.current,
      chosen.wasExploratory
    );

    workingVisits[tr.nextStateKey] = (workingVisits[tr.nextStateKey] || 0) + 1;

    if (algorithm === 'q_learning') {
      const upd = updateQLearning(
        workingQ,
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
        : selectEpsilonGreedyAction(
            workingQ,
            tr.nextStateKey,
            currentEpsilon,
            rngRef.current
          );
      const upd = updateSARSA(
        workingQ,
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
      sarsaCommittedRef.current = nextChoice;
    }

    if (algorithm === 'q_learning') {
      setQLearningTable(workingQ);
      setQLearningVisits(workingVisits);
      setInspectedTableAlg('q_learning');
    } else {
      setSarsaTable(workingQ);
      setSarsaVisits(workingVisits);
      setInspectedTableAlg('sarsa');
    }

    const newSteps = episodeSteps + 1;
    const newReward = Number((episodeReward + tr.reward).toFixed(2));
    const newHazards = episodeHazardHits + (tr.hitHazard ? 1 : 0);
    const newObstacles = episodeObstacleHits + (tr.hitObstacle ? 1 : 0);
    const newBonuses = episodeBonuses + (tr.collectedReward ? 1 : 0);

    setLastTransition(tr);

    // Check if episode finished (Goal reached or Max Steps timeout)
    if (tr.done || newSteps >= hyperparams.maxStepsPerEpisode) {
      const nowMs =
        typeof performance !== 'undefined' ? performance.now() : Date.now();
      const epNum = currentEpisode + 1;
      const rec: EpisodeRecord = {
        episode: epNum,
        algorithm,
        totalReward: newReward,
        steps: newSteps,
        reachedGoal: tr.done,
        hazardHits: newHazards,
        obstacleHits: newObstacles,
        rewardsCollected: newBonuses,
        epsilon: Number(currentEpsilon.toFixed(4)),
        durationMs: Math.max(0.1, Number((nowMs - stepStartMsRef.current).toFixed(2))),
      };

      const nextEps = decayEpsilon(
        currentEpsilon,
        hyperparams.epsilonDecay,
        hyperparams.epsilonMin
      );

      setEpisodeHistory((prev) => [...prev, rec]);
      setCurrentEpisode(epNum);
      setCurrentEpsilon(nextEps);

      if (epNum === 1 || epNum % 15 === 0 || epNum >= hyperparams.maxEpisodes) {
        const ck = evaluatePolicy(
          env,
          algorithm,
          workingQ,
          rewardConfig,
          plannerConfig,
          hyperparams.maxStepsPerEpisode,
          1,
          hyperparams.seed
        );
        setCheckpoints((prev) => [
          ...prev,
          {
            episode: epNum,
            evalReward: ck.avgReward,
            evalSteps: ck.avgSteps,
            reachedGoal: ck.successRate === 100,
            hazardHits: ck.avgHazardHits,
          },
        ]);
      }

      // Reset for next episode
      collectedRewardsRef.current = new Set();
      sarsaCommittedRef.current = null;
      setAgentPos({ ...env.startPos });
      setEpisodeTrail([{ ...env.startPos }]);
      setEpisodeReward(0);
      setEpisodeSteps(0);
      setEpisodeHazardHits(0);
      setEpisodeObstacleHits(0);
      setEpisodeBonuses(0);

      if (epNum >= hyperparams.maxEpisodes) {
        setSimStatus('Completed');
      }
    } else {
      setAgentPos(tr.nextState);
      setEpisodeTrail((prev) => [...prev, tr.nextState]);
      setEpisodeReward(newReward);
      setEpisodeSteps(newSteps);
      setEpisodeHazardHits(newHazards);
      setEpisodeObstacleHits(newObstacles);
      setEpisodeBonuses(newBonuses);
    }
  };

  // Run N full training episodes synchronously or incrementally
  const handleRunBatchEpisodes = (count: number) => {
    setIsDemoBannerActive(false);

    if (algorithm === 'goal_based') {
      // Goal-based agent doesn't train; run its planned path visualization
      setVizMode('evaluation');
      setEpisodeTrail(goalPlan.path);
      setAgentPos(
        goalPlan.path.length > 0
          ? goalPlan.path[goalPlan.path.length - 1]
          : env.startPos
      );
      setEpisodeReward(goalPlan.expectedReward);
      setEpisodeSteps(goalPlan.actions.length);
      setSimStatus('Completed');
      return;
    }

    const workingQ: QTable = JSON.parse(
      JSON.stringify(algorithm === 'q_learning' ? qLearningTable : sarsaTable)
    );
    const workingVisits: VisitTable = {
      ...(algorithm === 'q_learning' ? qLearningVisits : sarsaVisits),
    };

    let eps = currentEpsilon;
    let epNum = currentEpisode;
    const newRecords: EpisodeRecord[] = [];
    const newCheckpoints: CheckpointEvalRecord[] = [];
    let lastTraj: GridCoord[] = [{ ...env.startPos }];
    let lastTr: StepTransition | null = lastTransition;

    for (let i = 0; i < count; i++) {
      epNum++;
      const out = runTrainingEpisode(
        env,
        algorithm,
        workingQ,
        workingVisits,
        epNum,
        eps,
        hyperparams,
        rewardConfig,
        rngRef.current
      );
      eps = out.nextEpsilon;
      newRecords.push(out.record);
      lastTraj = out.trajectory;
      if (out.lastTransition) lastTr = out.lastTransition;

      if (epNum === 1 || epNum % 15 === 0 || i === count - 1) {
        const ck = evaluatePolicy(
          env,
          algorithm,
          workingQ,
          rewardConfig,
          plannerConfig,
          hyperparams.maxStepsPerEpisode,
          1,
          hyperparams.seed
        );
        newCheckpoints.push({
          episode: epNum,
          evalReward: ck.avgReward,
          evalSteps: ck.avgSteps,
          reachedGoal: ck.successRate === 100,
          hazardHits: ck.avgHazardHits,
        });
      }
    }

    if (algorithm === 'q_learning') {
      setQLearningTable(workingQ);
      setQLearningVisits(workingVisits);
      setInspectedTableAlg('q_learning');
    } else {
      setSarsaTable(workingQ);
      setSarsaVisits(workingVisits);
      setInspectedTableAlg('sarsa');
    }

    setEpisodeHistory((prev) => [...prev, ...newRecords]);
    setCheckpoints((prev) => [...prev, ...newCheckpoints]);
    setCurrentEpisode(epNum);
    setCurrentEpsilon(eps);
    setEpisodeTrail(lastTraj);
    setAgentPos(
      lastTraj.length > 0 ? lastTraj[lastTraj.length - 1] : env.startPos
    );
    const latestRec = newRecords[newRecords.length - 1];
    if (latestRec) {
      setEpisodeReward(latestRec.totalReward);
      setEpisodeSteps(latestRec.steps);
    }
    setLastTransition(lastTr);
    if (epNum >= hyperparams.maxEpisodes) {
      setSimStatus('Completed');
    }
  };

  // Continuous simulation timer loop when simStatus === 'Training'
  useEffect(() => {
    if (simStatus !== 'Training') return;

    if (currentEpisode >= hyperparams.maxEpisodes && vizMode === 'training' && algorithm !== 'goal_based') {
      setSimStatus('Completed');
      return;
    }

    const delayMap: Record<number, number> = {
      1: 360,
      2: 160,
      3: 75,
      4: 45,
      5: 25,
    };
    const intervalMs = delayMap[hyperparams.speed] ?? 90;

    const timer = setInterval(() => {
      if (hyperparams.speed === 4 && vizMode === 'training' && algorithm !== 'goal_based') {
        handleRunBatchEpisodes(1);
      } else if (hyperparams.speed === 5 && vizMode === 'training' && algorithm !== 'goal_based') {
        handleRunBatchEpisodes(5);
      } else {
        handleExecuteSingleStep();
      }
    }, intervalMs);

    return () => clearInterval(timer);
  });

  useEffect(() => {
    if (previousSimStatusRef.current === 'Training' && simStatus === 'Completed') {
      notify('success', 'Training completed.');
    }
    previousSimStatusRef.current = simStatus;
  }, [simStatus]);

  // Load Preconfigured Demo Mode (instantly populates trained Hazardous Grid Q-Learning vs SARSA comparison)
  const handleLoadDemonstrationMode = () => {
    setSimStatus('Paused');
    const demoEnv = cloneEnvironment(ENVIRONMENT_PRESETS[2]); // Hazardous Grid
    setEnv(demoEnv);
    setActivePresetId(demoEnv.id);
    const demoHyper: Hyperparameters = {
      ...DEFAULT_HYPERPARAMETERS,
      alpha: 0.25,
      gamma: 0.95,
      epsilonStart: 1.0,
      epsilonMin: 0.05,
      epsilonDecay: 0.985,
      maxEpisodes: 200,
      maxStepsPerEpisode: 100,
      speed: 3,
      seed: 42,
    };
    setHyperparams(demoHyper);
    setAlgorithm('q_learning');

    const comp = runAlgorithmComparisonExperiment(
      demoEnv,
      demoHyper,
      rewardConfig,
      plannerConfig,
      'baseline',
      60,
      1
    );

    setQLearningTable(comp.trainedQLearningTable);
    setSarsaTable(comp.trainedSarsaTable);
    setEpisodeHistory(comp.result.qLearningHistory);
    setCheckpoints(comp.qCheckpoints);
    setComparisonResult(comp.result);
    setCurrentEpisode(demoHyper.maxEpisodes);
    setCurrentEpsilon(
      comp.result.qLearningHistory[comp.result.qLearningHistory.length - 1]?.epsilon ?? 0.05
    );
    setEpisodeTrail(comp.result.qLearningSummary.pathTaken);
    setAgentPos(demoEnv.goalPos);
    setSimStatus('Completed');
    setIsDemoBannerActive(true);
  };

  // Run Controlled / Baseline Comparison in Comparison Lab
  const handleRunComparison = (
    mode: 'controlled' | 'baseline',
    thresholdReward: number,
    numSeeds: number
  ) => {
    setSimStatus('Paused');
    const comp = runAlgorithmComparisonExperiment(
      env,
      hyperparams,
      rewardConfig,
      plannerConfig,
      mode,
      thresholdReward,
      numSeeds
    );
    setComparisonResult(comp.result);
    setQLearningTable(comp.trainedQLearningTable);
    setSarsaTable(comp.trainedSarsaTable);
    if (episodeHistory.length === 0) {
      setEpisodeHistory(comp.result.qLearningHistory);
      setCheckpoints(comp.qCheckpoints);
      setCurrentEpisode(comp.result.qLearningHistory.length);
    }
  };

  // Compute live KPI summary metrics from actual state
  const analyticsSeries = computeAnalyticsSeries(episodeHistory, 15);
  const latestMetric =
    analyticsSeries.length > 0
      ? analyticsSeries[analyticsSeries.length - 1]
      : null;

  const latestEvalSummary = evaluatePolicy(
    env,
    algorithm,
    activeQTable,
    rewardConfig,
    plannerConfig,
    hyperparams.maxStepsPerEpisode,
    3,
    hyperparams.seed,
    episodeHistory.reduce((a, b) => a + b.durationMs, 0),
    null
  );

  const avgRewardDisplay = latestMetric
    ? latestMetric.movingAvgReward
    : algorithm === 'goal_based'
    ? goalPlan.expectedReward
    : 0;

  const successRateDisplay = latestMetric
    ? latestMetric.rollingSuccessRate
    : algorithm === 'goal_based'
    ? goalPlan.reachable
      ? 100
      : 0
    : 0;

  const avgStepsDisplay = latestMetric
    ? latestMetric.rollingAvgSteps
    : algorithm === 'goal_based'
    ? goalPlan.actions.length
    : episodeSteps;

  const currentStateKey = coordToKey(agentPos);
  const currentStateQ = getStateQValues(activeQTable, currentStateKey);
  const currentAvailableActions = getAvailableActions(env, agentPos);
  const currentBestActions =
    ALL_ACTIONS.some((a) => Math.abs(currentStateQ[a]) > 1e-6)
      ? getBestActions(activeQTable, currentStateKey)
      : [];

  // Save/Load/Delete Experiment Handlers
  const handleSaveExperiment = (exp: SavedExperiment) => {
    const next = [exp, ...savedExperiments];
    try {
      persistExperiments(next);
      setSavedExperiments(next);
      void saveExperiment(exp)
        .then(() => notify('success', 'Experiment saved successfully.'))
        .catch((error: unknown) => {
          console.error('Unable to persist experiment in IndexedDB', error);
          notify('warning', 'Experiment is available in this browser session, but could not be saved to IndexedDB.');
        });
    } catch (error) {
      console.error('Unable to save experiment', error);
      notify('error', 'Unable to save this experiment. Your current setup is unchanged.');
    }
  };

  const handleDeleteExperiment = (id: string) => {
    const target = savedExperiments.find((experiment) => experiment.id === id);
    if (!target) return;
    setConfirmation({
      title: 'Delete this experiment?',
      description: `“${target.name}” will be removed from this browser’s saved experiment list.`,
      confirmLabel: 'Delete Experiment',
      destructive: true,
      onConfirm: async () => {
        const next = savedExperiments.filter((experiment) => experiment.id !== id);
        try {
          await deleteExperiment(id);
          setSavedExperiments(next);
          try {
            persistExperiments(next);
            notify('success', 'Experiment deleted.');
          } catch (error) {
            console.error('Unable to update the local experiment cache after deletion', error);
            notify('warning', 'Experiment deleted from persistent storage, but the local cache could not be updated.');
          }
        } catch (error) {
          console.error('Unable to delete experiment', error);
          notify('error', 'Unable to delete this experiment.');
        }
      },
    });
  };

  const handleLoadExperiment = (exp: SavedExperiment) => {
    setSimStatus('Paused');
    const loadedEnv = cloneEnvironment(exp.environment);
    setEnv(loadedEnv);
    setAlgorithm(exp.algorithm);
    setHyperparams({ ...exp.hyperparameters });
    setRewardConfig({ ...exp.rewardConfig });
    setPlannerConfig({ ...exp.plannerConfig });
    handleResetTraining(loadedEnv, exp.hyperparameters.seed);

    if (exp.kind === 'completed_run' && exp.episodesCompleted > 0 && exp.algorithm !== 'goal_based') {
      // Deterministically replay or restore the saved run
      const replayQ = createInitialQTable(loadedEnv);
      const replayVisits = createInitialVisitTable(loadedEnv);
      const replayRng = new SeededRNG(exp.hyperparameters.seed);
      let eps = exp.hyperparameters.epsilonStart;
      const records: EpisodeRecord[] = [];
      for (let i = 1; i <= exp.episodesCompleted; i++) {
        const out = runTrainingEpisode(
          loadedEnv,
          exp.algorithm,
          replayQ,
          replayVisits,
          i,
          eps,
          exp.hyperparameters,
          exp.rewardConfig,
          replayRng
        );
        eps = out.nextEpsilon;
        records.push(out.record);
      }
      if (exp.algorithm === 'q_learning') {
        setQLearningTable(replayQ);
        setQLearningVisits(replayVisits);
      } else {
        setSarsaTable(replayQ);
        setSarsaVisits(replayVisits);
      }
      setEpisodeHistory(records);
      setCurrentEpisode(exp.episodesCompleted);
      setCurrentEpsilon(eps);
      setSimStatus('Completed');
      setIsDemoBannerActive(Boolean(exp.isDemo));
    }
    setActiveTab('overview');
  };

  const buildBrainState = (
    agentId: AlgorithmType,
    qTable: QTable | null,
    visitTable: VisitTable | null,
    epsilon: number,
    episodes: number,
    evaluation: ReturnType<typeof evaluatePolicy> | null = null
  ): AgentBrainState => {
    const now = new Date().toISOString();
    const previous = brainStates[agentId];
    return {
      schemaVersion: 1,
      agentId,
      algorithm: agentId,
      status: episodes > 0 ? (previous?.status === 'Restored' ? 'Restored' : 'Trained') : 'Fresh',
      environmentId: env.id,
      environmentFingerprint: environmentFingerprint(env),
      qTable,
      visitTable,
      hyperparameters: { ...hyperparams },
      plannerConfig: { ...plannerConfig },
      rewardConfig: { ...rewardConfig },
      currentEpsilon: epsilon,
      completedEpisodes: episodes,
      cumulativeReward: episodeHistory
        .filter(
          (record) =>
            record.algorithm === agentId && record.episode <= episodes
        )
        .reduce((sum, record) => sum + record.totalReward, 0),
      randomSeed: hyperparams.seed,
      lastEvaluation: evaluation ?? previous?.lastEvaluation ?? null,
      updatedAt: now,
      createdAt: previous?.createdAt ?? now,
    };
  };

  const persistBrainSnapshot = async (
    agentId: 'q_learning' | 'sarsa',
    qTable: QTable,
    visitTable: VisitTable,
    epsilon: number,
    episodes: number,
    history: EpisodeRecord[],
    checkpointHistory: CheckpointEvalRecord[],
    evaluation: ReturnType<typeof evaluatePolicy> | null = null,
    notifyOnResult = false
  ) => {
    const brain = buildBrainState(agentId, qTable, visitTable, epsilon, episodes, evaluation);
    const checkpoint: BrainCheckpoint = {
      schemaVersion: 1,
      id: `${agentId}-${env.id}-${episodes}-${Date.now()}`,
      agentId,
      environmentId: env.id,
      environmentFingerprint: environmentFingerprint(env),
      qTable,
      visitTable,
      currentEpsilon: epsilon,
      completedEpisodes: episodes,
      history: history.filter(
        (record) =>
          record.algorithm === agentId && record.episode <= episodes
      ),
      evaluations: checkpointHistory.filter(
        (record) => record.episode <= episodes
      ),
      randomSeed: hyperparams.seed,
      createdAt: new Date().toISOString(),
    };
    try {
      await Promise.all([
        saveEnvironment(env),
        saveAgentBrain(agentId, brain),
        saveTrainingCheckpoint(checkpoint),
      ]);
      setBrainStates((previous) => ({ ...previous, [agentId]: brain }));
      setBrainCheckpoints((previous) => ({ ...previous, [agentId]: checkpoint }));
      setStorageMessage('Memory saved to IndexedDB.');
      if (notifyOnResult) notify('success', 'Brain saved successfully.');
      return true;
    } catch (error) {
      console.error(`Unable to save ${agentId} brain`, error);
      setStorageMessage(
        'Unable to save your progress. The latest changes may not survive a browser restart.'
      );
      if (notifyOnResult) notify('error', 'Unable to save your progress. Retry or export a backup.');
      return false;
    }
  };

  const handleSaveBrain = async (showToast = true) => {
    if (isSavingBrain) return;
    setIsSavingBrain(true);
    if (algorithm === 'goal_based') {
      const brain = buildBrainState('goal_based', null, null, 0, 0);
      try {
        await saveAgentBrain('goal_based', brain);
          setBrainStates((previous) => ({ ...previous, goal_based: brain }));
          setStorageMessage('Planner configuration saved to IndexedDB.');
        if (showToast) notify('success', 'Planner configuration saved.');
      } catch (error) {
        console.error('Unable to save planner configuration', error);
        setStorageMessage('Unable to save the planner configuration.');
        if (showToast) notify('error', 'Unable to save the planner configuration.');
      } finally {
        setIsSavingBrain(false);
      }
      return;
    }
    try {
      await persistBrainSnapshot(
        algorithm,
        algorithm === 'q_learning' ? qLearningTable : sarsaTable,
        algorithm === 'q_learning' ? qLearningVisits : sarsaVisits,
        currentEpsilon,
        currentEpisode,
        episodeHistory,
        checkpoints,
        null,
        showToast
      );
    } finally {
      setIsSavingBrain(false);
    }
  };

  const handleEvaluateBrain = () => {
    const evaluation = evaluatePolicy(
      env,
      algorithm,
      algorithm === 'goal_based' ? null : activeQTable,
      rewardConfig,
      plannerConfig,
      hyperparams.maxStepsPerEpisode,
      algorithm === 'goal_based' ? 1 : 5,
      hyperparams.seed
    );
    setVizMode('evaluation');
    setActiveTab('overview');
    setRestorationMessage(
      `${algorithm === 'goal_based' ? 'Planner route' : 'Learned brain'} evaluated greedily: ${evaluation.successRate}% success. Training data was not modified.`
    );
    notify('success', `Evaluation completed: ${evaluation.successRate}% success.`);
    if (algorithm === 'goal_based') {
      const brain = buildBrainState('goal_based', null, null, 0, 0, evaluation);
      void saveAgentBrain('goal_based', brain).then(() => {
        setBrainStates((previous) => ({ ...previous, goal_based: brain }));
      });
    } else {
      void persistBrainSnapshot(
        algorithm,
        algorithm === 'q_learning' ? qLearningTable : sarsaTable,
        algorithm === 'q_learning' ? qLearningVisits : sarsaVisits,
        currentEpsilon,
        currentEpisode,
        episodeHistory,
        checkpoints,
        evaluation
      );
    }
  };

  const handleResumeLearning = () => {
    setVizMode('training');
    if (algorithm !== 'goal_based' && currentEpisode >= hyperparams.maxEpisodes) {
      setHyperparams((current) => ({ ...current, maxEpisodes: current.maxEpisodes + 100 }));
    }
    setSimStatus('Training');
    setRestorationMessage(
      algorithm === 'goal_based'
        ? 'Planner route execution started; the planner does not train a Q-table.'
        : 'Resuming learning from the current Q-table and episode counter.'
    );
  };

  const handleSelectAlgorithm = (nextAlgorithm: AlgorithmType) => {
    setAlgorithm(nextAlgorithm);
    const brain = brainStates[nextAlgorithm];
    const checkpoint = brainCheckpoints[nextAlgorithm];
    if (brain && checkpoint && brain.environmentFingerprint === environmentFingerprint(env)) {
      setHyperparams({ ...brain.hyperparameters });
      setRewardConfig({ ...brain.rewardConfig });
      setPlannerConfig({ ...brain.plannerConfig });
      if (nextAlgorithm === 'q_learning' && brain.qTable && brain.visitTable) {
        setQLearningTable(brain.qTable);
        setQLearningVisits(brain.visitTable);
      } else if (nextAlgorithm === 'sarsa' && brain.qTable && brain.visitTable) {
        setSarsaTable(brain.qTable);
        setSarsaVisits(brain.visitTable);
      }
      setCurrentEpisode(brain.completedEpisodes);
      setCurrentEpsilon(brain.currentEpsilon);
      setEpisodeHistory(checkpoint.history);
      setCheckpoints(checkpoint.evaluations);
      setRestorationMessage(`${nextAlgorithm === 'goal_based' ? 'Planner' : nextAlgorithm === 'q_learning' ? 'Q-Learning' : 'SARSA'} brain selected — ${brain.completedEpisodes} episodes available.`);
    } else if (brain) {
      setRestorationMessage('A saved brain exists for another environment. It was preserved and is not attached to this grid.');
    }
  };

  const handleExportBrain = () => {
    try {
      const currentBrain = buildBrainState(
        algorithm,
        algorithm === 'goal_based' ? null : activeQTable,
        algorithm === 'goal_based' ? null : activeVisits,
        algorithm === 'goal_based' ? 0 : currentEpsilon,
        algorithm === 'goal_based' ? 0 : currentEpisode
      );
      const bundle: BrainImportBundle = {
        schemaVersion: 1,
        brain: currentBrain,
        environment: cloneEnvironment(env),
        checkpoint: brainCheckpoints[algorithm] ?? undefined,
      };
      const blob = new Blob([exportBrain(bundle)], { type: 'application/json' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = `${algorithm}-brain-${env.id}.json`;
      link.click();
      URL.revokeObjectURL(url);
      notify('success', 'Brain export downloaded.');
    } catch (error) {
      console.error('Unable to export brain', error);
      notify('error', 'Unable to export this brain.');
    }
  };

  const handleImportBrain = async (file: File) => {
    if (isImportingBrain) return;
    setIsImportingBrain(true);
    try {
      const bundle = await importBrain(file);
      setConfirmation({
        title: 'Replace saved brain with this import?',
        description: `Importing ${bundle.brain.algorithm} for ${bundle.environment.name} replaces that agent’s saved brain and associated checkpoint.`,
        confirmLabel: 'Import Brain',
        destructive: true,
        onConfirm: async () => {
          try {
            await saveBrainImportBundle(bundle);
            setBrainStates((previous) => ({ ...previous, [bundle.brain.agentId]: bundle.brain }));
            if (bundle.checkpoint) {
              setBrainCheckpoints((previous) => ({ ...previous, [bundle.brain.agentId]: bundle.checkpoint }));
            }
            if (bundle.brain.agentId === 'q_learning' || bundle.brain.agentId === 'sarsa') {
              setEnv(cloneEnvironment(bundle.environment));
              setHyperparams({ ...bundle.brain.hyperparameters });
              setRewardConfig({ ...bundle.brain.rewardConfig });
              setPlannerConfig({ ...bundle.brain.plannerConfig });
              setCurrentEpisode(bundle.brain.completedEpisodes);
              setCurrentEpsilon(bundle.brain.currentEpsilon);
              if (bundle.brain.agentId === 'q_learning' && bundle.brain.qTable && bundle.brain.visitTable) {
                setQLearningTable(bundle.brain.qTable);
                setQLearningVisits(bundle.brain.visitTable);
              } else if (bundle.brain.qTable && bundle.brain.visitTable) {
                setSarsaTable(bundle.brain.qTable);
                setSarsaVisits(bundle.brain.visitTable);
              }
            }
            setStorageMessage('Brain imported and stored in IndexedDB.');
            notify('success', 'Brain imported successfully.');
          } catch (error) {
            console.error('Unable to import brain', error);
            setStorageMessage('Brain import could not be completed.');
            notify('error', 'Could not complete the brain import. Review saved data before retrying.');
          } finally {
            setIsImportingBrain(false);
          }
        },
      });
    } catch (error) {
      console.error('Brain import validation failed', error);
      setStorageMessage('Brain import rejected. Choose a valid supported JSON brain export.');
      notify('error', 'This file is not a valid supported brain export.');
      setIsImportingBrain(false);
    }
  };

  const handleResetBrain = () => {
    const label = algorithm === 'q_learning' ? 'Q-Learning' : algorithm === 'sarsa' ? 'SARSA' : 'Goal-Based Planner';
    setConfirmation({
      title: 'Reset this agent’s brain?',
      description: `This removes the saved ${label} knowledge and its training history from this session. Export a backup first if you want to preserve it.`,
      confirmLabel: 'Reset Brain',
      destructive: true,
      onConfirm: () => {
        if (algorithm === 'goal_based') {
          const fresh = buildBrainState('goal_based', null, null, 0, 0);
          void saveAgentBrain('goal_based', fresh)
            .then(() => {
              setBrainStates((previous) => ({ ...previous, goal_based: fresh }));
              notify('success', 'Planner memory reset.');
            })
            .catch((error: unknown) => {
              console.error('Unable to reset planner brain', error);
              notify('error', 'Unable to reset the planner memory.');
            });
          return;
        }
        const freshQ = createInitialQTable(env);
        const freshVisits = createInitialVisitTable(env);
        if (algorithm === 'q_learning') {
          setQLearningTable(freshQ);
          setQLearningVisits(freshVisits);
        } else {
          setSarsaTable(freshQ);
          setSarsaVisits(freshVisits);
        }
        setCurrentEpisode(0);
        setCurrentEpsilon(hyperparams.epsilonStart);
        setEpisodeHistory((history) => history.filter((record) => record.algorithm !== algorithm));
        setCheckpoints([]);
        setBrainStates((previous) => ({ ...previous, [algorithm]: null }));
        setRestorationMessage(`${label} brain reset. Start fresh training when ready.`);
        notify('success', `${label} brain reset.`);
      },
    });
  };

  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      let failed = false;
      try {
        const [qBrain, sarsaBrain, plannerBrain] = await Promise.all([
            loadAgentBrain('q_learning'),
            loadAgentBrain('sarsa'),
            loadAgentBrain('goal_based'),
          ]);
        const [qCheckpoint, sarsaCheckpoint, plannerCheckpoint] = await Promise.all([
          qBrain
            ? loadTrainingCheckpoint(
                'q_learning',
                qBrain.environmentFingerprint,
                qBrain.completedEpisodes
              )
            : null,
          sarsaBrain
            ? loadTrainingCheckpoint(
                'sarsa',
                sarsaBrain.environmentFingerprint,
                sarsaBrain.completedEpisodes
              )
            : null,
          plannerBrain
            ? loadTrainingCheckpoint(
                'goal_based',
                plannerBrain.environmentFingerprint,
                plannerBrain.completedEpisodes
              )
            : null,
        ]);
        if (cancelled) return;
        const loadedBrains = { q_learning: qBrain, sarsa: sarsaBrain, goal_based: plannerBrain };
        const loadedCheckpoints = {
          q_learning: qCheckpoint,
          sarsa: sarsaCheckpoint,
          goal_based: plannerCheckpoint,
        };
        setBrainStates(loadedBrains);
        setBrainCheckpoints(loadedCheckpoints);
        const preferred = qBrain ?? sarsaBrain;
        const checkpoint = preferred?.agentId === 'q_learning' ? qCheckpoint : sarsaCheckpoint;
        if (preferred?.qTable && preferred.visitTable) {
          const restoredEnvironment = await loadEnvironment(preferred.environmentId);
          if (restoredEnvironment) {
            setEnv(restoredEnvironment);
            setActivePresetId(restoredEnvironment.id);
          }
          setHyperparams({ ...preferred.hyperparameters });
          setRewardConfig({ ...preferred.rewardConfig });
          setPlannerConfig({ ...preferred.plannerConfig });
          setCurrentEpisode(preferred.completedEpisodes);
          setCurrentEpsilon(preferred.currentEpsilon);
          if (preferred.agentId === 'q_learning') {
            setQLearningTable(preferred.qTable);
            setQLearningVisits(preferred.visitTable);
          } else {
            setSarsaTable(preferred.qTable);
            setSarsaVisits(preferred.visitTable);
          }
          setEpisodeHistory(checkpoint?.history ?? []);
          setCheckpoints(checkpoint?.evaluations ?? []);
          setRestorationMessage(`Brain restored — ${preferred.completedEpisodes} episodes recovered.`);
        } else {
          setRestorationMessage('No saved brain found. Agents are fresh; training will be saved automatically.');
        }
        try {
          const storedExperiments = await loadExperiments();
          if (storedExperiments.length > 0) setSavedExperiments(storedExperiments);
        } catch {
          // Existing localStorage experiments remain available if IndexedDB has no experiment records.
        }
      } catch (error) {
        failed = true;
        console.error('Unable to restore saved application data', error);
        if (!cancelled) {
          setRestoreError('Saved data could not be loaded from this browser. You can retry, or continue with the current fresh session; existing saved data will not be overwritten unless you train or save.');
        }
      } finally {
        if (!cancelled && !failed) setIsMemoryReady(true);
      }
    };
    void restore();
    return () => {
      cancelled = true;
    };
  }, [restoreAttempt]);

  useEffect(() => {
    if (!isMemoryReady || restoreError) return;
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      if (algorithm === 'goal_based') {
        void handleSaveBrain(false);
      } else {
        void persistBrainSnapshot(
          algorithm,
          algorithm === 'q_learning' ? qLearningTable : sarsaTable,
          algorithm === 'q_learning' ? qLearningVisits : sarsaVisits,
          currentEpsilon,
          currentEpisode,
          episodeHistory,
          checkpoints
        );
      }
    }, currentEpisode > 0 ? 300 : 1000);
    return () => {
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    };
  }, [
    isMemoryReady,
    algorithm,
    env,
    hyperparams,
    rewardConfig,
    plannerConfig,
    qLearningTable,
    sarsaTable,
    qLearningVisits,
    sarsaVisits,
    currentEpsilon,
    currentEpisode,
    episodeHistory,
    checkpoints,
  ]);

  useEffect(() => {
    if (!isMemoryReady || restoreError) return;
    const flushMemory = () => {
      if (algorithm === 'goal_based') {
        void handleSaveBrain(false);
      } else {
        void persistBrainSnapshot(
          algorithm,
          algorithm === 'q_learning' ? qLearningTable : sarsaTable,
          algorithm === 'q_learning' ? qLearningVisits : sarsaVisits,
          currentEpsilon,
          currentEpisode,
          episodeHistory,
          checkpoints
        );
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushMemory();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', flushMemory);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', flushMemory);
    };
  }, [
    isMemoryReady,
    algorithm,
    qLearningTable,
    sarsaTable,
    qLearningVisits,
    sarsaVisits,
    currentEpsilon,
    currentEpisode,
    episodeHistory,
    checkpoints,
  ]);

  const navItems: { id: NavTabId; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'overview', label: 'Overview', icon: <Layers className="w-4 h-4" /> },
    { id: 'environment', label: 'Environment Studio', icon: <Grid className="w-4 h-4" /> },
    { id: 'train', label: 'Train Agent', icon: <Cpu className="w-4 h-4" /> },
    { id: 'comparison', label: 'Algorithm Comparison', icon: <GitCompare className="w-4 h-4" /> },
    { id: 'policy', label: 'Policy & Q-Table', icon: <Table className="w-4 h-4" /> },
    {
      id: 'analytics',
      label: 'Learning Analytics',
      icon: <BarChart3 className="w-4 h-4" />,
      badge: episodeHistory.length > 0 ? `${episodeHistory.length}` : undefined,
    },
    { id: 'experiments', label: 'Experiments', icon: <FlaskConical className="w-4 h-4" /> },
    { id: 'memory', label: 'Brain & Memory', icon: <Database className="w-4 h-4" /> },
    { id: 'guide', label: 'Learning Guide', icon: <BookOpen className="w-4 h-4" /> },
  ];

  if (!isMemoryReady) {
    if (restoreError) {
      return (
        <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
          <div className="w-full max-w-xl">
            <ErrorState
              title="We couldn't restore your saved workspace"
              description={restoreError}
              action={{
                label: 'Try again',
                onClick: () => {
                  setRestoreError('');
                  setIsMemoryReady(false);
                  setRestoreAttempt((attempt) => attempt + 1);
                },
              }}
              secondaryAction={{
                label: 'Continue without restoring',
                onClick: () => {
                  setRestorationMessage('Storage restore was skipped. Existing saved data is preserved; automatic saving is paused for this session.');
                  setIsMemoryReady(true);
                  notify('warning', 'Continuing without storage restore. Existing saved data will not be overwritten automatically.');
                },
              }}
            />
          </div>
        </div>
      );
    }
    return <PageLoader title="Preparing your AI laboratory" description="Restoring saved agents and environments..." />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row font-sans">
      {/* A. Collapsible Navigation Sidebar */}
      <aside
        className={`bg-white border-b lg:border-b-0 lg:border-r border-slate-200 shrink-0 transition-all duration-200 flex flex-col justify-between lg:sticky lg:top-0 lg:h-screen ${
          sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'
        }`}
      >
        <div
          className={`${
            sidebarCollapsed ? 'lg:px-3 lg:py-4' : 'p-4'
          } space-y-4 lg:space-y-5 flex-1 overflow-visible lg:overflow-hidden`}
        >
          {/* Project Identity */}
          <div
            className={`flex items-center ${
              sidebarCollapsed
                ? 'justify-center gap-0'
                : 'justify-between gap-2'
            }`}
          >
            <div
              className={`flex min-w-0 items-center overflow-hidden ${
                sidebarCollapsed ? 'gap-0' : 'gap-2.5'
              }`}
            >
              <div
                className={`rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm transition-all ${
                  sidebarCollapsed ? 'w-7 h-7' : 'w-9 h-9'
                }`}
              >
                <Bot className={sidebarCollapsed ? 'w-4 h-4' : 'w-5 h-5'} />
              </div>
              <div className={`truncate ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                  <h1 className="text-xs font-bold tracking-tight text-slate-900 truncate">
                    RL Grid World Studio
                  </h1>
                  <p className="text-[10px] text-slate-500 truncate">
                    Autonomous Agent Intelligence Lab
                  </p>
              </div>
            </div>
            <button
              onClick={() => setSidebarCollapsed((c) => !c)}
              className={`hidden lg:flex shrink-0 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition ${
                sidebarCollapsed ? 'p-1' : 'p-1.5'
              }`}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Current Simulation Status Box */}
          <div className={`${sidebarCollapsed ? 'lg:hidden' : ''} p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2`}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Sim Status</span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                    simStatus === 'Training'
                      ? 'bg-emerald-100 text-emerald-800'
                      : simStatus === 'Paused'
                      ? 'bg-amber-100 text-amber-800'
                      : simStatus === 'Completed'
                      ? 'bg-teal-100 text-teal-800'
                      : 'bg-slate-200/70 text-slate-700'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      simStatus === 'Training'
                        ? 'bg-emerald-600 animate-ping'
                        : simStatus === 'Completed'
                        ? 'bg-teal-600'
                        : 'bg-slate-500'
                    }`}
                  />
                  {simStatus}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-600 font-mono">
                <span>
                  Alg:{' '}
                  <strong className="text-slate-900">
                    {algorithm === 'q_learning'
                      ? 'Q-Learning'
                      : algorithm === 'sarsa'
                      ? 'SARSA'
                      : 'Goal Planner'}
                  </strong>
                </span>
                <span>
                  Ep: <strong>{currentEpisode}</strong>/{hyperparams.maxEpisodes}
                </span>
              </div>
          </div>

          {/* Navigation Links */}
          <nav className="grid grid-cols-3 gap-1 lg:flex lg:flex-col lg:overflow-visible">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  aria-current={active ? 'page' : undefined}
                  aria-label={item.label}
                  className={`flex min-w-0 flex-col items-center justify-center gap-1 px-2 py-2 lg:flex-row ${
                    sidebarCollapsed
                      ? 'lg:justify-center lg:gap-0 lg:px-0'
                      : 'lg:justify-between lg:gap-2.5 lg:px-3'
                  } lg:py-2.5 rounded-xl text-[10px] lg:text-xs font-medium transition lg:shrink-0 ${
                    active
                      ? 'bg-emerald-50 text-emerald-900 font-semibold border border-emerald-200/80 shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                  title={item.label}
                >
                  <div className={`flex min-w-0 flex-col items-center gap-1 lg:flex-row lg:items-center ${
                    sidebarCollapsed ? 'lg:justify-center lg:gap-0' : 'lg:gap-2.5'
                  }`}>
                    <span className={`shrink-0 ${active ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {item.icon}
                    </span>
                    <span
                      className={`min-w-0 whitespace-normal text-center leading-tight lg:text-left ${
                        sidebarCollapsed ? 'lg:hidden' : 'lg:truncate'
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                  {!sidebarCollapsed && item.badge && (
                    <span className="hidden px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono text-[10px] lg:inline-flex">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Controls: Demo Mode & Reset */}
        <div className="p-4 border-t border-slate-100 space-y-2 hidden lg:block">
          {!sidebarCollapsed ? (
            <>
              <button
                onClick={handleLoadDemonstrationMode}
                className="w-full py-2 px-3 rounded-lg bg-teal-50 text-teal-900 border border-teal-200 text-xs font-semibold hover:bg-teal-100 inline-flex items-center justify-center gap-1.5 transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                Load Demo Benchmark
              </button>
              <button
                onClick={handleRequestTrainingReset}
                className="w-full py-2 px-3 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 inline-flex items-center justify-center gap-1.5 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Simulation
              </button>
            </>
          ) : (
            <button
              onClick={handleRequestTrainingReset}
              className="w-full p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center"
              title="Reset Simulation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Studio Header Bar */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">
                  RL Grid World Studio — Autonomous Agent Intelligence Lab
                </h2>
                <span className="max-w-full break-words px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] font-mono text-slate-700">
                  {env.name} ({env.rows}×{env.cols})
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Interactive Reinforcement Learning &amp; Goal-Directed Autonomous Planning Simulator
              </p>
            </div>
          </div>

          {/* Quick Global Algorithm & Execution Bar */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex rounded-lg bg-slate-100 p-1 border border-slate-200 text-xs">
              <button
                onClick={() => handleSelectAlgorithm('q_learning')}
                className={`px-2.5 py-1 rounded-md font-semibold transition ${
                  algorithm === 'q_learning'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Q-Learning
              </button>
              <button
                onClick={() => handleSelectAlgorithm('sarsa')}
                className={`px-2.5 py-1 rounded-md font-semibold transition ${
                  algorithm === 'sarsa'
                    ? 'bg-white text-teal-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                SARSA
              </button>
              <button
                onClick={() => handleSelectAlgorithm('goal_based')}
                className={`px-2.5 py-1 rounded-md font-semibold transition ${
                  algorithm === 'goal_based'
                    ? 'bg-white text-sky-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Goal-Based Planner
              </button>
            </div>

            {simStatus === 'Training' ? (
              <button
                onClick={() => setSimStatus('Paused')}
                className="px-3.5 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 inline-flex items-center gap-1.5 shadow-sm transition"
              >
                <Pause className="w-3.5 h-3.5 fill-current" />
                Pause
              </button>
            ) : (
              <button
                onClick={() => {
                  if (currentEpisode >= hyperparams.maxEpisodes) {
                    setHyperparams((h) => ({
                      ...h,
                      maxEpisodes: h.maxEpisodes + 100,
                    }));
                  }
                  setSimStatus('Training');
                }}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 inline-flex items-center gap-1.5 shadow-sm transition"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                {simStatus === 'Paused' ? 'Resume' : 'Start Training'}
              </button>
            )}

            <button
              onClick={handleExecuteSingleStep}
              disabled={simStatus === 'Training'}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 inline-flex items-center gap-1 transition"
            >
              <StepForward className="w-3.5 h-3.5" />
              1 Step
            </button>

            <button
              onClick={() => handleRunBatchEpisodes(1)}
              disabled={simStatus === 'Training'}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 inline-flex items-center gap-1 transition"
            >
              <FastForward className="w-3.5 h-3.5" />
              1 Episode
            </button>

            <button
              onClick={handleRequestTrainingReset}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>
        </header>

        {/* Demonstration Data Provenance Notice (when Demo Mode was clicked) */}
        {isDemoBannerActive && (
          <div className="bg-indigo-50 border-b border-indigo-200 px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-indigo-950">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>
                <strong>Preconfigured Demonstration Mode Active:</strong> Viewing deterministic 200-episode benchmark run on <em>Hazardous Grid</em> (Seed 42). Step or Reset at any time to generate fresh simulation telemetry.
              </span>
            </div>
            <button
              onClick={handleRequestTrainingReset}
              className="px-2.5 py-0.5 rounded bg-white border border-indigo-200 text-indigo-800 font-semibold hover:bg-indigo-100"
            >
              Clear Demo &amp; Start Fresh
            </button>
          </div>
        )}

        {vizMode === 'training' && algorithm !== 'goal_based' && (simStatus === 'Training' || simStatus === 'Paused') && (
          <section className="mx-4 mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:mx-6" aria-label="Training progress">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <OperationStatus
                status={simStatus === 'Training' ? 'training' : 'paused'}
                detail={`Episode ${currentEpisode} of ${hyperparams.maxEpisodes}`}
              />
              <span className="text-xs tabular-nums text-slate-600">
                Current reward: {episodeReward.toFixed(2)}
              </span>
            </div>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-label="Training episodes completed"
              aria-valuemin={0}
              aria-valuemax={hyperparams.maxEpisodes}
              aria-valuenow={Math.min(currentEpisode, hyperparams.maxEpisodes)}
            >
              <div
                className={`h-full rounded-full bg-emerald-500 transition-[width] ${
                  simStatus === 'Training' ? 'duration-300' : 'duration-0'
                }`}
                style={{
                  width: `${hyperparams.maxEpisodes > 0 ? Math.min(100, (currentEpisode / hyperparams.maxEpisodes) * 100) : 0}%`,
                }}
              />
            </div>
          </section>
        )}

        {/* B. Main Dashboard KPI Strip (Always live and synchronized) */}
        <section className="px-4 sm:px-6 pt-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
              <div className="text-[11px] text-slate-500 font-medium">
                Active Algorithm
              </div>
              <div className="text-xs font-bold text-slate-900 mt-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {algorithm === 'q_learning'
                  ? 'Q-Learning (Off-Policy)'
                  : algorithm === 'sarsa'
                  ? 'SARSA (On-Policy)'
                  : 'Goal-Based Planner'}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
              <div className="text-[11px] text-slate-500 font-medium">
                Training Episode
              </div>
              <div className="text-sm font-mono font-bold text-slate-900 mt-0.5">
                {algorithm === 'goal_based'
                  ? 'N/A (Planner)'
                  : `${currentEpisode} / ${hyperparams.maxEpisodes}`}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
              <div className="text-[11px] text-slate-500 font-medium">
                Average Reward
              </div>
              <div
                className={`text-sm font-mono font-bold mt-0.5 ${
                  avgRewardDisplay > 0
                    ? 'text-emerald-700'
                    : avgRewardDisplay < 0
                    ? 'text-rose-600'
                    : 'text-slate-800'
                }`}
              >
                {avgRewardDisplay}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
              <div className="text-[11px] text-slate-500 font-medium">
                Success Rate
              </div>
              <div className="text-sm font-mono font-bold text-teal-700 mt-0.5">
                {successRateDisplay}%
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
              <div className="text-[11px] text-slate-500 font-medium">
                Steps to Goal
              </div>
              <div className="text-sm font-mono font-bold text-slate-900 mt-0.5">
                {avgStepsDisplay} steps
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
              <div className="text-[11px] text-slate-500 font-medium">
                Exploration Rate (ε)
              </div>
              <div className="text-sm font-mono font-bold text-indigo-700 mt-0.5">
                {algorithm === 'goal_based'
                  ? '0.00 (Deterministic)'
                  : vizMode === 'evaluation'
                  ? '0.00 (Eval Greedy)'
                  : currentEpsilon.toFixed(3)}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
              <div className="text-[11px] text-slate-500 font-medium">
                Agent Status
              </div>
              <div className="text-xs font-bold text-slate-900 mt-1 flex items-center justify-between">
                <span>{simStatus}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                  {vizMode === 'training' ? 'Train' : 'Eval'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Active Workspace View */}
        <div className="min-w-0 p-4 sm:p-6 flex-1">
          {/* VIEW 1: OVERVIEW (Main Dashboard) */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {episodeHistory.length === 0 && (
                <EmptyState
                  title="Your AI lab is ready"
                  description="Train your first agent to explore the grid, discover rewards, and learn a path to the goal."
                  action={{
                    label: 'Start First Training',
                    onClick: () => setActiveTab('train'),
                  }}
                  secondaryAction={{
                    label: 'Explore Demo Environment',
                    onClick: handleLoadDemonstrationMode,
                  }}
                />
              )}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: Large Interactive Grid-World Preview (7 cols) */}
                <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        <Compass className="w-4 h-4 text-emerald-600" />
                        Interactive Grid-World Simulation Preview
                      </h3>
                      <p className="text-xs text-slate-500">
                        Preset:{' '}
                        <select
                          value={env.id}
                          onChange={(e) => {
                            const found = ENVIRONMENT_PRESETS.find(
                              (p) => p.id === e.target.value
                            );
                            if (found) handleUpdateEnvironment(found);
                          }}
                          className="font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded px-2 py-0.5 ml-1"
                        >
                          {ENVIRONMENT_PRESETS.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.rows}×{p.cols})
                            </option>
                          ))}
                          {!ENVIRONMENT_PRESETS.some((p) => p.id === env.id) && (
                            <option value={env.id}>{env.name}</option>
                          )}
                        </select>
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs">
                      <button
                        onClick={() => setGridOverlay('policy_arrows')}
                        className={`px-2.5 py-1 rounded-lg border font-medium ${
                          gridOverlay === 'policy_arrows'
                            ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                            : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        Policy Arrows
                      </button>
                      <button
                        onClick={() => setGridOverlay('q_split')}
                        className={`px-2.5 py-1 rounded-lg border font-medium ${
                          gridOverlay === 'q_split'
                            ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                            : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        Q-Values
                      </button>
                      <button
                        onClick={() => setGridOverlay('visits')}
                        className={`px-2.5 py-1 rounded-lg border font-medium ${
                          gridOverlay === 'visits'
                            ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                            : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        Visits
                      </button>
                    </div>
                  </div>

                  <GridCanvas
                    env={env}
                    agentPos={agentPos}
                    trail={episodeTrail}
                    plannedPath={
                      algorithm === 'goal_based' ? goalPlan.path : []
                    }
                    qTable={activeQTable}
                    visitTable={activeVisits}
                    overlayMode={
                      algorithm === 'goal_based' ? 'none' : gridOverlay
                    }
                  />

                  {/* Quick Batch Execution Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleRunBatchEpisodes(25)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold hover:bg-emerald-100 transition"
                      >
                        +25 Episodes
                      </button>
                      <button
                        onClick={() => handleRunBatchEpisodes(100)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold hover:bg-emerald-100 transition"
                      >
                        +100 Episodes
                      </button>
                      <button
                        onClick={handleLoadDemonstrationMode}
                        className="px-3 py-1.5 rounded-lg bg-teal-50 text-teal-900 border border-teal-200 text-xs font-semibold hover:bg-teal-100 transition"
                      >
                        Run Instant Demo Comparison
                      </button>
                    </div>
                    <button
                      onClick={() => setActiveTab('environment')}
                      className="text-xs font-semibold text-emerald-700 hover:underline"
                    >
                      Customize Grid &amp; Rewards →
                    </button>
                  </div>
                </div>

                {/* Right: Compact Performance Charts & Live Telemetry (5 cols) */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                  {/* Compact Chart 1: Reward Curve */}
                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex-1 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          Episode Return Progression
                        </h3>
                        <p className="text-xs text-slate-500">
                          Raw episode return vs. 15-episode moving average
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveTab('analytics')}
                        className="text-xs font-semibold text-emerald-700 hover:underline"
                      >
                        All 7 Charts →
                      </button>
                    </div>

                    {analyticsSeries.length === 0 ? (
                      <div className="h-44 flex flex-col items-center justify-center text-center bg-slate-50 rounded-lg border border-dashed border-slate-200 p-4">
                        <Activity className="w-5 h-5 text-slate-400 mb-1" />
                        <p className="text-xs text-slate-500">
                          Click <strong>Start Training</strong> or <strong>+25 Episodes</strong> to plot live reward and step curves.
                        </p>
                      </div>
                    ) : (
                      <div className="relative h-44 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={analyticsSeries}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="episode" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip />
                            <Line
                              type="monotone"
                              dataKey="totalReward"
                              name="Raw Return"
                              stroke="#cbd5e1"
                              strokeWidth={1.2}
                              dot={false}
                            />
                            <Line
                              type="monotone"
                              dataKey="movingAvgReward"
                              name="Moving Avg"
                              stroke="#059669"
                              strokeWidth={2.3}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  {/* Compact Chart 2: Success Rate & Step Efficiency */}
                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex-1 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          Rolling Goal Success Rate (%) &amp; Steps
                        </h3>
                        <p className="text-xs text-slate-500">
                          Tracks goal completion reliability over time
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveTab('comparison')}
                        className="text-xs font-semibold text-teal-700 hover:underline"
                      >
                        Compare Agents →
                      </button>
                    </div>

                    {analyticsSeries.length === 0 ? (
                      <div className="h-44 flex flex-col items-center justify-center text-center bg-slate-50 rounded-lg border border-dashed border-slate-200 p-4">
                        <Target className="w-5 h-5 text-slate-400 mb-1" />
                        <p className="text-xs text-slate-500">
                          Goal completion and step efficiency telemetry will appear here during training.
                        </p>
                      </div>
                    ) : (
                      <div className="relative h-44 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={analyticsSeries}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="episode" tick={{ fontSize: 10 }} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                            <Tooltip />
                            <Legend wrapperStyle={{ fontSize: 10 }} />
                            <Line
                              type="monotone"
                              dataKey="rollingSuccessRate"
                              name="Success Rate (%)"
                              stroke="#0d9488"
                              strokeWidth={2.2}
                              dot={false}
                            />
                            <Line
                              type="monotone"
                              dataKey="rollingAvgSteps"
                              name="Avg Steps"
                              stroke="#0284c7"
                              strokeWidth={2}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: ENVIRONMENT STUDIO & REWARD CONFIGURATION */}
          {activeTab === 'environment' && (
            <EnvironmentStudioView
              env={env}
              rewardConfig={rewardConfig}
              plannerConfig={plannerConfig}
              onUpdateEnv={handleUpdateEnvironment}
              onUpdateRewardConfig={(r) => setRewardConfig(r)}
              onUpdatePlannerConfig={(p) => setPlannerConfig(p)}
              onResetEnvironmentToPreset={handleRestorePresetEnvironment}
            />
          )}

          {/* VIEW 3: TRAIN AGENT (Hyperparameters & Live Agent Visualization) */}
          {activeTab === 'train' && (
            <div className="space-y-6">
              {/* Top Mode & Execution Toolbar */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-emerald-600" />
                    Agent Training Workbench &amp; Real-Time Decision Inspector
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configure hyperparameters, step through individual Bellman updates, or switch between Training Mode and Greedy Evaluation Mode.
                  </p>
                </div>

                {/* Training Mode vs Evaluation Mode Switcher */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs">
                    <button
                      onClick={() => {
                        setVizMode('training');
                        handleResetAgentPosition();
                      }}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                        vizMode === 'training'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Training Mode (ε-Greedy + Q Updates)
                    </button>
                    <button
                      onClick={() => {
                        setVizMode('evaluation');
                        handleResetAgentPosition();
                      }}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                        vizMode === 'evaluation'
                          ? 'bg-sky-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Evaluation Mode (Greedy ε=0, Frozen Q)
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Live Grid + Real-Time Step Inspector (7 cols) */}
                <div className="lg:col-span-7 space-y-6">
                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                    {/* Full Training Control Buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      <div className="flex flex-wrap items-center gap-2">
                        {simStatus !== 'Training' ? (
                          <button
                            onClick={() => setSimStatus('Training')}
                            className="px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 inline-flex items-center gap-1.5 transition"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            {simStatus === 'Paused' ? 'Resume' : 'Start Training'}
                          </button>
                        ) : (
                          <button
                            onClick={() => setSimStatus('Paused')}
                            className="px-3.5 py-2 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 inline-flex items-center gap-1.5 transition"
                          >
                            <Pause className="w-3.5 h-3.5 fill-current" />
                            Pause
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setSimStatus('Idle');
                            handleResetAgentPosition();
                          }}
                          className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1 transition"
                        >
                          <Square className="w-3.5 h-3.5" />
                          Stop
                        </button>

                        <button
                          onClick={handleExecuteSingleStep}
                          disabled={simStatus === 'Training'}
                          className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 inline-flex items-center gap-1 transition"
                        >
                          <StepForward className="w-3.5 h-3.5 text-emerald-600" />
                          Execute 1 Step
                        </button>

                        <button
                          onClick={() => handleRunBatchEpisodes(1)}
                          disabled={simStatus === 'Training'}
                          className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 inline-flex items-center gap-1 transition"
                        >
                          <FastForward className="w-3.5 h-3.5 text-teal-600" />
                          Run 1 Episode
                        </button>
                      </div>

                      {/* Train for Selected Number of Episodes */}
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={1}
                          max={1000}
                          value={batchEpisodesCount}
                          onChange={(e) => {
                            const v = Math.max(1, Math.min(1000, Number(e.target.value)));
                            setBatchEpisodesCount(v);
                            batchInputCountRef.current = v;
                          }}
                          className="w-16 px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-mono text-center"
                        />
                        <button
                          onClick={() => handleRunBatchEpisodes(batchEpisodesCount)}
                          disabled={simStatus === 'Training'}
                          className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 disabled:opacity-40 inline-flex items-center gap-1 transition"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          Train {batchEpisodesCount} Ep
                        </button>
                      </div>
                    </div>

                    <GridCanvas
                      env={env}
                      agentPos={agentPos}
                      trail={episodeTrail}
                      plannedPath={
                        algorithm === 'goal_based' ? goalPlan.path : []
                      }
                      qTable={activeQTable}
                      visitTable={activeVisits}
                      overlayMode={gridOverlay}
                    />
                  </div>

                  {/* Section 8: Live Agent Visualization Telemetry Panel */}
                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          Live Agent State &amp; Decision Telemetry
                        </h3>
                        <p className="text-xs text-slate-500">
                          Real-time inspection of current coordinates, action values, and last Bellman update.
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          vizMode === 'evaluation'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {vizMode === 'evaluation'
                          ? 'Evaluation Mode (Frozen Q)'
                          : 'Training Mode (Active Learning)'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <span className="text-slate-500 block text-[11px]">
                          Current Coordinates
                        </span>
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          ({agentPos.row}, {agentPos.col})
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <span className="text-slate-500 block text-[11px]">
                          Selected Action
                        </span>
                        <span className="font-mono font-bold text-emerald-700 text-sm">
                          {lastTransition
                            ? `${ACTION_DELTAS[lastTransition.action].symbol} ${lastTransition.action} (${
                                lastTransition.wasExploratory ? 'Explore' : 'Greedy'
                              })`
                            : 'Ready'}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <span className="text-slate-500 block text-[11px]">
                          Immediate / Ep Reward
                        </span>
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          {lastTransition ? lastTransition.reward : 0} /{' '}
                          <span className="text-emerald-700">{episodeReward}</span>
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <span className="text-slate-500 block text-[11px]">
                          Ep Steps / Policy Rec
                        </span>
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          {episodeSteps} steps •{' '}
                          {currentBestActions.length > 0
                            ? currentBestActions.map((a) => ACTION_DELTAS[a].symbol).join('')
                            : 'Any'}
                        </span>
                      </div>
                    </div>

                    {/* Current State Action Values */}
                    <div className="grid grid-cols-4 gap-2 pt-1">
                      {ALL_ACTIONS.map((act) => {
                        const val = currentStateQ[act];
                        const isBest = currentBestActions.includes(act);
                        const isAvail = currentAvailableActions.includes(act);
                        return (
                          <div
                            key={act}
                            className={`p-2.5 rounded-lg border text-xs ${
                              isBest
                                ? 'border-emerald-500 bg-emerald-50/50'
                                : 'border-slate-200 bg-slate-50/40'
                            }`}
                          >
                            <div className="flex items-center justify-between font-semibold text-slate-800">
                              <span>
                                {ACTION_DELTAS[act].symbol} {act}
                              </span>
                              {!isAvail && (
                                <span className="text-[9px] text-amber-700">Wall</span>
                              )}
                            </div>
                            <div className="font-mono font-bold text-sm mt-1 text-slate-900">
                              {val.toFixed(2)}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {lastTransition && lastTransition.tdTarget !== undefined && (
                      <div className="p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] flex flex-wrap items-center justify-between gap-2">
                        <span>
                          Last Update ({lastTransition.stateKey}, {lastTransition.action}): Q{' '}
                          {lastTransition.qBefore?.toFixed(2)} →{' '}
                          <strong className="text-emerald-400">
                            {lastTransition.qAfter?.toFixed(2)}
                          </strong>
                        </span>
                        <span>
                          TD Target: {lastTransition.tdTarget.toFixed(2)} | TD Error δ:{' '}
                          {lastTransition.tdError?.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Hyperparameters Control Panel (5 cols) */}
                <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between gap-5">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                          <Sliders className="w-4 h-4 text-emerald-600" />
                          Hyperparameter Control Panel
                        </h3>
                        <p className="text-xs text-slate-500">
                          Fine-tune learning dynamics, exploration schedules, and random seeds.
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          setHyperparams({ ...DEFAULT_HYPERPARAMETERS })
                        }
                        className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Restore Defaults
                      </button>
                    </div>

                    {/* Sliders */}
                    <div className="space-y-3.5">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-slate-700">
                            Learning Rate (α)
                          </span>
                          <span className="font-mono font-bold text-emerald-700">
                            {hyperparams.alpha.toFixed(2)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.01}
                          max={1.0}
                          step={0.01}
                          value={hyperparams.alpha}
                          onChange={(e) =>
                            setHyperparams({
                              ...hyperparams,
                              alpha: Number(e.target.value),
                            })
                          }
                          className="w-full accent-emerald-600"
                        />
                        <p className="text-[11px] text-slate-500">
                          Step size for TD value updates: Q(s,a) ← Q(s,a) + α·δ.
                        </p>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-slate-700">
                            Discount Factor (γ)
                          </span>
                          <span className="font-mono font-bold text-teal-700">
                            {hyperparams.gamma.toFixed(2)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.0}
                          max={0.99}
                          step={0.01}
                          value={hyperparams.gamma}
                          onChange={(e) =>
                            setHyperparams({
                              ...hyperparams,
                              gamma: Number(e.target.value),
                            })
                          }
                          className="w-full accent-teal-600"
                        />
                        <p className="text-[11px] text-slate-500">
                          Weight given to future rewards (0 = myopic, 0.99 = farsighted).
                        </p>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-slate-700">
                            Initial Exploration Rate (ε₀)
                          </span>
                          <span className="font-mono font-bold text-indigo-700">
                            {hyperparams.epsilonStart.toFixed(2)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.0}
                          max={1.0}
                          step={0.05}
                          value={hyperparams.epsilonStart}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setHyperparams({ ...hyperparams, epsilonStart: val });
                            if (currentEpisode === 0) setCurrentEpsilon(val);
                          }}
                          className="w-full accent-indigo-600"
                        />
                        <p className="text-[11px] text-slate-500">
                          Starting probability of choosing a uniform random exploratory action.
                        </p>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-slate-700">
                            Minimum Exploration Rate (ε_min)
                          </span>
                          <span className="font-mono font-bold text-indigo-700">
                            {hyperparams.epsilonMin.toFixed(2)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.0}
                          max={0.5}
                          step={0.01}
                          value={hyperparams.epsilonMin}
                          onChange={(e) =>
                            setHyperparams({
                              ...hyperparams,
                              epsilonMin: Number(e.target.value),
                            })
                          }
                          className="w-full accent-indigo-600"
                        />
                        <p className="text-[11px] text-slate-500">
                          Floor probability ensuring continued exploration in later episodes.
                        </p>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-slate-700">
                            Exploration Decay Multiplier
                          </span>
                          <span className="font-mono font-bold text-indigo-700">
                            {hyperparams.epsilonDecay.toFixed(3)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.9}
                          max={0.999}
                          step={0.001}
                          value={hyperparams.epsilonDecay}
                          onChange={(e) =>
                            setHyperparams({
                              ...hyperparams,
                              epsilonDecay: Number(e.target.value),
                            })
                          }
                          className="w-full accent-indigo-600"
                        />
                        <p className="text-[11px] text-slate-500">
                          Multiplied after each episode: ε ← max(ε_min, ε × decay).
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium text-slate-700">
                              Max Episodes
                            </span>
                            <span className="font-mono font-bold">
                              {hyperparams.maxEpisodes}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={20}
                            max={1000}
                            step={10}
                            value={hyperparams.maxEpisodes}
                            onChange={(e) =>
                              setHyperparams({
                                ...hyperparams,
                                maxEpisodes: Number(e.target.value),
                              })
                            }
                            className="w-full accent-slate-700"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium text-slate-700">
                              Max Steps / Ep
                            </span>
                            <span className="font-mono font-bold">
                              {hyperparams.maxStepsPerEpisode}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={15}
                            max={300}
                            step={5}
                            value={hyperparams.maxStepsPerEpisode}
                            onChange={(e) =>
                              setHyperparams({
                                ...hyperparams,
                                maxStepsPerEpisode: Number(e.target.value),
                              })
                            }
                            className="w-full accent-slate-700"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium text-slate-700">
                              Simulation Speed
                            </span>
                            <span className="font-mono font-semibold text-emerald-700">
                              {[
                                '',
                                '1x Slow Step',
                                '2x Normal',
                                '3x Fast Step',
                                '4x Turbo Ep',
                                '5x Max Batch',
                              ][hyperparams.speed]}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={1}
                            max={5}
                            step={1}
                            value={hyperparams.speed}
                            onChange={(e) =>
                              setHyperparams({
                                ...hyperparams,
                                speed: Number(e.target.value),
                              })
                            }
                            className="w-full accent-emerald-600"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-medium text-slate-700 block mb-1">
                            Random Seed (PRNG)
                          </label>
                          <input
                            type="number"
                            value={hyperparams.seed}
                            onChange={(e) => {
                              const s = Number(e.target.value) || 1;
                              setHyperparams({ ...hyperparams, seed: s });
                              rngRef.current = new SeededRNG(s);
                            }}
                            className="w-full px-2.5 py-1 rounded-lg border border-slate-300 font-mono text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2">
                    <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Reproducible Tie-Breaking:</strong> When multiple actions share the maximum Q-value, ε-greedy selection breaks ties uniformly at random using the seeded Mulberry32 PRNG.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 4: ALGORITHM COMPARISON LAB */}
          {activeTab === 'comparison' && (
            <ComparisonLabView
              env={env}
              hyperparams={hyperparams}
              rewardConfig={rewardConfig}
              plannerConfig={plannerConfig}
              comparisonResult={comparisonResult}
              onRunComparison={handleRunComparison}
            />
          )}

          {/* VIEW 5: POLICY & Q-TABLE EXPLORER */}
          {activeTab === 'policy' && (
            <PolicyQTableView
              env={env}
              agentPos={agentPos}
              qLearningTable={qLearningTable}
              sarsaTable={sarsaTable}
              qLearningVisits={qLearningVisits}
              sarsaVisits={sarsaVisits}
              activeAlgorithm={inspectedTableAlg}
              onSwitchInspectedAlgorithm={(alg) => setInspectedTableAlg(alg)}
            />
          )}

          {/* VIEW 6: LEARNING ANALYTICS */}
          {activeTab === 'analytics' && (
            <AnalyticsView
              history={episodeHistory}
              checkpoints={checkpoints}
              onQuickTrainEpisodes={(n) => handleRunBatchEpisodes(n)}
            />
          )}

          {/* VIEW 7: EXPERIMENTS & VERIFICATION SUITE */}
          {activeTab === 'experiments' && (
            <ExperimentsAndTestsView
              env={env}
              algorithm={algorithm}
              hyperparams={hyperparams}
              rewardConfig={rewardConfig}
              plannerConfig={plannerConfig}
              history={episodeHistory}
              latestEvalSummary={latestEvalSummary}
              savedExperiments={savedExperiments}
              onSaveExperiment={handleSaveExperiment}
              onDeleteExperiment={handleDeleteExperiment}
              onLoadExperiment={handleLoadExperiment}
            />
          )}

          {activeTab === 'memory' && (
            <BrainMemoryView
              brains={brainStates}
              checkpoints={brainCheckpoints}
              activeAlgorithm={algorithm}
              environment={env}
              storageMessage={storageMessage}
              restorationMessage={restorationMessage}
              isSaving={isSavingBrain}
              isImporting={isImportingBrain}
              onSave={handleSaveBrain}
              onSelectAlgorithm={handleSelectAlgorithm}
              onResume={handleResumeLearning}
              onEvaluate={handleEvaluateBrain}
              onExport={handleExportBrain}
              onImport={(file) => void handleImportBrain(file)}
              onReset={handleResetBrain}
            />
          )}

          {/* VIEW 8: LEARNING GUIDE & GUIDED CHALLENGE */}
          {activeTab === 'guide' && (
            <LearningGuideView
              env={env}
              history={episodeHistory}
              latestEvalSummary={latestEvalSummary}
              comparisonResult={comparisonResult}
              onLaunchGuidedChallenge={() => {
                handleUpdateEnvironment(ENVIRONMENT_PRESETS[2]);
                setAlgorithm('sarsa');
                setActiveTab('train');
              }}
              onNavigateTab={(t) => setActiveTab(t as NavTabId)}
            />
          )}
        </div>
      </main>
      <ToastViewport toast={toast} onDismiss={() => setToast(null)} />
      <ConfirmationDialog
        open={confirmation !== null}
        title={confirmation?.title ?? ''}
        description={confirmation?.description ?? ''}
        confirmLabel={confirmation?.confirmLabel ?? 'Confirm'}
        destructive={confirmation?.destructive}
        onCancel={() => {
          setConfirmation(null);
          setIsImportingBrain(false);
        }}
        onConfirm={() => {
          const action = confirmation?.onConfirm;
          setConfirmation(null);
          action?.();
        }}
      />
    </div>
  );
}
