import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Compass,
  Eraser,
  Flag,
  Flame,
  Gem,
  Grid,
  Lock,
  Radio,
  RotateCcw,
  Sliders,
  Sparkles,
  Wand2,
} from 'lucide-react';
import {
  EnvironmentConfig,
  GridCoord,
  PlannerConfig,
  RewardConfig,
  TileType,
} from '../types/rl';
import {
  ENVIRONMENT_PRESETS,
  REWARD_PRESETS,
  validateEnvironment,
} from '../engine/environment';
import { computeGoalBasedPlan } from '../engine/agents';
import { GridCanvas } from './GridCanvas';

interface EnvironmentStudioViewProps {
  env: EnvironmentConfig;
  rewardConfig: RewardConfig;
  plannerConfig: PlannerConfig;
  onUpdateEnv: (newEnv: EnvironmentConfig) => void;
  onUpdateRewardConfig: (newReward: RewardConfig) => void;
  onUpdatePlannerConfig: (newPlanner: PlannerConfig) => void;
  onResetEnvironmentToPreset: () => void;
}

export const EnvironmentStudioView: React.FC<EnvironmentStudioViewProps> = ({
  env,
  rewardConfig,
  plannerConfig,
  onUpdateEnv,
  onUpdateRewardConfig,
  onUpdatePlannerConfig,
  onResetEnvironmentToPreset,
}) => {
  const [activeTool, setActiveTool] = useState<TileType>('obstacle');
  const [showOptimalPreview, setShowOptimalPreview] = useState<boolean>(true);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const validation = validateEnvironment(env);
  const optimalPlan = computeGoalBasedPlan(env, rewardConfig, plannerConfig);

  const handlePaintCell = (coord: GridCoord, tool: TileType) => {
    setValidationMessage(null);
    const { row, col } = coord;
    const currentTile = env.grid[row][col];

    // Prevent overwriting Start or Goal with obstacles/hazards
    if (
      (row === env.startPos.row && col === env.startPos.col) ||
      (row === env.goalPos.row && col === env.goalPos.col)
    ) {
      if (tool !== 'start' && tool !== 'goal') {
        setValidationMessage(
          'Protected Tile: Move the Start or Goal position to another cell first instead of overwriting it.'
        );
        return;
      }
    }

    const nextGrid = env.grid.map((r) => [...r]);
    let nextStart = { ...env.startPos };
    let nextGoal = { ...env.goalPos };

    if (tool === 'start') {
      if (row === env.goalPos.row && col === env.goalPos.col) {
        setValidationMessage('Invalid Placement: Start and Goal cannot share the same coordinate.');
        return;
      }
      nextGrid[env.startPos.row][env.startPos.col] = 'empty';
      nextGrid[row][col] = 'start';
      nextStart = { row, col };
    } else if (tool === 'goal') {
      if (row === env.startPos.row && col === env.startPos.col) {
        setValidationMessage('Invalid Placement: Goal and Start cannot share the same coordinate.');
        return;
      }
      nextGrid[env.goalPos.row][env.goalPos.col] = 'empty';
      nextGrid[row][col] = 'goal';
      nextGoal = { row, col };
    } else {
      nextGrid[row][col] = currentTile === tool && tool !== 'empty' ? 'empty' : tool;
    }

    onUpdateEnv({
      ...env,
      id: 'custom',
      name: env.name.includes('(Custom)') ? env.name : `${env.name} (Custom)`,
      grid: nextGrid,
      startPos: nextStart,
      goalPos: nextGoal,
    });
  };

  const handleResizeGrid = (newRows: number, newCols: number) => {
    const rCount = Math.max(4, Math.min(12, newRows));
    const cCount = Math.max(4, Math.min(12, newCols));
    const newGrid: TileType[][] = [];

    for (let r = 0; r < rCount; r++) {
      const rowArr: TileType[] = [];
      for (let c = 0; c < cCount; c++) {
        const existing = env.grid[r]?.[c];
        if (existing && existing !== 'start' && existing !== 'goal') {
          rowArr.push(existing);
        } else {
          rowArr.push('empty');
        }
      }
      newGrid.push(rowArr);
    }

    const startPos = {
      row: Math.min(env.startPos.row, rCount - 1),
      col: Math.min(env.startPos.col, cCount - 1),
    };
    let goalPos = {
      row: Math.min(env.goalPos.row, rCount - 1),
      col: Math.min(env.goalPos.col, cCount - 1),
    };
    if (startPos.row === goalPos.row && startPos.col === goalPos.col) {
      goalPos = { row: rCount - 1, col: cCount - 1 };
    }

    newGrid[startPos.row][startPos.col] = 'start';
    newGrid[goalPos.row][goalPos.col] = 'goal';

    onUpdateEnv({
      ...env,
      id: 'custom',
      name: `Custom ${rCount}×${cCount} Grid`,
      rows: rCount,
      cols: cCount,
      grid: newGrid,
      startPos,
      goalPos,
    });
  };

  const handleClearGrid = () => {
    const cleanGrid: TileType[][] = Array.from({ length: env.rows }, () =>
      Array.from({ length: env.cols }, () => 'empty' as TileType)
    );
    const s = { row: 0, col: 0 };
    const g = { row: env.rows - 1, col: env.cols - 1 };
    cleanGrid[s.row][s.col] = 'start';
    cleanGrid[g.row][g.col] = 'goal';
    onUpdateEnv({
      ...env,
      id: 'custom_blank',
      name: 'Blank Custom Grid',
      description: 'Clean grid environment ready for custom obstacle, hazard, and reward design.',
      grid: cleanGrid,
      startPos: s,
      goalPos: g,
    });
  };

  const handleGenerateRandomLayout = () => {
    const newGrid: TileType[][] = Array.from({ length: env.rows }, () =>
      Array.from({ length: env.cols }, () => 'empty' as TileType)
    );
    const s = { row: 0, col: 0 };
    const g = { row: env.rows - 1, col: env.cols - 1 };

    for (let r = 0; r < env.rows; r++) {
      for (let c = 0; c < env.cols; c++) {
        if ((r === s.row && c === s.col) || (r === g.row && c === g.col)) continue;
        const roll = Math.random();
        if (roll < 0.18) newGrid[r][c] = 'obstacle';
        else if (roll < 0.26) newGrid[r][c] = 'hazard';
        else if (roll < 0.32) newGrid[r][c] = 'reward';
      }
    }
    newGrid[s.row][s.col] = 'start';
    newGrid[g.row][g.col] = 'goal';

    onUpdateEnv({
      ...env,
      id: 'custom_random',
      name: 'Procedural Research Grid',
      description: 'Randomly synthesized obstacle, hazard, and bonus layout.',
      grid: newGrid,
      startPos: s,
      goalPos: g,
    });
  };

  const paintTools: { type: TileType; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
    {
      type: 'obstacle',
      label: 'Obstacle (#)',
      desc: 'Impassable wall',
      icon: <Lock className="w-4 h-4" />,
      color: 'bg-slate-800 text-white border-slate-900',
    },
    {
      type: 'hazard',
      label: 'Hazard (!)',
      desc: `${rewardConfig.hazardPenalty} penalty`,
      icon: <Flame className="w-4 h-4 text-rose-600" />,
      color: 'bg-rose-50 text-rose-900 border-rose-300',
    },
    {
      type: 'reward',
      label: 'Bonus (+)',
      desc: `+${rewardConfig.rewardTileValue} once/ep`,
      icon: <Gem className="w-4 h-4 text-sky-600" />,
      color: 'bg-sky-50 text-sky-900 border-sky-300',
    },
    {
      type: 'teleporter',
      label: 'Portal (T)',
      desc: 'Paired warp tile',
      icon: <Radio className="w-4 h-4 text-indigo-600" />,
      color: 'bg-indigo-50 text-indigo-900 border-indigo-300',
    },
    {
      type: 'start',
      label: 'Start (S)',
      desc: 'Agent spawn cell',
      icon: <Compass className="w-4 h-4 text-teal-600" />,
      color: 'bg-teal-50 text-teal-900 border-teal-300',
    },
    {
      type: 'goal',
      label: 'Goal (G)',
      desc: `+${rewardConfig.goalReward} terminal`,
      icon: <Flag className="w-4 h-4 text-emerald-600" />,
      color: 'bg-emerald-50 text-emerald-900 border-emerald-400',
    },
    {
      type: 'empty',
      label: 'Eraser',
      desc: 'Clear to empty cell',
      icon: <Eraser className="w-4 h-4 text-slate-600" />,
      color: 'bg-white text-slate-800 border-slate-300',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Preset Selector Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Grid className="w-4 h-4 text-emerald-600" />
              Environment Presets & Topology Architect
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select a curated benchmark topology or sculpt a custom grid world to test how environment geometry and rewards shape behavior.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleClearGrid}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Clear Grid
            </button>
            <button
              onClick={handleGenerateRandomLayout}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 transition"
            >
              <Wand2 className="w-3.5 h-3.5 text-teal-600" />
              Randomize Tiles
            </button>
            <button
              onClick={onResetEnvironmentToPreset}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restore Preset
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {ENVIRONMENT_PRESETS.map((preset) => {
            const active = env.id === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => onUpdateEnv(preset)}
                className={`text-left p-3 rounded-xl border transition-all ${
                  active
                    ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500/30'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/40'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-slate-900">
                    {preset.name}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                    {preset.rows}×{preset.cols}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                  {preset.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Split Studio: Left Interactive Grid Canvas, Right Reward Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Grid Builder (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Interactive Grid Canvas ({env.rows} × {env.cols})
              </h3>
              <p className="text-xs text-slate-500">
                Click or drag across cells to place the selected environment element.
              </p>
            </div>

            {/* Grid Dimensions Control */}
            <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
              <label className="flex items-center gap-1.5 text-slate-700 font-medium">
                Rows:
                <input
                  type="number"
                  min={4}
                  max={12}
                  value={env.rows}
                  onChange={(e) => handleResizeGrid(Number(e.target.value), env.cols)}
                  className="w-12 px-1.5 py-0.5 rounded border border-slate-300 bg-white text-center font-mono"
                />
              </label>
              <span className="text-slate-300">×</span>
              <label className="flex items-center gap-1.5 text-slate-700 font-medium">
                Cols:
                <input
                  type="number"
                  min={4}
                  max={12}
                  value={env.cols}
                  onChange={(e) => handleResizeGrid(env.rows, Number(e.target.value))}
                  className="w-12 px-1.5 py-0.5 rounded border border-slate-300 bg-white text-center font-mono"
                />
              </label>
            </div>
          </div>

          {/* Paint Palette */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
            {paintTools.map((t) => {
              const isSelected = activeTool === t.type;
              return (
                <button
                  key={t.type}
                  onClick={() => setActiveTool(t.type)}
                  aria-pressed={isSelected}
                  className={`flex w-full min-h-[66px] flex-col justify-center rounded-lg border p-2 text-left transition-all duration-150 ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-500/30 shadow-sm'
                      : 'border-slate-200 bg-slate-50/30 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="grid w-full grid-cols-[18px_minmax(0,1fr)] items-center gap-1.5 leading-none">
                    <span
                      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center [&>svg]:block [&>svg]:h-4 [&>svg]:w-4 ${
                        isSelected ? 'text-emerald-700' : 'text-slate-700'
                      }`}
                    >
                      {t.icon}
                    </span>
                    <span
                      className={`min-w-0 truncate text-[11px] font-semibold leading-tight ${
                        isSelected ? 'text-emerald-900' : 'text-slate-800'
                      }`}
                    >
                      {t.label}
                    </span>
                  </div>

                  <div
                    className={`mt-1 h-3 overflow-hidden pl-[22px] text-ellipsis text-[10px] leading-3 whitespace-nowrap ${
                      isSelected ? 'text-emerald-700' : 'text-slate-500'
                    }`}
                  >
                    {t.desc}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Validation / Reachability Status Banner */}
          {validationMessage && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>{validationMessage}</span>
            </div>
          )}

          <div
            className={`flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg border text-xs ${
              validation.reachable
                ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {validation.reachable ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>
                {validation.reachable
                  ? `Valid Topology: Goal is reachable (minimum ${validation.shortestSteps} steps; current reward-aware route: ${optimalPlan.actions.length} steps, expected return: ${optimalPlan.expectedReward}).`
                  : validation.warnings[0] || 'Goal is unreachable from Start.'}
              </span>
            </div>
            <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
              <input
                type="checkbox"
                checked={showOptimalPreview}
                onChange={(e) => setShowOptimalPreview(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              Show Optimal Route Preview
            </label>
          </div>

          {/* Interactive Grid */}
          <GridCanvas
            env={env}
            agentPos={env.startPos}
            plannedPath={showOptimalPreview && optimalPlan.reachable ? optimalPlan.path : []}
            editable={true}
            activePaintTool={activeTool}
            onPaintCell={handlePaintCell}
            overlayMode="none"
          />
        </div>

        {/* Right: Reward Configuration Studio (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-600" />
                Reward Configuration Studio
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure Markov Decision Process (MDP) reward signals. Reward definitions apply identically across Q-Learning, SARSA, and the Goal-Based Planner.
              </p>
            </div>

            {/* Reward Presets */}
            <div>
              <span className="text-xs font-medium text-slate-700 block mb-2">
                Reward Shaping Presets
              </span>
              <div className="grid grid-cols-2 gap-2">
                {REWARD_PRESETS.map((rp) => {
                  const isMatch =
                    rewardConfig.goalReward === rp.config.goalReward &&
                    rewardConfig.stepCost === rp.config.stepCost &&
                    rewardConfig.hazardPenalty === rp.config.hazardPenalty &&
                    rewardConfig.rewardTileValue === rp.config.rewardTileValue;
                  return (
                    <button
                      key={rp.id}
                      onClick={() => onUpdateRewardConfig({ ...rp.config })}
                      className={`p-2.5 rounded-lg border text-left transition ${
                        isMatch
                          ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500/30'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-xs font-semibold text-slate-900">
                        {rp.name}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                        {rp.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sliders for each reward parameter */}
            <div className="space-y-3.5 pt-2 border-t border-slate-100">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-700">Goal Terminal Reward</span>
                  <span className="font-mono font-semibold text-emerald-700">
                    +{rewardConfig.goalReward}
                  </span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={300}
                  step={5}
                  value={rewardConfig.goalReward}
                  onChange={(e) =>
                    onUpdateRewardConfig({
                      ...rewardConfig,
                      goalReward: Number(e.target.value),
                    })
                  }
                  className="w-full accent-emerald-600"
                />
                <p className="text-[11px] text-slate-500">
                  Awarded when the agent enters the terminal Goal cell (G).
                </p>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-700">Per-Step Transition Cost</span>
                  <span className="font-mono font-semibold text-slate-700">
                    {rewardConfig.stepCost}
                  </span>
                </div>
                <input
                  type="range"
                  min={-15}
                  max={0}
                  step={0.5}
                  value={rewardConfig.stepCost}
                  onChange={(e) =>
                    onUpdateRewardConfig({
                      ...rewardConfig,
                      stepCost: Number(e.target.value),
                    })
                  }
                  className="w-full accent-emerald-600"
                />
                <p className="text-[11px] text-slate-500">
                  Applied on every valid movement step; negative values incentivize shorter paths.
                </p>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-700">Hazard Tile Penalty (!)</span>
                  <span className="font-mono font-semibold text-rose-600">
                    {rewardConfig.hazardPenalty}
                  </span>
                </div>
                <input
                  type="range"
                  min={-150}
                  max={-2}
                  step={2}
                  value={rewardConfig.hazardPenalty}
                  onChange={(e) =>
                    onUpdateRewardConfig({
                      ...rewardConfig,
                      hazardPenalty: Number(e.target.value),
                    })
                  }
                  className="w-full accent-rose-600"
                />
                <p className="text-[11px] text-slate-500">
                  Incurred when stepping onto a traversable hazard cell (!).
                </p>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-700">Obstacle / Wall Collision Penalty (#)</span>
                  <span className="font-mono font-semibold text-amber-700">
                    {rewardConfig.obstaclePenalty}
                  </span>
                </div>
                <input
                  type="range"
                  min={-30}
                  max={-0.5}
                  step={0.5}
                  value={rewardConfig.obstaclePenalty}
                  onChange={(e) =>
                    onUpdateRewardConfig({
                      ...rewardConfig,
                      obstaclePenalty: Number(e.target.value),
                    })
                  }
                  className="w-full accent-amber-600"
                />
                <p className="text-[11px] text-slate-500">
                  Attempting to move into a wall (#) or grid boundary blocks movement (agent stays in place) and incurs this penalty.
                </p>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-700">Collectible Bonus Tile Value (+)</span>
                  <span className="font-mono font-semibold text-sky-700">
                    +{rewardConfig.rewardTileValue}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={80}
                  step={5}
                  value={rewardConfig.rewardTileValue}
                  onChange={(e) =>
                    onUpdateRewardConfig({
                      ...rewardConfig,
                      rewardTileValue: Number(e.target.value),
                    })
                  }
                  className="w-full accent-sky-600"
                />
                <p className="text-[11px] text-slate-500">
                  Bonus collected at most once per tile per episode to prevent infinite reward loops.
                </p>
              </div>
            </div>

            {/* Goal-Based Planner Preferences */}
            <div className="pt-3 border-t border-slate-100 space-y-2.5">
              <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                Goal-Based Planner Baseline Preferences
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  onClick={() =>
                    onUpdatePlannerConfig({
                      ...plannerConfig,
                      strategy: 'astar_reward_aware',
                    })
                  }
                  className={`px-2.5 py-1.5 rounded-lg border font-medium transition ${
                    plannerConfig.strategy === 'astar_reward_aware'
                      ? 'bg-teal-50 border-teal-500 text-teal-900'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Cost-Aware A* Search
                </button>
                <button
                  onClick={() =>
                    onUpdatePlannerConfig({
                      ...plannerConfig,
                      strategy: 'bfs_shortest',
                    })
                  }
                  className={`px-2.5 py-1.5 rounded-lg border font-medium transition ${
                    plannerConfig.strategy === 'bfs_shortest'
                      ? 'bg-teal-50 border-teal-500 text-teal-900'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Unweighted BFS Shortest
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700 pt-1">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={plannerConfig.avoidHazardsStrictly}
                    onChange={(e) =>
                      onUpdatePlannerConfig({
                        ...plannerConfig,
                        avoidHazardsStrictly: e.target.checked,
                      })
                    }
                    className="rounded text-teal-600"
                  />
                  Strictly Avoid Hazards
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={plannerConfig.collectRewards}
                    onChange={(e) =>
                      onUpdatePlannerConfig({
                        ...plannerConfig,
                        collectRewards: e.target.checked,
                      })
                    }
                    className="rounded text-teal-600"
                  />
                  Detour for Profitable Bonuses
                </label>
              </div>
            </div>
          </div>

          {/* Transition Rule Specification Box */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
            <div className="font-semibold text-slate-800">
              Formal Transition & Collision Specification
            </div>
            <p>
              • <strong>Deterministic Dynamics:</strong> Selecting action <span className="font-mono">a ∈ &#123;UP, RIGHT, DOWN, LEFT&#125;</span> transitions the agent to the adjacent cell unless blocked.
            </p>
            <p>
              • <strong>Blocked Obstacle Moves:</strong> Attempting to enter an obstacle (<span className="font-mono">#</span>) or outer wall keeps the agent at state <span className="font-mono">s&apos; = s</span> and returns <span className="font-mono">{rewardConfig.obstaclePenalty}</span>.
            </p>
            <p>
              • <strong>Terminal State:</strong> Entering Goal (<span className="font-mono">G</span>) yields <span className="font-mono">+{rewardConfig.goalReward} + ({rewardConfig.stepCost})</span> and ends the episode (<span className="font-mono">done = true</span>).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
