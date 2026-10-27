import React, { useState } from 'react';
import {
  Compass,
  Flag,
  Flame,
  Gem,
  Lock,
  Radio,
  Sparkles,
} from 'lucide-react';
import {
  Action,
  EnvironmentConfig,
  GridCoord,
  QTable,
  TileType,
  VisitTable,
} from '../types/rl';
import {
  ACTION_DELTAS,
  ALL_ACTIONS,
  coordToKey,
  coordsEqual,
} from '../engine/environment';
import { getBestActions, getMaxQValue, getStateQValues } from '../engine/agents';

export type GridOverlayMode = 'none' | 'policy_arrows' | 'q_split' | 'visits';

interface GridCanvasProps {
  env: EnvironmentConfig;
  agentPos: GridCoord;
  trail?: GridCoord[];
  plannedPath?: GridCoord[];
  qTable?: QTable;
  visitTable?: VisitTable;
  overlayMode?: GridOverlayMode;
  selectedCell?: GridCoord | null;
  onSelectCell?: (coord: GridCoord) => void;
  editable?: boolean;
  activePaintTool?: TileType;
  onPaintCell?: (coord: GridCoord, tool: TileType) => void;
  compact?: boolean;
  showLegend?: boolean;
}

export const GridCanvas: React.FC<GridCanvasProps> = ({
  env,
  agentPos,
  trail = [],
  plannedPath = [],
  qTable,
  visitTable,
  overlayMode = 'policy_arrows',
  selectedCell,
  onSelectCell,
  editable = false,
  activePaintTool = 'obstacle',
  onPaintCell,
  compact = false,
  showLegend = true,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredCoord, setHoveredCoord] = useState<GridCoord | null>(null);

  // Compute min/max Q for color normalization
  let maxAbsQ = 1;
  if (qTable) {
    for (const q of Object.values(qTable)) {
      for (const a of ALL_ACTIONS) {
        maxAbsQ = Math.max(maxAbsQ, Math.abs(q[a]));
      }
    }
  }

  let maxVisits = 1;
  if (visitTable) {
    for (const v of Object.values(visitTable)) {
      maxVisits = Math.max(maxVisits, v);
    }
  }

  const trailSet = new Map<string, number>();
  trail.forEach((c, idx) => {
    trailSet.set(coordToKey(c), idx);
  });

  const plannedSet = new Set<string>(plannedPath.map(coordToKey));

  const handleCellDown = (coord: GridCoord) => {
    if (editable && onPaintCell) {
      setIsDragging(true);
      onPaintCell(coord, activePaintTool);
    } else if (onSelectCell) {
      onSelectCell(coord);
    }
  };

  const handleCellEnter = (coord: GridCoord) => {
    setHoveredCoord(coord);
    if (editable && isDragging && onPaintCell) {
      onPaintCell(coord, activePaintTool);
    }
  };

  const getQColorBg = (val: number): string => {
    if (Math.abs(val) < 1e-5) return 'rgba(241, 245, 249, 0.5)';
    const ratio = Math.min(1, Math.abs(val) / maxAbsQ);
    if (val > 0) {
      return `rgba(16, 185, 129, ${(0.1 + ratio * 0.42).toFixed(2)})`;
    }
    return `rgba(244, 63, 94, ${(0.1 + ratio * 0.42).toFixed(2)})`;
  };

  const cellMinSize = compact ? (env.cols > 8 ? 34 : 40) : 48;

  return (
    <div
      className="flex flex-col gap-3 select-none"
      onPointerUp={() => setIsDragging(false)}
      onPointerCancel={() => setIsDragging(false)}
      onPointerLeave={() => {
        setIsDragging(false);
        setHoveredCoord(null);
      }}
    >
      <div className="relative bg-slate-100/80 p-3 rounded-xl border border-slate-200 shadow-inner overflow-x-auto">
        <div
          className="grid gap-1 mx-auto"
          style={{
            gridTemplateColumns: `repeat(${env.cols}, minmax(0, 1fr))`,
            minWidth: `${env.cols * cellMinSize + (env.cols - 1) * 4}px`,
            maxWidth: compact ? '480px' : '640px',
          }}
        >
          {env.grid.map((rowTiles, r) =>
            rowTiles.map((tile, c) => {
              const coord = { row: r, col: c };
              const key = coordToKey(coord);
              const isAgentHere = coordsEqual(agentPos, coord);
              const isSelected = selectedCell ? coordsEqual(selectedCell, coord) : false;
              const isTrail = trailSet.has(key);
              const isPlanned = plannedSet.has(key);

              const visits = visitTable?.[key] ?? 0;
              const stateQ = qTable ? getStateQValues(qTable, key) : { UP: 0, RIGHT: 0, DOWN: 0, LEFT: 0 };
              const maxQ = qTable ? getMaxQValue(qTable, key) : 0;
              const hasLearnedValue =
                Math.abs(stateQ.UP) > 1e-6 ||
                Math.abs(stateQ.RIGHT) > 1e-6 ||
                Math.abs(stateQ.DOWN) > 1e-6 ||
                Math.abs(stateQ.LEFT) > 1e-6;
              const bestActions: Action[] =
                qTable && hasLearnedValue ? getBestActions(qTable, key) : [];

              let tileClasses =
                'bg-white border-slate-200/90 text-slate-700 hover:border-emerald-400';
              if (tile === 'obstacle') {
                tileClasses =
                  'bg-slate-800 border-slate-900 text-slate-300 shadow-inner';
              } else if (tile === 'start') {
                tileClasses =
                  'bg-teal-50/90 border-teal-300 text-teal-900';
              } else if (tile === 'goal') {
                tileClasses =
                  'bg-emerald-50 border-emerald-400 text-emerald-900 ring-1 ring-emerald-400/40';
              } else if (tile === 'hazard') {
                tileClasses =
                  'bg-rose-50/90 border-rose-300 text-rose-900';
              } else if (tile === 'reward') {
                tileClasses =
                  'bg-sky-50/90 border-sky-300 text-sky-900';
              } else if (tile === 'teleporter') {
                tileClasses =
                  'bg-indigo-50/90 border-indigo-300 text-indigo-900';
              }

              // Dynamic heatmap background for empty tiles
              let inlineBg: string | undefined = undefined;
              if (tile === 'empty') {
                if (overlayMode === 'visits' && visits > 0) {
                  const vRatio = Math.min(1, visits / maxVisits);
                  inlineBg = `rgba(20, 184, 166, ${(0.06 + vRatio * 0.28).toFixed(2)})`;
                } else if (
                  (overlayMode === 'policy_arrows' || overlayMode === 'q_split') &&
                  hasLearnedValue
                ) {
                  inlineBg = getQColorBg(maxQ);
                }
              }

              return (
                <div
                  key={key}
                  role="button"
                  tabIndex={0}
                  aria-label={`Grid cell ${r + 1}, ${c + 1}: ${tile}${isAgentHere ? ', agent location' : ''}`}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleCellDown(coord);
                    }
                  }}
                  onPointerDown={() => handleCellDown(coord)}
                  onPointerEnter={() => handleCellEnter(coord)}
                  style={inlineBg ? { backgroundColor: inlineBg } : undefined}
                  className={`relative rounded-lg border transition-all duration-150 flex flex-col items-center justify-center p-1 aspect-square overflow-hidden focus-visible:ring-2 focus-visible:ring-emerald-600 ${editable ? 'touch-none' : ''} ${tileClasses} ${
                    editable ? 'cursor-crosshair' : 'cursor-pointer'
                  } ${
                    isSelected
                      ? 'ring-2 ring-emerald-600 border-emerald-600 z-10'
                      : ''
                  }`}
                >
                  {/* Coordinate label top-left */}
                  <span
                    className={`absolute top-0.5 left-1 text-[8px] font-mono leading-none ${
                      tile === 'obstacle' ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    {r},{c}
                  </span>

                  {/* Visit count badge top-right */}
                  {visits > 0 && tile !== 'obstacle' && !compact && (
                    <span className="absolute top-0.5 right-1 text-[9px] font-mono text-slate-400 leading-none">
                      {visits}v
                    </span>
                  )}

                  {/* Planned path highlight ring */}
                  {isPlanned && tile !== 'obstacle' && (
                    <div className="absolute inset-1 rounded-md border-2 border-dashed border-sky-500/70 pointer-events-none" />
                  )}

                  {/* Trail breadcrumb dot */}
                  {isTrail && !isAgentHere && tile !== 'obstacle' && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500/50 animate-pulse pointer-events-none" />
                  )}

                  {/* Tile Type Icons */}
                  {tile === 'obstacle' && (
                    <Lock className="w-4 h-4 text-slate-500 opacity-75" />
                  )}
                  {tile === 'start' && !isAgentHere && (
                    <div className="flex flex-col items-center justify-center gap-0.5">
                      <Compass className="w-3.5 h-3.5 text-teal-600" />
                      <span className="text-[8px] font-bold uppercase tracking-wider text-teal-700 leading-none">
                        Start
                      </span>
                    </div>
                  )}
                  {tile === 'goal' && (
                    <div className="flex flex-col items-center justify-center gap-0.5">
                      <Flag className="w-3.5 h-3.5 text-emerald-600 fill-emerald-500/20" />
                      <span className="text-[8px] font-bold uppercase tracking-wider text-emerald-700 leading-none">
                        Goal
                      </span>
                    </div>
                  )}
                  {tile === 'hazard' && (
                    <div className="flex flex-col items-center justify-center gap-0.5">
                      <Flame className="w-3.5 h-3.5 text-rose-600" />
                      {!compact && (
                        <span className="text-[8px] font-semibold text-rose-700 leading-none">
                          Hazard
                        </span>
                      )}
                    </div>
                  )}
                  {tile === 'reward' && (
                    <div className="flex flex-col items-center justify-center gap-0.5">
                      <Gem className="w-3.5 h-3.5 text-sky-600" />
                      {!compact && (
                        <span className="text-[8px] font-semibold text-sky-700 leading-none">
                          Bonus
                        </span>
                      )}
                    </div>
                  )}
                  {tile === 'teleporter' && (
                    <div className="flex flex-col items-center justify-center gap-0.5">
                      <Radio className="w-3.5 h-3.5 text-indigo-600" />
                      {!compact && (
                        <span className="text-[8px] font-semibold text-indigo-700 leading-none">
                          Portal
                        </span>
                      )}
                    </div>
                  )}

                  {/* Policy Arrows & Q-Value Overlay for traversable non-terminal cells */}
                  {tile !== 'obstacle' &&
                    tile !== 'goal' &&
                    !isAgentHere &&
                    overlayMode === 'policy_arrows' &&
                    bestActions.length > 0 && (
                      <div className="flex flex-col items-center justify-center pointer-events-none mt-1">
                        <div className="flex items-center gap-0.5 text-slate-800 font-bold text-[9px] leading-none">
                          {bestActions.map((a) => (
                            <span key={a}>{ACTION_DELTAS[a].symbol}</span>
                          ))}
                        </div>
                        {!compact && (
                          <span className="text-[7px] font-mono text-slate-600 leading-tight mt-0.5">
                            {maxQ.toFixed(1)}
                          </span>
                        )}
                      </div>
                    )}

                  {/* 4-Way Split Q-Value View */}
                  {tile !== 'obstacle' &&
                    tile !== 'goal' &&
                    !isAgentHere &&
                    overlayMode === 'q_split' &&
                    !compact && (
                      <div className="inset-0 w-full h-full flex flex-col justify-between items-center text-[8px] font-mono text-slate-700 pointer-events-none py-0.5">
                        <span className={bestActions.includes('UP') ? 'font-bold text-emerald-700' : ''}>
                          ↑{stateQ.UP.toFixed(0)}
                        </span>
                        <div className="w-full flex justify-between px-0.5">
                          <span className={bestActions.includes('LEFT') ? 'font-bold text-emerald-700' : ''}>
                            ←{stateQ.LEFT.toFixed(0)}
                          </span>
                          <span className={bestActions.includes('RIGHT') ? 'font-bold text-emerald-700' : ''}>
                            {stateQ.RIGHT.toFixed(0)}→
                          </span>
                        </div>
                        <span className={bestActions.includes('DOWN') ? 'font-bold text-emerald-700' : ''}>
                          ↓{stateQ.DOWN.toFixed(0)}
                        </span>
                      </div>
                    )}

                  {/* Unexplored indicator in policy mode */}
                  {tile === 'empty' &&
                    !isAgentHere &&
                    overlayMode === 'policy_arrows' &&
                    !hasLearnedValue &&
                    visits === 0 &&
                    !compact && (
                      <span className="text-[8px] font-mono text-slate-300 leading-tight text-center px-0.5">
                        unvisited
                      </span>
                    )}

                  {/* Active Autonomous Agent Marker */}
                  {isAgentHere && (
                    <div
                      title={`Agent at (${r}, ${c})`}
                      className="z-20 w-6 h-6 rounded-full bg-emerald-600 text-white shadow-md border-2 border-white flex items-center justify-center transition-transform duration-150 scale-105"
                    >
                      <Sparkles className="w-3 h-3" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Hover Tooltip Bar */}
      {hoveredCoord && qTable && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold text-slate-800">
              State ({hoveredCoord.row}, {hoveredCoord.col})
            </span>
            <span className="px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-700 capitalize text-[11px]">
              {env.grid[hoveredCoord.row][hoveredCoord.col]}
            </span>
            <span className="text-slate-500">
              Visits: <strong>{visitTable?.[coordToKey(hoveredCoord)] ?? 0}</strong>
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px]">
            {ALL_ACTIONS.map((act) => {
              const qv = getStateQValues(qTable, coordToKey(hoveredCoord))[act];
              return (
                <span key={act} className="text-slate-700">
                  {ACTION_DELTAS[act].symbol} {act}:{' '}
                  <strong className={qv > 0 ? 'text-emerald-700' : qv < 0 ? 'text-rose-600' : 'text-slate-600'}>
                    {qv.toFixed(2)}
                  </strong>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Visual Legend */}
      {showLegend && (
        <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-slate-600 px-1">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block" /> Agent
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-teal-100 border border-teal-400 inline-block" /> Start (S)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-500 inline-block" /> Goal (G)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-slate-800 inline-block" /> Obstacle (#)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-rose-100 border border-rose-400 inline-block" /> Hazard (!)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-sky-100 border border-sky-400 inline-block" /> Bonus (+)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-indigo-100 border border-indigo-400 inline-block" /> Teleporter (T)
          </span>
          {plannedPath.length > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded border-2 border-dashed border-sky-500 inline-block" /> Planned Route
            </span>
          )}
        </div>
      )}
    </div>
  );
};
