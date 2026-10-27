import React, { useState } from 'react';
import {
  Award,
  GitCompare,
  Info,
  Play,
  ShieldAlert,
  Sparkles,
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
  ControlledComparisonResult,
  EnvironmentConfig,
  Hyperparameters,
  PlannerConfig,
  RewardConfig,
} from '../types/rl';
import { computeAnalyticsSeries } from '../engine/analytics';
import { GridCanvas } from './GridCanvas';
import { EmptyState } from './UIStates';

interface ComparisonLabViewProps {
  env: EnvironmentConfig;
  hyperparams: Hyperparameters;
  rewardConfig: RewardConfig;
  plannerConfig: PlannerConfig;
  comparisonResult: ControlledComparisonResult | null;
  onRunComparison: (
    mode: 'controlled' | 'baseline',
    thresholdReward: number,
    numSeeds: number
  ) => void;
}

export const ComparisonLabView: React.FC<ComparisonLabViewProps> = ({
  env,
  hyperparams,
  rewardConfig,
  comparisonResult,
  onRunComparison,
}) => {
  const [experimentMode, setExperimentMode] = useState<'controlled' | 'baseline'>('baseline');
  const [thresholdReward, setThresholdReward] = useState<number>(60);
  const [numSeeds, setNumSeeds] = useState<number>(1);
  const [selectedTrajectoryAgent, setSelectedTrajectoryAgent] = useState<
    'q_learning' | 'sarsa' | 'goal_based'
  >('q_learning');

  // Build overlaid chart data when comparisonResult exists
  const overlaidData: {
    episode: number;
    qRewardAvg: number;
    sarsaRewardAvg: number;
    qSuccessRate: number;
    sarsaSuccessRate: number;
    qStepsAvg: number;
    sarsaStepsAvg: number;
    goalBaselineReward?: number;
  }[] = [];

  if (comparisonResult) {
    const qSeries = computeAnalyticsSeries(comparisonResult.qLearningHistory, 15);
    const sSeries = computeAnalyticsSeries(comparisonResult.sarsaHistory, 15);
    const len = Math.min(qSeries.length, sSeries.length);
    const goalReward = comparisonResult.goalBasedSummary?.avgReward;

    for (let i = 0; i < len; i++) {
      overlaidData.push({
        episode: qSeries[i].episode,
        qRewardAvg: qSeries[i].movingAvgReward,
        sarsaRewardAvg: sSeries[i].movingAvgReward,
        qSuccessRate: qSeries[i].rollingSuccessRate,
        sarsaSuccessRate: sSeries[i].rollingSuccessRate,
        qStepsAvg: qSeries[i].rollingAvgSteps,
        sarsaStepsAvg: sSeries[i].rollingAvgSteps,
        goalBaselineReward: goalReward,
      });
    }
  }

  const activePath =
    !comparisonResult
      ? []
      : selectedTrajectoryAgent === 'q_learning'
      ? comparisonResult.qLearningSummary.pathTaken
      : selectedTrajectoryAgent === 'sarsa'
      ? comparisonResult.sarsaSummary.pathTaken
      : comparisonResult.goalBasedSummary?.pathTaken ?? [];

  const qTotalTrainHazards =
    comparisonResult?.qLearningHistory.reduce((a, b) => a + b.hazardHits, 0) ?? 0;
  const sarsaTotalTrainHazards =
    comparisonResult?.sarsaHistory.reduce((a, b) => a + b.hazardHits, 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Control Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-emerald-600" />
              Algorithm Comparison Lab — Q-Learning vs. SARSA vs. Goal-Based Planner
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Execute controlled head-to-head training experiments with identical hyperparameters and random seeds, and benchmark against an explicit planning baseline.
            </p>
          </div>

          <button
            onClick={() => onRunComparison(experimentMode, thresholdReward, numSeeds)}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-sm inline-flex items-center gap-2 transition"
          >
            <Play className="w-4 h-4 fill-current" />
            Run {experimentMode === 'controlled' ? 'Controlled RL Comparison' : 'Full 3-Agent Baseline Benchmark'}
          </button>
        </div>

        {/* Configuration Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
          <div>
            <span className="text-xs font-medium text-slate-700 block mb-1.5">
              Experiment Protocol
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setExperimentMode('controlled')}
                className={`p-2 rounded-lg border text-left text-xs transition ${
                  experimentMode === 'controlled'
                    ? 'border-emerald-500 bg-emerald-50/60 font-semibold text-emerald-900'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div>Controlled RL</div>
                <div className="text-[10px] font-normal text-slate-500">
                  Q-Learning vs. SARSA
                </div>
              </button>
              <button
                onClick={() => setExperimentMode('baseline')}
                className={`p-2 rounded-lg border text-left text-xs transition ${
                  experimentMode === 'baseline'
                    ? 'border-emerald-500 bg-emerald-50/60 font-semibold text-emerald-900'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div>Baseline Benchmark</div>
                <div className="text-[10px] font-normal text-slate-500">
                  + Goal-Based Planner
                </div>
              </button>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-medium text-slate-700">
                Performance Threshold Reward
              </span>
              <span className="font-mono font-semibold text-emerald-700">
                {thresholdReward}
              </span>
            </div>
            <input
              type="range"
              min={-20}
              max={rewardConfig.goalReward}
              step={5}
              value={thresholdReward}
              onChange={(e) => setThresholdReward(Number(e.target.value))}
              className="w-full accent-emerald-600"
            />
            <p className="text-[11px] text-slate-500">
              Measures how many episodes each RL algorithm needs to achieve rolling avg return ≥ {thresholdReward}.
            </p>
          </div>

          <div>
            <span className="text-xs font-medium text-slate-700 block mb-1.5">
              Random Seed Replications (Base Seed: {hyperparams.seed})
            </span>
            <div className="grid grid-cols-3 gap-2">
              {[1, 3, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setNumSeeds(n)}
                  className={`py-2 px-2.5 rounded-lg border text-xs font-medium transition ${
                    numSeeds === n
                      ? 'border-teal-500 bg-teal-50 text-teal-900 font-semibold'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {n === 1 ? '1 Seed (Exact)' : `${n} Seeds (Mean±SD)`}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
               Budget: {hyperparams.maxEpisodes} episodes/agent, α={hyperparams.alpha}, γ={hyperparams.gamma}.
            </p>
          </div>
        </div>
      </div>

      {/* Theoretical Explanation Box */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-700">
        <Info className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold text-slate-900">
            Why Q-Learning, SARSA, and the Goal-Based Planner Differ:
          </div>
          <p>
            • <strong>Off-Policy Q-Learning</strong> backs up <span className="font-mono">max_a&apos; Q(s&apos;, a&apos;)</span>, assuming the greedy action will be followed from the next state onward. In environments like <em>Hazardous Grid</em>, it learns the shortest path right along the edge of the hazards.
          </p>
          <p>
            • <strong>On-Policy SARSA</strong> backs up <span className="font-mono">Q(s&apos;, a&apos;)</span> using the action actually sampled by its ε-greedy behavior policy. Because random ε-exploratory steps near hazards incur severe penalties during training, SARSA learns a safer, wider detour away from hazards.
          </p>
          <p>
            • <strong>Hand-Designed Goal-Based Planner (Non-RL Baseline)</strong> has full access to the map and reward model upfront. It computes a route directly via A*/BFS graph search in <span className="font-mono">0 training episodes</span> without trial-and-error learning or a Q-table.
          </p>
        </div>
      </div>

      {!comparisonResult ? (
        <EmptyState
          title="Ready to compare agents"
          description={`No comparison results are available yet. Choose the protocol, reward threshold, and seed count above, then run a comparison. The agents will use ${env.name} and the current training budget.`}
          icon={<Sparkles className="h-6 w-6" />}
          action={{
            label: 'Run comparison',
            onClick: () => onRunComparison(experimentMode, thresholdReward, numSeeds),
          }}
        />
      ) : (
        <>
          {/* Results Table */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-600" />
                  Empirical Evaluation & Training Results Table
                </h3>
                <p className="text-xs text-slate-500">
                  Seeds evaluated: <span className="font-mono">{comparisonResult.seedsUsed.join(', ')}</span> | Evaluation trials per seed: <span className="font-mono">{comparisonResult.qLearningSummary.trials}</span> (greedy ε = 0 from identical start state).
                </p>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Agent / Algorithm</th>
                    <th className="py-2.5 px-3">Paradigm</th>
                    <th className="py-2.5 px-3 text-right">Eval Success Rate</th>
                    <th className="py-2.5 px-3 text-right">Avg Eval Reward</th>
                    <th className="py-2.5 px-3 text-right">Avg Steps to Goal</th>
                    <th className="py-2.5 px-3 text-right">Eval Failure Rate</th>
                    <th className="py-2.5 px-3 text-right">Hazard Hits (Train / Eval)</th>
                    <th className="py-2.5 px-3 text-right">Episodes to ≥{comparisonResult.thresholdReward}</th>
                    <th className="py-2.5 px-3 text-right">Training Time</th>
                    <th className="py-2.5 px-3 text-right">Eval Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {/* Q-Learning Row */}
                  <tr className="hover:bg-emerald-50/30">
                    <td className="py-2.5 px-3 font-sans font-semibold text-emerald-800">
                      Q-Learning
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-600">
                      Off-Policy RL
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      {comparisonResult.qLearningSummary.successRate}%
                      {comparisonResult.multiSeedStats
                        ? ` ±${comparisonResult.multiSeedStats.qLearningSuccessStd}%`
                        : ''}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                      {comparisonResult.qLearningSummary.avgReward}
                      {comparisonResult.multiSeedStats
                        ? ` ±${comparisonResult.multiSeedStats.qLearningRewardStd}`
                        : ''}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {comparisonResult.qLearningSummary.avgSteps}
                    </td>
                    <td className="py-2.5 px-3 text-right text-rose-600">
                      {comparisonResult.qLearningSummary.failureRate}%
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {qTotalTrainHazards} / {comparisonResult.qLearningSummary.avgHazardHits}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {comparisonResult.qLearningSummary.episodesToThreshold !== null
                        ? `${comparisonResult.qLearningSummary.episodesToThreshold} ep`
                        : 'Not reached'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {comparisonResult.qLearningSummary.trainingTimeMs} ms
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {comparisonResult.qLearningSummary.evaluationTimeMs} ms
                    </td>
                  </tr>

                  {/* SARSA Row */}
                  <tr className="hover:bg-teal-50/30">
                    <td className="py-2.5 px-3 font-sans font-semibold text-teal-800">
                      SARSA
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-600">
                      On-Policy RL
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      {comparisonResult.sarsaSummary.successRate}%
                      {comparisonResult.multiSeedStats
                        ? ` ±${comparisonResult.multiSeedStats.sarsaSuccessStd}%`
                        : ''}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-teal-700">
                      {comparisonResult.sarsaSummary.avgReward}
                      {comparisonResult.multiSeedStats
                        ? ` ±${comparisonResult.multiSeedStats.sarsaRewardStd}`
                        : ''}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {comparisonResult.sarsaSummary.avgSteps}
                    </td>
                    <td className="py-2.5 px-3 text-right text-rose-600">
                      {comparisonResult.sarsaSummary.failureRate}%
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {sarsaTotalTrainHazards} / {comparisonResult.sarsaSummary.avgHazardHits}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {comparisonResult.sarsaSummary.episodesToThreshold !== null
                        ? `${comparisonResult.sarsaSummary.episodesToThreshold} ep`
                        : 'Not reached'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {comparisonResult.sarsaSummary.trainingTimeMs} ms
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {comparisonResult.sarsaSummary.evaluationTimeMs} ms
                    </td>
                  </tr>

                  {/* Goal-Based Baseline Row */}
                  {experimentMode === 'baseline' && comparisonResult.goalBasedSummary && (
                    <tr className="bg-sky-50/30 hover:bg-sky-50/60">
                      <td className="py-2.5 px-3 font-sans font-semibold text-sky-900">
                        Goal-Based Agent
                      </td>
                      <td className="py-2.5 px-3 font-sans text-sky-800">
                        Explicit Planner Baseline (Non-RL)
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        {comparisonResult.goalBasedSummary.successRate}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-sky-700">
                        {comparisonResult.goalBasedSummary.avgReward}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {comparisonResult.goalBasedSummary.avgSteps}
                      </td>
                      <td className="py-2.5 px-3 text-right text-rose-600">
                        {comparisonResult.goalBasedSummary.failureRate}%
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        N/A / {comparisonResult.goalBasedSummary.avgHazardHits}
                      </td>
                      <td className="py-2.5 px-3 text-right font-sans text-slate-500">
                        N/A (No Training)
                      </td>
                      <td className="py-2.5 px-3 text-right font-sans text-slate-500">
                        N/A (Explicit Search)
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {comparisonResult.goalBasedSummary.evaluationTimeMs} ms
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Overlaid Learning Curves & Trajectory Map */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-6">
              {/* Overlaid Reward Curve */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-900 mb-1">
                  Overlaid Learning Curves — Moving-Average Reward (15-Ep Window)
                </h3>
                <p className="text-xs text-slate-500 mb-3">
                  Compares sample efficiency and asymptotic return of Q-Learning vs. SARSA on identical seeds.
                </p>
                <div className="relative h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={overlaidData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="episode" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line
                        type="monotone"
                        dataKey="qRewardAvg"
                        name="Q-Learning Moving Avg"
                        stroke="#059669"
                        strokeWidth={2.5}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="sarsaRewardAvg"
                        name="SARSA Moving Avg"
                        stroke="#0d9488"
                        strokeWidth={2.5}
                        dot={false}
                      />
                      {experimentMode === 'baseline' && (
                        <Line
                          type="monotone"
                          dataKey="goalBaselineReward"
                          name="Goal-Based Planner Baseline (Non-RL)"
                          stroke="#0284c7"
                          strokeDasharray="5 5"
                          strokeWidth={2}
                          dot={false}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Overlaid Steps Curve */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-900 mb-1">
                  Overlaid Rolling Episode Steps to Goal
                </h3>
                <p className="text-xs text-slate-500 mb-3">
                  Notice how SARSA often takes slightly more steps in hazardous environments to maintain a safety margin.
                </p>
                <div className="relative h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={overlaidData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="episode" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line
                        type="monotone"
                        dataKey="qStepsAvg"
                        name="Q-Learning Avg Steps"
                        stroke="#059669"
                        strokeWidth={2.2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="sarsaStepsAvg"
                        name="SARSA Avg Steps"
                        stroke="#0d9488"
                        strokeWidth={2.2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Right: Evaluation Trajectory Inspector */}
            <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-emerald-600" />
                  Evaluation Trajectory Inspector
                </h3>
                <p className="text-xs text-slate-500">
                  Toggle below to inspect the final greedy trajectory (<span className="font-mono">ε = 0</span>) chosen by each agent on the grid.
                </p>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setSelectedTrajectoryAgent('q_learning')}
                    className={`py-2 px-2.5 rounded-lg border text-xs font-semibold transition ${
                      selectedTrajectoryAgent === 'q_learning'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Q-Learning ({comparisonResult.qLearningSummary.avgSteps} steps)
                  </button>
                  <button
                    onClick={() => setSelectedTrajectoryAgent('sarsa')}
                    className={`py-2 px-2.5 rounded-lg border text-xs font-semibold transition ${
                      selectedTrajectoryAgent === 'sarsa'
                        ? 'border-teal-500 bg-teal-50 text-teal-900'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    SARSA ({comparisonResult.sarsaSummary.avgSteps} steps)
                  </button>
                  <button
                    onClick={() => setSelectedTrajectoryAgent('goal_based')}
                    className={`py-2 px-2.5 rounded-lg border text-xs font-semibold transition ${
                      selectedTrajectoryAgent === 'goal_based'
                        ? 'border-sky-500 bg-sky-50 text-sky-900'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Goal Planner ({comparisonResult.goalBasedSummary?.avgSteps ?? 0} steps)
                  </button>
                </div>

                <GridCanvas
                  env={env}
                  agentPos={
                    activePath.length > 0
                      ? activePath[activePath.length - 1]
                      : env.startPos
                  }
                  trail={activePath}
                  plannedPath={activePath}
                  overlayMode="none"
                  compact={true}
                />
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                <strong>Active Route Summary:</strong>{' '}
                {activePath.map((p) => `(${p.row},${p.col})`).join(' → ')}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
