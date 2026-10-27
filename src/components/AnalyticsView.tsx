import React, { useState } from 'react';
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock,
  Info,
  TrendingUp,
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
import { CheckpointEvalRecord, EpisodeRecord } from '../types/rl';
import {
  computeAnalyticsSeries,
  interpretLearningCurves,
} from '../engine/analytics';
import { EmptyState } from './UIStates';

interface AnalyticsViewProps {
  history: EpisodeRecord[];
  checkpoints: CheckpointEvalRecord[];
  onQuickTrainEpisodes: (count: number) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  history,
  checkpoints,
  onQuickTrainEpisodes,
}) => {
  const [windowSize, setWindowSize] = useState<number>(15);

  const series = computeAnalyticsSeries(history, windowSize);
  const diagnostic = interpretLearningCurves(history, windowSize);

  if (history.length === 0) {
    return (
      <EmptyState
        title="No learning data yet"
        description="Episode rewards and learning curves will appear after you train an agent."
        icon={<BarChart3 className="h-6 w-6" />}
        action={{ label: 'Train 50 episodes', onClick: () => onQuickTrainEpisodes(50) }}
        secondaryAction={{ label: 'Train 150 episodes', onClick: () => onQuickTrainEpisodes(150) }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Moving-Average Window Control */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            Live Learning Analytics & Empirical Telemetry ({history.length} Episodes)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time curves generated strictly from recorded training episodes and greedy evaluation checkpoints.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-slate-700 flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            Moving-Average Window (W):
            <select
              value={windowSize}
              onChange={(e) => setWindowSize(Number(e.target.value))}
              className="bg-white border border-slate-300 rounded px-2 py-0.5 font-mono text-xs"
            >
              <option value={5}>5 episodes</option>
              <option value={10}>10 episodes</option>
              <option value={15}>15 episodes</option>
              <option value={25}>25 episodes</option>
              <option value={50}>50 episodes</option>
            </select>
          </label>
          <button
            onClick={() => onQuickTrainEpisodes(50)}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition"
          >
            +50 Episodes
          </button>
        </div>
      </div>

      {/* Automated Learning Curve Interpretation Panel */}
      <div
        className={`rounded-xl border p-4 space-y-2 ${
          diagnostic.tone === 'positive'
            ? 'bg-emerald-50/60 border-emerald-200'
            : diagnostic.tone === 'caution'
            ? 'bg-amber-50/70 border-amber-200'
            : 'bg-slate-50 border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            {diagnostic.tone === 'positive' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-teal-600" />
            )}
            <span>Empirical Curve Interpretation: {diagnostic.headline}</span>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            Rolling Window W = {windowSize}
          </span>
        </div>
        <ul className="space-y-1 text-xs text-slate-700 pl-6 list-disc">
          {diagnostic.observations.map((obs, i) => (
            <li key={i}>{obs}</li>
          ))}
        </ul>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>{diagnostic.scientificCaveat}</span>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1 & 2: Raw Episode Reward + Moving-Average Reward */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              1 & 2. Episode Reward vs. Moving-Average Return (W={windowSize})
            </h3>
            <p className="text-xs text-slate-500">
              Overlays noisy raw episodic return with the smoothed moving-average trendline.
            </p>
          </div>
          <div className="relative h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="episode" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="totalReward"
                  name="Raw Episode Reward"
                  stroke="#94a3b8"
                  strokeWidth={1.2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="movingAvgReward"
                  name={`Moving Avg (${windowSize} ep)`}
                  stroke="#059669"
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Rolling Success Rate */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              3. Goal Success Rate Over Rolling Window (%)
            </h3>
            <p className="text-xs text-slate-500">
              Percentage of episodes within the last {windowSize} runs that reached the terminal Goal cell.
            </p>
          </div>
          <div className="relative h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="episode" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="rollingSuccessRate"
                  name="Rolling Success Rate (%)"
                  stroke="#0d9488"
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Episode Length Over Time */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              4. Episode Length (Steps to Goal / Timeout) Over Time
            </h3>
            <p className="text-xs text-slate-500">
              Tracks how quickly the agent reaches the goal as suboptimal detours are pruned.
            </p>
          </div>
          <div className="relative h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="episode" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="steps"
                  name="Raw Steps"
                  stroke="#cbd5e1"
                  strokeWidth={1.2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="rollingAvgSteps"
                  name={`Rolling Avg Steps (${windowSize} ep)`}
                  stroke="#0284c7"
                  strokeWidth={2.4}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 5: Exploration Rate Decay */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              5. Exploration Probability (ε) Decay Schedule
            </h3>
            <p className="text-xs text-slate-500">
              Transition from initial random exploration toward greedy exploitation across episodes.
            </p>
          </div>
          <div className="relative h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="episode" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="epsilon"
                  name="Exploration Rate (ε)"
                  stroke="#6366f1"
                  strokeWidth={2.4}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 6: Training Time & Episode Throughput */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-600" />
              6. Cumulative Training Time (ms) & Episode Duration
            </h3>
            <p className="text-xs text-slate-500">
              Tracks wall-clock execution cost and simulation throughput across training episodes.
            </p>
          </div>
          <div className="relative h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="episode" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="cumulativeTimeMs"
                  name="Cumulative Training Time (ms)"
                  stroke="#475569"
                  strokeWidth={2.2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 7: Evaluation Performance Across Checkpoints */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              7. Greedy Policy Evaluation Performance Across Checkpoints (ε = 0)
            </h3>
            <p className="text-xs text-slate-500">
              Periodic noise-free greedy evaluations showing how the learned policy performs without exploratory actions.
            </p>
          </div>
          <div className="relative h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={checkpoints}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="episode" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="evalReward"
                  name="Checkpoint Greedy Eval Return"
                  stroke="#10b981"
                  strokeWidth={2.5}
                />
                <Line
                  type="monotone"
                  dataKey="evalSteps"
                  name="Checkpoint Greedy Steps"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
