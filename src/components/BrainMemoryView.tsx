import React, { useRef } from 'react';
import { BrainCheckpoint, AgentBrainState, AlgorithmType, EnvironmentConfig } from '../types/rl';
import { EmptyState, WarningBanner } from './UIStates';

interface BrainMemoryViewProps {
  brains: Partial<Record<AlgorithmType, AgentBrainState | null>>;
  checkpoints: Partial<Record<AlgorithmType, BrainCheckpoint | null>>;
  activeAlgorithm: AlgorithmType;
  environment: EnvironmentConfig;
  storageMessage: string;
  restorationMessage: string;
  isSaving?: boolean;
  isImporting?: boolean;
  onSave: () => void;
  onSelectAlgorithm: (algorithm: AlgorithmType) => void;
  onResume: () => void;
  onEvaluate: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onReset: () => void;
}

const labels: Record<AlgorithmType, string> = {
  q_learning: 'Q-Learning',
  sarsa: 'SARSA',
  goal_based: 'Goal-Based Planner',
};

export const BrainMemoryView: React.FC<BrainMemoryViewProps> = ({
  brains,
  checkpoints,
  activeAlgorithm,
  environment,
  storageMessage,
  restorationMessage,
  isSaving = false,
  isImporting = false,
  onSave,
  onSelectAlgorithm,
  onResume,
  onEvaluate,
  onExport,
  onImport,
  onReset,
}) => {
  const brain = brains[activeAlgorithm];
  const checkpoint = checkpoints[activeAlgorithm];
  const isPlanner = activeAlgorithm === 'goal_based';
  const exploredStates = brain?.visitTable
    ? Object.values(brain.visitTable).filter((count) => count > 0).length
    : 0;
  const qTableSize = brain?.qTable ? Object.keys(brain.qTable).length : 0;
  const importInputRef = useRef<HTMLInputElement>(null);
  const environmentMismatch = Boolean(brain && brain.environmentId !== environment.id);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Brain &amp; Memory</h2>
            <p className="text-xs text-slate-500 mt-1">
              Persistent local memory for each agent. IndexedDB survives refreshes and browser restarts,
              but it does not synchronize across browsers or devices.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
            {storageMessage}
          </span>
        </div>
        {restorationMessage && (
          <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
            {restorationMessage}
          </div>
        )}
      </div>

      {/(unavailable|failed|could not)/i.test(storageMessage) && (
        <WarningBanner
          title="Storage needs attention"
          action={{ label: 'Retry Save', onClick: onSave }}
          secondaryAction={{ label: 'Export Brain', onClick: onExport }}
        >
          {storageMessage} Saving is unavailable until the browser storage problem is resolved. Export any recoverable brain data for a backup.
        </WarningBanner>
      )}

      <div className="flex flex-wrap gap-2">
        {(Object.keys(labels) as AlgorithmType[]).map((algorithm) => (
          <button
            key={algorithm}
            type="button"
            onClick={() => onSelectAlgorithm(algorithm)}
            className={`px-3 py-2 rounded-lg border text-xs font-semibold ${
              activeAlgorithm === algorithm
                ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                : 'border-slate-200 text-slate-600'
            }`}
          >
            {labels[algorithm]}
          </button>
        ))}
      </div>

      {!brain && (
        <EmptyState
          title={isPlanner ? 'Planner settings are not saved yet' : 'No saved brain found'}
          description={isPlanner ? 'The goal-based planner searches the known grid and does not learn a Q-table through training.' : 'This agent has not saved any learned knowledge in this browser yet.'}
          action={{ label: isPlanner ? 'Run Planner' : 'Train New Agent', onClick: onResume }}
          secondaryAction={{ label: 'Import Brain', onClick: () => importInputRef.current?.click() }}
        />
      )}
      {environmentMismatch && (
        <WarningBanner title="This brain belongs to another environment">
          The saved brain is preserved and is not compatible with the currently selected grid. Restore its associated environment or train a separate brain for this layout.
        </WarningBanner>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          ['Brain status', brain?.status ?? 'Fresh'],
          ['Saved episodes', String(brain?.completedEpisodes ?? 0)],
          ['Explored states', isPlanner ? 'Planner route' : String(exploredStates)],
          ['Q-table states', isPlanner ? 'No Q-table' : String(qTableSize)],
          ['Environment', brain?.environmentId ?? environment.id],
          ['Last checkpoint', checkpoint ? `${checkpoint.completedEpisodes} episodes` : 'None'],
          ['Last saved', brain ? new Date(brain.updatedAt).toLocaleString() : 'Not saved'],
          ['Last evaluation', brain?.lastEvaluation ? `${brain.lastEvaluation.successRate}% success` : 'Not evaluated'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-medium text-slate-500">{label}</div>
            <div className="mt-1 text-sm font-bold text-slate-900 break-words">{value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900">Memory actions</h3>
        <p className="text-xs text-slate-500 mt-1">
          The planner stores its strategy and route configuration only; it never pretends to learn a Q-table.
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          <button type="button" onClick={onSave} disabled={isSaving} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50">
            {isSaving ? 'Saving brain…' : 'Save Brain'}
          </button>
          <button type="button" onClick={onResume} disabled={isPlanner} className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold disabled:opacity-40">
            Resume Learning
          </button>
          <button type="button" onClick={onEvaluate} className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold">
            Evaluate Brain
          </button>
          <button type="button" onClick={onExport} className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold">
            Export Brain
          </button>
          <label className={`px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold ${isImporting ? 'cursor-wait opacity-60' : 'cursor-pointer'}`}>
            {isImporting ? 'Reviewing import…' : 'Import Brain'}
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              disabled={isImporting}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onImport(file);
                event.currentTarget.value = '';
              }}
            />
          </label>
          <button type="button" onClick={onReset} className="px-3 py-2 rounded-lg border border-rose-200 text-rose-700 text-xs font-semibold">
            Reset Brain
          </button>
        </div>
      </div>

      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-xs text-slate-600 space-y-2">
        <p><strong>Configuration:</strong> environment, rewards, and hyperparameters associated with the brain.</p>
        <p><strong>Learned Q-table:</strong> state-action values updated from real transitions; policy arrows are derived from these values.</p>
        <p><strong>Episode history:</strong> training outcomes stored separately from the core brain for faster startup.</p>
        <p><strong>Evaluation:</strong> greedy measurement that does not change Q-values, epsilon, counters, or training history.</p>
        <p><strong>Browser limitation:</strong> closing the page stops JavaScript; the latest completed checkpoint is resumed when you return.</p>
      </div>
    </div>
  );
};
