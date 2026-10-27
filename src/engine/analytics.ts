import { EpisodeRecord } from '../types/rl';

export interface EnrichedEpisodeMetric extends EpisodeRecord {
  movingAvgReward: number;
  rollingSuccessRate: number;
  rollingAvgSteps: number;
  cumulativeTimeMs: number;
  episodesPerSec: number;
}

export function computeAnalyticsSeries(
  history: EpisodeRecord[],
  windowSize: number = 15
): EnrichedEpisodeMetric[] {
  const w = Math.max(1, windowSize);
  let cumTime = 0;

  return history.map((item, idx) => {
    const start = Math.max(0, idx - w + 1);
    const slice = history.slice(start, idx + 1);
    const avgReward = slice.reduce((s, r) => s + r.totalReward, 0) / slice.length;
    const succRate =
      (slice.filter((r) => r.reachedGoal).length / slice.length) * 100;
    const avgSteps = slice.reduce((s, r) => s + r.steps, 0) / slice.length;

    cumTime += item.durationMs;
    const epsPerSec = item.durationMs > 0 ? Math.min(5000, 1000 / item.durationMs) : 1000;

    return {
      ...item,
      movingAvgReward: Number(avgReward.toFixed(2)),
      rollingSuccessRate: Number(succRate.toFixed(1)),
      rollingAvgSteps: Number(avgSteps.toFixed(1)),
      cumulativeTimeMs: Number(cumTime.toFixed(2)),
      episodesPerSec: Number(epsPerSec.toFixed(1)),
    };
  });
}

export interface AnalyticsDiagnostic {
  headline: string;
  tone: 'neutral' | 'positive' | 'caution';
  observations: string[];
  scientificCaveat: string;
}

export function interpretLearningCurves(
  history: EpisodeRecord[],
  windowSize: number = 15
): AnalyticsDiagnostic {
  if (history.length === 0) {
    return {
      headline: 'No Training Episodes Recorded Yet',
      tone: 'neutral',
      observations: [
        'Start training or run single episodes to populate live reward, step, and exploration curves.',
      ],
      scientificCaveat:
        'Note: Apparent stability in a reward curve does not prove global convergence unless state-action space has been sufficiently explored.',
    };
  }

  const enriched = computeAnalyticsSeries(history, windowSize);
  const latest = enriched[enriched.length - 1];
  const firstQuarter = enriched.slice(0, Math.max(1, Math.floor(enriched.length / 4)));
  const lastQuarter = enriched.slice(Math.max(0, enriched.length - Math.max(1, Math.floor(enriched.length / 4))));

  const earlyAvgReward =
    firstQuarter.reduce((a, b) => a + b.totalReward, 0) / firstQuarter.length;
  const lateAvgReward =
    lastQuarter.reduce((a, b) => a + b.totalReward, 0) / lastQuarter.length;
  const rewardDelta = lateAvgReward - earlyAvgReward;

  const recentHazards =
    lastQuarter.reduce((a, b) => a + b.hazardHits, 0) / lastQuarter.length;

  const observations: string[] = [];

  if (rewardDelta > 15) {
    observations.push(
      `Improving Policy Return: Average reward increased from ${earlyAvgReward.toFixed(1)} in early episodes to ${lateAvgReward.toFixed(1)} in recent episodes (+${rewardDelta.toFixed(1)}).`
    );
  } else if (rewardDelta < -10) {
    observations.push(
      `Unstable or Degrading Return: Recent average reward (${lateAvgReward.toFixed(1)}) is lower than early training (${earlyAvgReward.toFixed(1)}). Consider reducing learning rate α or slowing ε decay.`
    );
  } else {
    observations.push(
      `Flat Return Trajectory: Moving-average reward has remained near ${lateAvgReward.toFixed(1)} across ${history.length} episodes.`
    );
  }

  if (latest.epsilon > 0.4) {
    observations.push(
      `High Exploration Regime (ε = ${latest.epsilon.toFixed(2)}): Frequent random actions still inject variance into episode returns and step counts.`
    );
  } else {
    observations.push(
      `Exploitation-Dominant Regime (ε = ${latest.epsilon.toFixed(2)}): The agent primarily follows its learned greedy Q-values (${latest.rollingSuccessRate}% recent goal completion).`
    );
  }

  if (recentHazards > 0.3) {
    observations.push(
      `Hazard Exposure Detected: Recent episodes average ${recentHazards.toFixed(2)} hazard encounters per episode, causing negative reward spikes.`
    );
  } else if (latest.rollingSuccessRate >= 80) {
    observations.push(
      `Low Hazard Exposure: The agent reaches the goal in ${latest.rollingAvgSteps.toFixed(1)} steps on average with minimal hazard penalties.`
    );
  }

  return {
    headline:
      latest.rollingSuccessRate >= 80
        ? 'Consistent Goal-Reaching Policy Observed'
        : latest.epsilon > 0.4
        ? 'Active Exploration Phase in Progress'
        : 'Sub-Optimal Policy or Exploration Bottleneck',
    tone:
      latest.rollingSuccessRate >= 80
        ? 'positive'
        : latest.rollingSuccessRate >= 40 || latest.epsilon > 0.4
        ? 'neutral'
        : 'caution',
    observations,
    scientificCaveat:
      'Methodological Note: A plateau in the moving-average reward curve indicates behavioral stabilization under the current ε schedule, not guaranteed convergence to the true optimal Q* function.',
  };
}
