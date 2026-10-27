import React, { useState } from 'react';
import {
  Archive,
  CheckCircle2,
  ClipboardCheck,
  Code2,
  Copy,
  Download,
  FileJson,
  FileSpreadsheet,
  FlaskConical,
  FolderOpen,
  GitCompare,
  Play,
  Save,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  AlgorithmType,
  EnvironmentConfig,
  EpisodeRecord,
  EvaluationSummary,
  Hyperparameters,
  PlannerConfig,
  RewardConfig,
  SavedExperiment,
  UnitTestResult,
} from '../types/rl';
import {
  exportEpisodesToCSV,
  exportExperimentToJSON,
} from '../engine/experiments';
import { runAllVerificationTests } from '../tests/rl.test';
import { EmptyState } from './UIStates';

interface ExperimentsAndTestsViewProps {
  env: EnvironmentConfig;
  algorithm: AlgorithmType;
  hyperparams: Hyperparameters;
  rewardConfig: RewardConfig;
  plannerConfig: PlannerConfig;
  history: EpisodeRecord[];
  latestEvalSummary: EvaluationSummary;
  savedExperiments: SavedExperiment[];
  onSaveExperiment: (exp: SavedExperiment) => void;
  onDeleteExperiment: (id: string) => void;
  onLoadExperiment: (exp: SavedExperiment) => void;
}

export const ExperimentsAndTestsView: React.FC<ExperimentsAndTestsViewProps> = ({
  env,
  algorithm,
  hyperparams,
  rewardConfig,
  plannerConfig,
  history,
  latestEvalSummary,
  savedExperiments,
  onSaveExperiment,
  onDeleteExperiment,
  onLoadExperiment,
}) => {
  const [subTab, setSubTab] = useState<'experiments' | 'tests' | 'readme'>('experiments');
  const [expName, setExpName] = useState<string>(`${env.name} — ${algorithm.toUpperCase()} Seed ${hyperparams.seed}`);
  const [saveKind, setSaveKind] = useState<'completed_run' | 'config_only'>('completed_run');
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [exportPreviewText, setExportPreviewText] = useState<{ title: string; content: string } | null>(null);
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<UnitTestResult[]>(() => runAllVerificationTests());

  const handleSave = () => {
    const cleanName = expName.trim() || `${env.name} (${algorithm})`;
    const isCompleted = saveKind === 'completed_run' && history.length > 0;
    const newExp: SavedExperiment = {
      id: `exp_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: cleanName,
      createdAt: new Date().toISOString(),
      kind: isCompleted ? 'completed_run' : 'config_only',
      isDemo: false,
      environment: JSON.parse(JSON.stringify(env)),
      algorithm,
      hyperparameters: { ...hyperparams },
      rewardConfig: { ...rewardConfig },
      plannerConfig: { ...plannerConfig },
      episodesCompleted: isCompleted ? history.length : 0,
      evaluationSummary: isCompleted ? { ...latestEvalSummary } : undefined,
      finalHistorySample: isCompleted ? history.slice(-30) : undefined,
    };
    onSaveExperiment(newExp);
  };

  const handleDuplicate = (exp: SavedExperiment) => {
    const dup: SavedExperiment = {
      ...JSON.parse(JSON.stringify(exp)),
      id: `exp_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: `${exp.name} (Copy)`,
      createdAt: new Date().toISOString(),
      isDemo: false,
    };
    onSaveExperiment(dup);
  };

  const toggleCompareSelection = (id: string) => {
    setSelectedForCompare((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const triggerDownload = (filename: string, text: string, mime: string) => {
    try {
      const blob = new Blob([text], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback to preview panel if sandbox restricts anchor downloads
    }
  };

  const handleExportCSV = () => {
    const csv = exportEpisodesToCSV(history);
    setExportPreviewText({
      title: `Episode Metrics CSV (${history.length} episodes)`,
      content: csv,
    });
    triggerDownload(`rl_studio_metrics_seed_${hyperparams.seed}.csv`, csv, 'text/csv');
    setCopiedNotice('CSV export prepared. If the download was blocked, copy it from the preview below.');
    setTimeout(() => setCopiedNotice(null), 4500);
  };

  const handleExportJSON = (exp?: SavedExperiment) => {
    const target: SavedExperiment = exp ?? {
      id: `current_${Date.now()}`,
      name: expName || `${env.name} Config`,
      createdAt: new Date().toISOString(),
      kind: history.length > 0 ? 'completed_run' : 'config_only',
      environment: env,
      algorithm,
      hyperparameters: hyperparams,
      rewardConfig,
      plannerConfig,
      episodesCompleted: history.length,
      evaluationSummary: latestEvalSummary,
    };
    const json = exportExperimentToJSON(target);
    setExportPreviewText({
      title: `Experiment JSON (${target.name})`,
      content: json,
    });
    triggerDownload(`rl_experiment_${target.id}.json`, json, 'application/json');
    setCopiedNotice('JSON export prepared. If the download was blocked, copy it from the preview below.');
    setTimeout(() => setCopiedNotice(null), 4500);
  };

  const copyToClipboard = (text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedNotice('Copied to clipboard!');
      setTimeout(() => setCopiedNotice(null), 2500);
    } catch {
      setCopiedNotice('Displayed in preview box below.');
    }
  };

  const comparedExperiments = savedExperiments.filter((e) =>
    selectedForCompare.includes(e.id)
  );

  const passedCount = testResults.filter((t) => t.passed).length;

  return (
    <div className="space-y-6">
      {/* Sub-navigation bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <button
            onClick={() => setSubTab('experiments')}
            className={`min-w-0 px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition ${
              subTab === 'experiments'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Archive className="w-4 h-4" />
            Experiment Registry & Exports ({savedExperiments.length})
          </button>
          <button
            onClick={() => {
              setSubTab('tests');
              setTestResults(runAllVerificationTests());
            }}
            className={`min-w-0 px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition ${
              subTab === 'tests'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <FlaskConical className="w-4 h-4" />
            Correctness Verification Suite ({passedCount}/{testResults.length} Passing)
          </button>
          <button
            onClick={() => setSubTab('readme')}
            className={`min-w-0 px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition ${
              subTab === 'readme'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Code2 className="w-4 h-4" />
            Architecture & Local Setup README
          </button>
        </div>

        {copiedNotice && (
          <span role="status" aria-live="polite" className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
            {copiedNotice}
          </span>
        )}
      </div>

      {subTab === 'experiments' && (
        <div className="space-y-6">
          {/* Save & Export Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Save Reproducible Experiment or Export Telemetry
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Persist environment topology, hyperparameters, reward weights, seed ({hyperparams.seed}), and empirical evaluation results to browser storage.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleExportCSV}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 transition"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  Export Results CSV ({history.length} ep)
                </button>
                <button
                  onClick={() => handleExportJSON()}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 transition"
                >
                  <FileJson className="w-4 h-4 text-teal-600" />
                  Export Config JSON
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-3 border-t border-slate-100">
              <div className="md:col-span-6">
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Experiment Label
                </label>
                <input
                  type="text"
                  value={expName}
                  onChange={(e) => setExpName(e.target.value)}
                  placeholder="e.g. Hazardous Grid — SARSA Conservative Policy"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="md:col-span-4">
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Snapshot Type
                </label>
                <select
                  value={saveKind}
                  onChange={(e) =>
                    setSaveKind(e.target.value as 'completed_run' | 'config_only')
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white"
                >
                  <option value="completed_run">
                    Completed Run (Config + {history.length} Ep Results)
                  </option>
                  <option value="config_only">
                    Configuration Template Only (0 Episodes)
                  </option>
                </select>
              </div>
              <div className="md:col-span-2 flex items-end">
                <button
                  onClick={handleSave}
                  className="w-full py-2 px-3 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 inline-flex items-center justify-center gap-1.5 transition"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
              </div>
            </div>
          </div>

          {/* Side-by-Side Experiment Comparison Table (when >=2 selected) */}
          {comparedExperiments.length >= 2 && (
            <div className="bg-white rounded-xl border border-emerald-300 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <GitCompare className="w-4 h-4 text-emerald-600" />
                  Side-by-Side Experiment Comparison ({comparedExperiments.length} selected)
                </h3>
                <button
                  onClick={() => setSelectedForCompare([])}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Clear Selection
                </button>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <tr>
                      <th className="py-2 px-3">Experiment Name</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3">Environment</th>
                      <th className="py-2 px-3">Algorithm</th>
                      <th className="py-2 px-3 text-right">α / γ / ε-decay</th>
                      <th className="py-2 px-3 text-right">Seed</th>
                      <th className="py-2 px-3 text-right">Episodes</th>
                      <th className="py-2 px-3 text-right">Eval Success</th>
                      <th className="py-2 px-3 text-right">Eval Return</th>
                      <th className="py-2 px-3 text-right">Eval Steps</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {comparedExperiments.map((exp) => (
                      <tr key={exp.id}>
                        <td className="py-2 px-3 font-sans font-semibold text-slate-900">
                          {exp.name}
                        </td>
                        <td className="py-2 px-3 font-sans">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              exp.kind === 'completed_run'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {exp.kind === 'completed_run' ? 'Completed Run' : 'Config Template'}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-sans text-slate-700">
                          {exp.environment.name} ({exp.environment.rows}×{exp.environment.cols})
                        </td>
                        <td className="py-2 px-3 uppercase">{exp.algorithm}</td>
                        <td className="py-2 px-3 text-right">
                          {exp.hyperparameters.alpha} / {exp.hyperparameters.gamma} /{' '}
                          {exp.hyperparameters.epsilonDecay}
                        </td>
                        <td className="py-2 px-3 text-right">{exp.hyperparameters.seed}</td>
                        <td className="py-2 px-3 text-right">{exp.episodesCompleted}</td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-700">
                          {exp.evaluationSummary ? `${exp.evaluationSummary.successRate}%` : '—'}
                        </td>
                        <td className="py-2 px-3 text-right font-bold">
                          {exp.evaluationSummary ? exp.evaluationSummary.avgReward : '—'}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {exp.evaluationSummary ? exp.evaluationSummary.avgSteps : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Saved Experiments Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {savedExperiments.length === 0 ? (
              <div className="md:col-span-2">
                <EmptyState
                  title="No saved experiments"
                  description="Save a training configuration and its results to revisit or compare it later."
                  action={{ label: 'Create Experiment', onClick: handleSave }}
                />
              </div>
            ) : savedExperiments.map((exp) => {
              const isSelected = selectedForCompare.includes(exp.id);
              return (
                <div
                  key={exp.id}
                  className={`bg-white rounded-xl border p-4 shadow-sm flex flex-col justify-between gap-3 transition ${
                    isSelected
                      ? 'border-emerald-500 ring-1 ring-emerald-500/30'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-bold text-slate-900">
                            {exp.name}
                          </h4>
                          {exp.isDemo && (
                            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-semibold">
                              Preconfigured Demo Data
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              exp.kind === 'completed_run'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {exp.kind === 'completed_run'
                              ? 'Completed Training Results'
                              : 'Saved Configuration Only'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Environment: <strong>{exp.environment.name}</strong> ({exp.environment.rows}×{exp.environment.cols}) • Algorithm: <strong className="uppercase">{exp.algorithm}</strong> • Seed: <span className="font-mono">{exp.hyperparameters.seed}</span>
                        </p>
                      </div>
                      <label className="inline-flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleCompareSelection(exp.id)}
                          className="rounded text-emerald-600"
                        />
                        Compare
                      </label>
                    </div>

                    {/* Hyperparams & Eval Summary Pills */}
                    <div className="grid grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                      <div className="p-2 rounded bg-slate-50 border border-slate-100">
                        <span className="text-slate-400 block text-[10px]">α / γ</span>
                        <span className="font-semibold text-slate-800">
                          {exp.hyperparameters.alpha} / {exp.hyperparameters.gamma}
                        </span>
                      </div>
                      <div className="p-2 rounded bg-slate-50 border border-slate-100">
                        <span className="text-slate-400 block text-[10px]">Episodes</span>
                        <span className="font-semibold text-slate-800">
                          {exp.episodesCompleted}
                        </span>
                      </div>
                      <div className="p-2 rounded bg-slate-50 border border-slate-100">
                        <span className="text-slate-400 block text-[10px]">Eval Success</span>
                        <span className="font-semibold text-emerald-700">
                          {exp.evaluationSummary
                            ? `${exp.evaluationSummary.successRate}%`
                            : 'Config Only'}
                        </span>
                      </div>
                      <div className="p-2 rounded bg-slate-50 border border-slate-100">
                        <span className="text-slate-400 block text-[10px]">Eval Return</span>
                        <span className="font-semibold text-slate-800">
                          {exp.evaluationSummary
                            ? exp.evaluationSummary.avgReward
                            : '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onLoadExperiment(exp)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold hover:bg-emerald-100 inline-flex items-center gap-1 transition"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        Load Experiment
                      </button>
                      <button
                        onClick={() => handleDuplicate(exp)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs hover:bg-slate-50 inline-flex items-center gap-1 transition"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Duplicate
                      </button>
                      <button
                        onClick={() => handleExportJSON(exp)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs hover:bg-slate-50 inline-flex items-center gap-1 transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        JSON
                      </button>
                    </div>
                    {!exp.isDemo && (
                      <button
                        onClick={() => onDeleteExperiment(exp.id)}
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition"
                        title="Delete Experiment"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Export Preview Modal/Drawer */}
          {exportPreviewText && (
            <div className="bg-white rounded-xl border border-slate-300 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  {exportPreviewText.title}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(exportPreviewText.content)}
                    className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 inline-flex items-center gap-1.5"
                  >
                    <ClipboardCheck className="w-3.5 h-3.5" />
                    Copy Raw Content
                  </button>
                  <button
                    onClick={() => setExportPreviewText(null)}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>
              </div>
              <pre className="p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto max-h-64">
                {exportPreviewText.content}
              </pre>
            </div>
          )}
        </div>
      )}

      {subTab === 'tests' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-emerald-600" />
                Automated Mathematical & Functional Verification Suite
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Live execution of all 10 unit assertions verifying Bellman backups, terminal states, ε-greedy distributions, obstacle physics, and export fidelity.
              </p>
            </div>
            <button
              onClick={() => setTestResults(runAllVerificationTests())}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 inline-flex items-center gap-1.5 transition"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Re-Run All 10 Unit Tests
            </button>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {testResults.map((t) => (
              <div
                key={t.id}
                className="p-3.5 bg-white hover:bg-slate-50/70 flex flex-wrap items-start justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  {t.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        {t.name}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium">
                        {t.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-mono mt-1">
                      {t.assertionDetails}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  {t.durationMs} ms
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === 'readme' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4 text-xs text-slate-700 leading-relaxed">
          <h2 className="text-base font-bold text-slate-900">
            RL Grid World Studio — Technical Architecture & Local Setup Guide
          </h2>
          <p>
            <strong>RL Grid World Studio — Autonomous Agent Intelligence Lab</strong> is built with a clean, modular React + TypeScript + Vite + Tailwind CSS architecture separating mathematical simulation engines from reactive visualization components.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="font-bold text-slate-900">Modular Directory Layout</div>
              <pre className="font-mono text-[11px] text-slate-700 overflow-x-auto">
{`rl-grid-world-studio/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── README.md
└── src/
    ├── types/rl.ts          # Domain & MDP interfaces
    ├── engine/
    │   ├── prng.ts          # Seeded Mulberry32 PRNG
    │   ├── environment.ts   # Grid physics & presets
    │   ├── agents.ts        # Q-Learning, SARSA, A*/BFS
    │   ├── training.ts      # Step/episode & eval runners
    │   ├── analytics.ts     # Rolling stats & diagnostics
    │   └── experiments.ts   # LocalStorage & CSV/JSON export
    ├── tests/rl.test.ts     # 10 mathematical unit tests
    └── components/          # 8 interactive studio views`}
              </pre>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="font-bold text-slate-900">Running the Project Locally</div>
              <pre className="font-mono text-[11px] bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto">
{`# 1. Unzip project archive and install dependencies
unzip rl_grid_world_studio_project.zip
cd rl-grid-world-studio
npm install

# 2. Start Vite development server
npm run dev

# 3. Run mathematical verification suite
npm test

# 4. Production build
npm run build`}
              </pre>
              <p className="text-[11px] text-slate-500">
                The architecture uses deterministic transition mechanics by default and abstracts <span className="font-mono">stepEnvironment()</span> so stochastic slip transitions can be plugged in without changing agent interfaces.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
