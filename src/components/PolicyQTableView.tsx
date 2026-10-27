import React, { useState } from 'react';
import {
  Compass,
  Eye,
  Info,
  Search,
  Table,
} from 'lucide-react';
import {
  Action,
  EnvironmentConfig,
  GridCoord,
  QTable,
  VisitTable,
} from '../types/rl';
import {
  ACTION_DELTAS,
  ALL_ACTIONS,
  coordToKey,
  getAvailableActions,
} from '../engine/environment';
import {
  getBestActions,
  getMaxQValue,
  getStateQValues,
} from '../engine/agents';
import { GridCanvas, GridOverlayMode } from './GridCanvas';
import { EmptyState, WarningBanner } from './UIStates';

interface PolicyQTableViewProps {
  env: EnvironmentConfig;
  agentPos: GridCoord;
  qLearningTable: QTable;
  sarsaTable: QTable;
  qLearningVisits: VisitTable;
  sarsaVisits: VisitTable;
  activeAlgorithm: 'q_learning' | 'sarsa';
  onSwitchInspectedAlgorithm: (alg: 'q_learning' | 'sarsa') => void;
}

export const PolicyQTableView: React.FC<PolicyQTableViewProps> = ({
  env,
  agentPos,
  qLearningTable,
  sarsaTable,
  qLearningVisits,
  sarsaVisits,
  activeAlgorithm,
  onSwitchInspectedAlgorithm,
}) => {
  const [selectedCell, setSelectedCell] = useState<GridCoord>(env.startPos);
  const [overlayMode, setOverlayMode] = useState<GridOverlayMode>('q_split');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [hideUnvisited, setHideUnvisited] = useState<boolean>(false);

  const activeQTable = activeAlgorithm === 'q_learning' ? qLearningTable : sarsaTable;
  const activeVisits = activeAlgorithm === 'q_learning' ? qLearningVisits : sarsaVisits;

  const selectedKey = coordToKey(selectedCell);
  const selectedQ = getStateQValues(activeQTable, selectedKey);
  const selectedVisits = activeVisits[selectedKey] ?? 0;
  const selectedTile = env.grid[selectedCell.row]?.[selectedCell.col] ?? 'empty';
  const availableActions = getAvailableActions(env, selectedCell);
  const hasAnyNonZeroSelected = ALL_ACTIONS.some((a) => Math.abs(selectedQ[a]) > 1e-6);
  const bestActionsSelected = hasAnyNonZeroSelected
    ? getBestActions(activeQTable, selectedKey)
    : [];

  // Build rows for Q-Table
  const tableRows: {
    coord: GridCoord;
    key: string;
    tile: string;
    visits: number;
    q: Record<Action, number>;
    maxQ: number;
    bestActions: Action[];
    isExplored: boolean;
  }[] = [];

  let exploredCount = 0;
  let traversableCount = 0;

  for (let r = 0; r < env.rows; r++) {
    for (let c = 0; c < env.cols; c++) {
      const tile = env.grid[r][c];
      const key = `${r},${c}`;
      const visits = activeVisits[key] ?? 0;
      const q = getStateQValues(activeQTable, key);
      const maxQ = getMaxQValue(activeQTable, key);
      const hasVal = ALL_ACTIONS.some((a) => Math.abs(q[a]) > 1e-6);
      const isExplored = visits > 0 || hasVal;

      if (tile !== 'obstacle') {
        traversableCount++;
        if (isExplored) exploredCount++;
      }

      if (hideUnvisited && !isExplored) continue;
      if (
        searchFilter.trim() !== '' &&
        !key.includes(searchFilter.trim()) &&
        !tile.toLowerCase().includes(searchFilter.trim().toLowerCase())
      ) {
        continue;
      }

      tableRows.push({
        coord: { row: r, col: c },
        key,
        tile,
        visits,
        q,
        maxQ,
        bestActions: hasVal ? getBestActions(activeQTable, key) : [],
        isExplored,
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Algorithm Switcher */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Table className="w-4 h-4 text-emerald-600" />
            State-Action Q-Table & Learned Policy Explorer
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Inspect internal state-action values <span className="font-mono">Q(s, a)</span>, directional greedy policies, and state exploration coverage.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Switch between Q-Learning and SARSA tables */}
          <div className="inline-flex rounded-lg bg-slate-100 p-1 border border-slate-200">
            <button
              onClick={() => onSwitchInspectedAlgorithm('q_learning')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                activeAlgorithm === 'q_learning'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Q-Learning Table
            </button>
            <button
              onClick={() => onSwitchInspectedAlgorithm('sarsa')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                activeAlgorithm === 'sarsa'
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              SARSA Table
            </button>
          </div>

          {/* Overlay mode switcher */}
          <div className="inline-flex rounded-lg bg-slate-100 p-1 border border-slate-200 text-xs">
            <button
              onClick={() => setOverlayMode('q_split')}
              className={`px-2.5 py-1.5 rounded-md font-medium transition ${
                overlayMode === 'q_split'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600'
              }`}
            >
              4-Action Q Split
            </button>
            <button
              onClick={() => setOverlayMode('policy_arrows')}
              className={`px-2.5 py-1.5 rounded-md font-medium transition ${
                overlayMode === 'policy_arrows'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600'
              }`}
            >
              Policy Arrows
            </button>
            <button
              onClick={() => setOverlayMode('visits')}
              className={`px-2.5 py-1.5 rounded-md font-medium transition ${
                overlayMode === 'visits'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600'
              }`}
            >
              Visit Heatmap
            </button>
          </div>
        </div>
      </div>

      {/* Educational Banner about Unexplored States */}
      <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-3.5 flex items-start gap-3 text-xs text-sky-900">
        <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Interpreting Unexplored & Zero-Valued States:</span>{' '}
          Currently <strong>{exploredCount} of {traversableCount}</strong> traversable states have been visited or updated ({Math.round((exploredCount / Math.max(1, traversableCount)) * 100)}% coverage). States with <span className="font-mono">0 visits</span> and equal <span className="font-mono">Q(s,a) = 0.00</span> have not yet received reward backpropagation—their uniform values reflect initialization rather than a converged indifference policy.
        </div>
      </div>

      {/* Split View: Interactive Grid Policy Map + Detailed State Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Compass className="w-4 h-4 text-emerald-600" />
              Interactive Policy & Value Map ({activeAlgorithm === 'q_learning' ? 'Q-Learning' : 'SARSA'})
            </h3>
            <span className="text-xs text-slate-500">
              Click any cell to inspect its exact action values
            </span>
          </div>
          <GridCanvas
            env={env}
            agentPos={agentPos}
            qTable={activeQTable}
            visitTable={activeVisits}
            overlayMode={overlayMode}
            selectedCell={selectedCell}
            onSelectCell={(c) => setSelectedCell(c)}
          />
        </div>

        {/* Right: Single-State Inspector */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-teal-600" />
                  State Value Inspector
                </h3>
                <p className="text-xs text-slate-500">
                  Detailed breakdown for coordinate <span className="font-mono font-semibold text-slate-800">({selectedCell.row}, {selectedCell.col})</span>
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold capitalize bg-slate-100 text-slate-800 border border-slate-200">
                Tile: {selectedTile}
              </span>
            </div>

            {/* Metadata pills */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[11px] text-slate-500">State Visits</div>
                <div className="text-sm font-mono font-bold text-slate-900 mt-0.5">
                  {selectedVisits}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[11px] text-slate-500">Max Q(s, a)</div>
                <div className="text-sm font-mono font-bold text-emerald-700 mt-0.5">
                  {getMaxQValue(activeQTable, selectedKey).toFixed(3)}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[11px] text-slate-500">Greedy Policy</div>
                <div className="text-sm font-mono font-bold text-teal-700 mt-0.5">
                  {selectedTile === 'goal'
                    ? 'TERMINAL'
                    : selectedTile === 'obstacle'
                    ? 'WALL'
                    : bestActionsSelected.length > 0
                    ? bestActionsSelected.map((a) => `${ACTION_DELTAS[a].symbol} ${a}`).join(', ')
                    : 'UNEXPLORED'}
                </div>
              </div>
            </div>

            {/* 4 Directional Action Value Bars */}
            <div className="space-y-2.5 pt-2">
              <div className="text-xs font-semibold text-slate-800">
                Action-Value Estimates Q((r={selectedCell.row}, c={selectedCell.col}), a)
              </div>
              {ALL_ACTIONS.map((act) => {
                const val = selectedQ[act];
                const isBest = bestActionsSelected.includes(act);
                const isWallBlocked = !availableActions.includes(act);
                const barWidth = Math.min(100, Math.max(6, Math.abs(val)));

                return (
                  <div
                    key={act}
                    className={`p-2.5 rounded-lg border transition ${
                      isBest
                        ? 'border-emerald-400 bg-emerald-50/40'
                        : 'border-slate-200 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-800">
                          {ACTION_DELTAS[act].symbol}
                        </span>
                        <span className="font-semibold text-slate-800">
                          {ACTION_DELTAS[act].label}
                        </span>
                        {isBest && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            GREEDY BEST
                          </span>
                        )}
                        {isWallBlocked && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px]">
                            Blocked by Wall
                          </span>
                        )}
                      </div>
                      <span
                        className={`font-mono font-bold ${
                          val > 0
                            ? 'text-emerald-700'
                            : val < 0
                            ? 'text-rose-600'
                            : 'text-slate-600'
                        }`}
                      >
                        {val.toFixed(4)}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          val > 0
                            ? 'bg-emerald-500'
                            : val < 0
                            ? 'bg-rose-500'
                            : 'bg-slate-400'
                        }`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
            <strong>Tip:</strong> Compare the Q-Learning and SARSA tables using the switcher at the top right to see how on-policy exploration alters values near hazard tiles.
          </div>
        </div>
      </div>

      {/* Full Tabular Q-Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Complete State-Action Q-Table ({tableRows.length} states shown)
            </h3>
            <p className="text-xs text-slate-500">
              Click any row to highlight that state in the visual inspector above.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={hideUnvisited}
                onChange={(e) => setHideUnvisited(e.target.checked)}
                className="rounded text-emerald-600"
              />
              Hide Unvisited States
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder="Filter by coord (e.g. 2,3) or tile..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-8 pr-3 py-1 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {exploredCount === 0 && (
          <WarningBanner title="No learned values yet">
            The Q-table has not received any training visits. Its displayed zero values are initialization values, not learned preferences.
          </WarningBanner>
        )}

        {tableRows.length === 0 ? (
          <EmptyState
            title="No matching results"
            description="Try another search term or clear the active filters."
            action={{
              label: 'Clear filters',
              onClick: () => {
                setSearchFilter('');
                setHideUnvisited(false);
              },
            }}
          />
        ) : <div className="overflow-x-auto max-h-96 border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="py-2.5 px-3">State (r, c)</th>
                <th className="py-2.5 px-3">Tile Type</th>
                <th className="py-2.5 px-3 text-right">Visits</th>
                <th className="py-2.5 px-3 text-right">Q(s, ↑ UP)</th>
                <th className="py-2.5 px-3 text-right">Q(s, → RIGHT)</th>
                <th className="py-2.5 px-3 text-right">Q(s, ↓ DOWN)</th>
                <th className="py-2.5 px-3 text-right">Q(s, ← LEFT)</th>
                <th className="py-2.5 px-3 text-right">max Q(s,a)</th>
                <th className="py-2.5 px-3">Greedy Policy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {tableRows.map((row) => {
                const isSel =
                  row.coord.row === selectedCell.row &&
                  row.coord.col === selectedCell.col;
                return (
                  <tr
                    key={row.key}
                    onClick={() => setSelectedCell(row.coord)}
                    className={`cursor-pointer transition ${
                      isSel ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-2 px-3 font-semibold text-slate-900">
                      ({row.coord.row}, {row.coord.col})
                    </td>
                    <td className="py-2 px-3 font-sans capitalize text-slate-600">
                      {row.tile}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-600">
                      {row.visits}
                    </td>
                    {ALL_ACTIONS.map((a) => {
                      const v = row.q[a];
                      const isBest = row.bestActions.includes(a);
                      return (
                        <td
                          key={a}
                          className={`py-2 px-3 text-right ${
                            isBest
                              ? 'font-bold text-emerald-700 bg-emerald-50/40'
                              : v < 0
                              ? 'text-rose-600'
                              : 'text-slate-600'
                          }`}
                        >
                          {v.toFixed(2)}
                        </td>
                      );
                    })}
                    <td className="py-2 px-3 text-right font-bold text-slate-900">
                      {row.maxQ.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 font-sans">
                      {row.tile === 'goal' ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                          Terminal Goal
                        </span>
                      ) : row.tile === 'obstacle' ? (
                        <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px]">
                          Obstacle
                        </span>
                      ) : row.bestActions.length > 0 ? (
                        <span className="font-semibold text-emerald-700">
                          {row.bestActions.map((a) => ACTION_DELTAS[a].symbol).join(' ')} (
                          {row.bestActions.join('/')})
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">
                          Unexplored (0.00)
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>}
      </div>
    </div>
  );
};
