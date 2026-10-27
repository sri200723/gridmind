import React, { useState } from 'react';
import {
  Award,
  BookOpen,
  Calculator,
  CheckCircle2,
  Circle,
  Compass,
  Lightbulb,
  Play,
  Sparkles,
} from 'lucide-react';
import {
  ControlledComparisonResult,
  EnvironmentConfig,
  EpisodeRecord,
  EvaluationSummary,
} from '../types/rl';

interface LearningGuideViewProps {
  env: EnvironmentConfig;
  history: EpisodeRecord[];
  latestEvalSummary: EvaluationSummary;
  comparisonResult: ControlledComparisonResult | null;
  onLaunchGuidedChallenge: () => void;
  onNavigateTab: (tab: string) => void;
}

export const LearningGuideView: React.FC<LearningGuideViewProps> = ({
  env,
  history,
  latestEvalSummary,
  comparisonResult,
  onLaunchGuidedChallenge,
  onNavigateTab,
}) => {
  const [activeLesson, setActiveLesson] = useState<number>(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [completedLessons, setCompletedLessons] = useState<Set<number>>(
    () => new Set()
  );

  // Interactive Bellman Sandbox state
  const [sandboxQsa, setSandboxQsa] = useState<number>(10);
  const [sandboxReward, setSandboxReward] = useState<number>(-1);
  const [sandboxAlpha, setSandboxAlpha] = useState<number>(0.2);
  const [sandboxGamma, setSandboxGamma] = useState<number>(0.95);
  const [sandboxNextMaxQ, setSandboxNextMaxQ] = useState<number>(40);
  const [sandboxNextSampledQ, setSandboxNextSampledQ] = useState<number>(-25);

  const qLearningTarget = sandboxReward + sandboxGamma * sandboxNextMaxQ;
  const qLearningUpdated =
    sandboxQsa + sandboxAlpha * (qLearningTarget - sandboxQsa);

  const sarsaTarget = sandboxReward + sandboxGamma * sandboxNextSampledQ;
  const sarsaUpdated = sandboxQsa + sandboxAlpha * (sarsaTarget - sandboxQsa);

  // Guided Challenge verification checks
  const step1Done = env.id === 'hazardous_grid';
  const step2Done =
    step1Done &&
    history.length >= 30 &&
    latestEvalSummary.successRate >= 80 &&
    latestEvalSummary.avgHazardHits === 0;
  const step3Done =
    step1Done &&
    comparisonResult !== null &&
    comparisonResult.mode === 'baseline';

  const technicalLessons = [
    {
      title: '1. What Reinforcement Learning Is',
      subtitle: 'Sequential Decision-Making Through Trial and Error',
      body: `Reinforcement Learning (RL) is a computational paradigm in which an autonomous agent learns how to act in an environment by interacting with it and observing scalar reward signals. Unlike supervised learning—where a model is given ground-truth labels for every input—an RL agent must discover which sequences of actions maximize cumulative long-term return.`,
      formula: 'G_t = R_{t+1} + γ R_{t+2} + γ^2 R_{t+3} + ... = Σ_{k=0}^∞ γ^k R_{t+k+1}',
      takeaway:
        'An RL agent does not start with a map of the world. It constructs a value function purely from experienced transitions (s, a, r, s\').',
    },
    {
      title: '2. State, Action, Reward, and Transition',
      subtitle: 'The Markov Decision Process (MDP) Tuple (S, A, P, R, γ)',
      body: `Every step in the simulator follows the formal MDP loop:
• State (s ∈ S): The agent's current grid coordinate (row, col).
• Action (a ∈ A): One of the four cardinal movements {UP, RIGHT, DOWN, LEFT}.
• Transition (s' ~ P(·|s,a)): The resulting coordinate after applying grid physics (walls block movement; teleporters warp to paired portals).
• Reward (r = R(s,a,s')): The immediate numerical feedback (e.g., -1 per step, -35 for hazards, +100 for reaching the Goal).`,
      formula: 's_t ──(action a_t)──► Environment ──► (reward r_{t+1}, next state s_{t+1})',
      takeaway:
        'The Markov property means the next state and reward depend only on the current state s and action a, not on the earlier history.',
    },
    {
      title: '3. How a Grid-World Environment Works',
      subtitle: 'Spatial Topology, Obstacles, Hazards, and Terminal States',
      body: `A discrete grid world makes value propagation visible to the naked eye:
• Obstacles (#) are impassable walls. Attempting to move into a wall keeps the agent in state s and incurs the obstacle collision penalty.
• Hazards (!) are traversable danger cells. The agent can step through them, but incurs a steep negative reward.
• Bonus Tiles (+) offer an optional intermediate reward once per episode.
• The Goal (G) is an absorbing terminal state: reaching it ends the episode and sets future bootstrap value to zero.`,
      formula: 'V*(s_terminal) = 0   (No future rewards exist after episode termination)',
      takeaway:
        'Always verify whether a state is terminal before bootstrapping—bootstrapping from nonexistent future steps after the goal introduces mathematical bias.',
    },
    {
      title: '4. Q-Learning vs. SARSA (Off-Policy vs. On-Policy)',
      subtitle: 'Optimistic Max Backups vs. Realistic Behavior Backups',
      body: `Both Q-Learning and SARSA estimate state-action values Q(s,a), but their Temporal-Difference (TD) targets differ fundamentally:
• Q-Learning (Off-Policy) updates Q(s,a) using max_{a'} Q(s',a')—the best possible future action—even if the agent actually chooses a random exploratory action next.
• SARSA (On-Policy) updates Q(s,a) using Q(s',a') where a' is the action actually selected by the active ε-greedy policy in state s'.`,
      formula:
        'Q-Learning: r + γ max_{a\'} Q(s\',a\')   |   SARSA: r + γ Q(s\', a\'_selected)',
      takeaway:
        'On the Hazardous Grid preset, Q-Learning learns the risky shortest path right beside the hazard cliff, whereas SARSA accounts for ε-exploration slips and learns a safer upper detour.',
    },
    {
      title: '5. Exploration vs. Exploitation (ε-Greedy Policy)',
      subtitle: 'Balancing Curiosity with Current Knowledge',
      body: `If an agent always exploits its current highest Q-value from episode 1, it may lock onto a long, suboptimal path and never discover a shorter route or bonus tile. Conversely, if it always explores randomly, it never capitalizes on what it has learned.
The ε-greedy rule chooses a uniform random action with probability ε and the greedy action argmax_a Q(s,a) (with uniform random tie-breaking) with probability 1 - ε.`,
      formula: 'ε_{k+1} = max(ε_min, ε_k × ε_decay)',
      takeaway:
        'Decaying ε gradually allows broad state-space discovery early in training and low-variance policy refinement later.',
    },
    {
      title: '6. Learning Rate (α) and Discount Factor (γ)',
      subtitle: 'Step-Size Stability and Temporal Horizon',
      body: `• Learning Rate (α ∈ [0.01, 1.0]): Controls how strongly a new TD error overwrites the existing Q-value. In deterministic grid worlds, moderate-to-high α (0.2–0.5) learns quickly; in noisy settings, smaller α prevents oscillation.
• Discount Factor (γ ∈ [0.0, 0.99]): Controls how far into the future rewards propagate. When γ = 0, the agent is completely myopic (only cares about immediate step reward). On the 9×9 Long-Horizon preset, a high γ (≥ 0.95) is essential so the +100 goal reward propagates 16+ steps back to the start.`,
      formula: 'Effective Horizon ≈ 1 / (1 - γ)   (e.g., γ = 0.95 ⇒ ~20 steps)',
      takeaway:
        'If an agent wanders aimlessly near the start of a large grid, check whether γ is too small for the goal reward to reach early states.',
    },
    {
      title: '7. Reward Shaping',
      subtitle: 'Designing Incentives Without Unintended Loopholes',
      body: `Changing reward magnitudes alters the optimal policy π*:
• Increasing the per-step cost (e.g., from -0.5 to -4) makes the agent impatient, willing to cut across a -18 hazard if it saves 6 steps.
• Making hazard penalties severe (-85) forces wide detours.
• Collectible bonuses (+35) must be consumable at most once per episode; otherwise an agent will oscillate back and forth on a bonus tile forever to farm infinite reward instead of finishing the task!`,
      formula: 'R_total = R_goal + N_steps × R_step + N_hazards × R_hazard + N_bonuses × R_bonus',
      takeaway:
        'Use the Reward Configuration Studio in the Environment tab to switch between Fastest Route, Safest Route, and Reward Collection presets.',
    },
    {
      title: '8. Reading the Q-Table',
      subtitle: 'How Values Propagate Backward from the Goal',
      body: `At initialization, every state has Q(s,a) = 0.00.
During the first episode that stumbles into the Goal (G), only the state immediately adjacent to G receives a positive Q-update. On the next successful episode, the state two steps away backs up that positive value, and so on—like a wave moving backward from the goal to the start.`,
      formula: 'Unvisited states have Q(s,a) = 0.00 across all actions (no learned preference).',
      takeaway:
        'Open the Policy & Q-Table Explorer tab and switch between "4-Action Q Split" and "Visit Heatmap" to watch values propagate backward from G.',
    },
    {
      title: '9. Interpreting Learning Curves',
      subtitle: 'Distinguishing Stabilization from True Convergence',
      body: `Episode return curves naturally fluctuate while ε > 0 because random exploratory moves occasionally step into walls or hazards.
• Use the Moving-Average curve (W = 15 or 25) to see the underlying trend.
• Inspect the Checkpoint Greedy Evaluation curve (ε = 0) to measure how well the learned policy performs when exploration noise is turned off.`,
      formula: 'Apparent Plateau ≠ Global Optimal Policy (if exploration starved early)',
      takeaway:
        'Never claim global convergence solely because a curve flattens—if ε decayed too fast, the agent may simply have stabilized on a suboptimal route.',
    },
    {
      title: '10. Why Learned Policies Differ from the Goal-Based Baseline',
      subtitle: 'Model-Free Trial-and-Error vs. Explicit Graph Search',
      body: `The Hand-Designed Goal-Based Agent is an explicit planning baseline (using BFS or cost-aware A*). It inspects the entire grid array and transition rules upfront, computing a route in 0 training episodes without a Q-table.
In contrast, Q-Learning and SARSA are model-free: they start blind, must physically experience transitions to learn, and may retain slight detours if certain grid corners were rarely visited—or, in SARSA's case, intentionally avoid paths adjacent to hazards due to exploration risk.`,
      formula: 'Planner: Known Model (S,A,P,R) ⇒ Search   |   RL: Unknown Model ⇒ Sample Experience',
      takeaway:
        'Run the Algorithm Comparison Lab in Baseline mode to compare RL sample complexity against explicit planning.',
    },
  ];

  const beginnerCopy = [
    {
      title: 'What is reinforcement learning?',
      subtitle: 'Learning by trying actions and seeing what happens',
      body: 'An agent learns by moving around the grid. Good outcomes earn rewards; unhelpful moves may cost points. Over many tries, it learns which choices tend to lead to better results.',
      example: 'Like learning a maze by trying paths: remember the turns that helped you reach the exit and avoid the ones that led to trouble.',
      formula: 'Try a move → get a reward → learn from the result',
      takeaway: 'The agent is not given the answer. It builds useful knowledge from experience.',
      question: 'What does the agent use to learn?',
      answers: ['Experience and rewards', 'A prewritten route for every maze', 'The color of each grid cell'],
      correctAnswer: 0,
      explanation: 'It learns from the actions it takes and the rewards or penalties it receives.',
    },
    {
      title: 'State, action, and reward',
      subtitle: 'The basic pieces of one move',
      body: 'A state is where the agent is now. An action is a move it can choose. The environment then moves the agent (or blocks it) and gives a reward.',
      example: 'If the agent is at (2, 3), “move right” is an action. The next state might be (2, 4), and stepping onto a bonus tile may add a reward.',
      formula: 'Current cell + chosen move → next cell + reward',
      takeaway: 'A learning step is one choice and its result.',
      question: 'Which one is an action?',
      answers: ['The agent is at (2, 3)', 'Move left', 'A +10 reward'],
      correctAnswer: 1,
      explanation: '“Move left” is a choice the agent can make, so it is an action.',
    },
    {
      title: 'Read the grid',
      subtitle: 'Walls, hazards, bonuses, and the goal',
      body: 'Each tile has a simple job. Walls block movement. Hazards can be entered but cost reward. Bonus tiles give a reward. Reaching the goal ends the episode.',
      example: 'A wall is like a closed door: trying to walk through it keeps you in place. A hazard is more like a puddle: you can cross it, but there is a cost.',
      formula: 'Wall = blocked · Hazard = penalty · Bonus = reward · Goal = finish',
      takeaway: 'The colors and symbols show what can happen when the agent enters a tile.',
      question: 'What happens when the agent reaches the goal?',
      answers: ['The episode ends', 'The agent keeps moving in that episode', 'The goal turns into a wall'],
      correctAnswer: 0,
      explanation: 'The goal is the finish for an episode. A new episode can then begin.',
    },
    {
      title: 'Q-Learning and SARSA',
      subtitle: 'Two ways to think about the next move',
      body: 'Both methods learn which moves are valuable. Q-Learning asks, “What is the best move I could make next?” SARSA asks, “What move will I actually make next, including exploration?”',
      example: 'Near a hazard, Q-Learning may value a short route based on its best next move. SARSA also considers that exploration could send it toward danger.',
      formula: 'Q-Learning: best next move · SARSA: next move actually chosen',
      takeaway: 'The methods differ in how they estimate what comes after the current move.',
      question: 'Which method uses the next action the agent actually selected?',
      answers: ['Q-Learning', 'SARSA', 'Neither method'],
      correctAnswer: 1,
      explanation: 'SARSA learns from the next action actually selected by its current policy.',
    },
    {
      title: 'Explore or use what you know?',
      subtitle: 'Curiosity and confidence',
      body: 'Exploring means trying a move to learn more. Exploiting means choosing the move that currently looks best. The exploration rate ε controls how often the agent tries a random action.',
      example: 'At ε = 1, the agent explores almost every move. At ε = 0, it follows its current best-known choices.',
      formula: 'High ε = more trying · Low ε = more using learned choices',
      takeaway: 'Exploration helps discover routes; exploitation uses what has already been learned.',
      question: 'What does a lower ε usually mean?',
      answers: ['More random moves', 'More choices based on current knowledge', 'The episode always ends sooner'],
      correctAnswer: 1,
      explanation: 'Lower ε reduces random exploration, so the agent more often uses its learned preferences.',
    },
    {
      title: 'Learning rate and future rewards',
      subtitle: 'How quickly values change and how far ahead to look',
      body: 'The learning rate α controls how strongly a new experience changes a value. The discount factor γ controls how much the agent cares about rewards that are farther away.',
      example: 'With a high α, new evidence changes estimates quickly. With a high γ, the agent can value a longer route that eventually reaches a rewarding goal.',
      formula: 'α = how much to update · γ = how much to value later rewards',
      takeaway: 'These settings affect learning behavior; they do not change the grid itself.',
      question: 'Which setting controls how much future rewards matter?',
      answers: ['Learning rate α', 'Discount factor γ', 'Grid width'],
      correctAnswer: 1,
      explanation: 'The discount factor γ controls how much future rewards count compared with immediate rewards.',
    },
    {
      title: 'Rewards shape the route',
      subtitle: 'What you reward changes what the agent prefers',
      body: 'The agent tries to earn more total reward. A large goal reward encourages reaching the goal; step costs encourage shorter paths; hazard penalties encourage safer paths.',
      example: 'If hazards have a severe penalty, a longer safe detour may be better than a short route through danger.',
      formula: 'Route value = goal reward + step costs + hazards + bonuses',
      takeaway: 'Reward settings are incentives—not a guarantee that every route will be safe or short.',
      question: 'What is a likely effect of a larger hazard penalty?',
      answers: ['The agent may prefer a safer detour', 'Hazards become walls automatically', 'The goal reward disappears'],
      correctAnswer: 0,
      explanation: 'A stronger penalty makes routes through hazards less attractive, so a safe detour may be preferred.',
    },
    {
      title: 'Read the Q-table',
      subtitle: 'A score for each move from each cell',
      body: 'The Q-table is the agent’s memory of how useful each action has been from each state. Higher values mean a move has worked out better in the agent’s past experience.',
      example: 'At one cell, the table might prefer RIGHT over UP because going right has more often led toward a good outcome.',
      formula: 'Q(state, action) = the agent’s learned estimate for that move',
      takeaway: 'Policy arrows are a visual summary of the best-valued moves in the table.',
      question: 'What does a higher Q-value generally represent?',
      answers: ['A move estimated to lead to a better outcome', 'The number of walls in the grid', 'The agent’s current exploration rate'],
      correctAnswer: 0,
      explanation: 'Q-values estimate how useful an action is expected to be from a state.',
    },
    {
      title: 'Understand the charts',
      subtitle: 'Look for a trend, not one lucky episode',
      body: 'Training results can jump around because the agent sometimes explores. A moving average smooths those ups and downs. Evaluation runs test the current policy without random exploration.',
      example: 'One high-reward episode may be luck. If the moving average rises too, performance may be improving more consistently.',
      formula: 'Training = learning with exploration · Evaluation = testing the current policy',
      takeaway: 'Use several episodes and evaluation results before deciding that a policy is reliable.',
      question: 'Why can training rewards fluctuate?',
      answers: ['The agent sometimes explores different moves', 'The chart changes the Q-table', 'The goal moves after every episode'],
      correctAnswer: 0,
      explanation: 'Exploration can lead to different routes, so individual training episodes may have different outcomes.',
    },
    {
      title: 'Learner or planner?',
      subtitle: 'Learning from experience versus searching a known map',
      body: 'Q-Learning and SARSA learn by trying actions and updating their memory. The goal-based planner uses the known grid and its rules to search for a route directly; it does not train a Q-table.',
      example: 'The planner can find a route immediately when it knows the map. A learner may need practice, but keeps the values it learned for later use.',
      formula: 'Learner: practice and remember · Planner: inspect the map and search',
      takeaway: 'They solve a similar task in different ways, so their paths and training needs can differ.',
      question: 'Does the goal-based planner learn a Q-table through training?',
      answers: ['Yes, just like Q-Learning', 'No, it searches the known environment', 'Only after 100 episodes'],
      correctAnswer: 1,
      explanation: 'The planner computes a route from the environment; it does not learn Q-values through episodes.',
    },
  ];
  const lessons = technicalLessons.map((lesson, index) => ({
    ...lesson,
    ...beginnerCopy[index],
  }));
  const lesson = lessons[activeLesson];
  const answeredCorrectly = selectedAnswer === lesson.correctAnswer;

  const changeLesson = (index: number) => {
    setActiveLesson(index);
    setSelectedAnswer(null);
    setAnswerSubmitted(false);
  };

  const submitAnswer = () => {
    if (selectedAnswer === null) return;
    setAnswerSubmitted(true);
    if (answeredCorrectly) {
      setCompletedLessons((previous) => new Set(previous).add(activeLesson));
    }
  };

  return (
    <div className="space-y-6">
      {/* Guided Interactive Challenge Card */}
      <div className="bg-gradient-to-r from-emerald-50/90 via-teal-50/70 to-sky-50/80 rounded-xl border border-emerald-200 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold uppercase tracking-wider">
              <Award className="w-3.5 h-3.5" />
              Interactive Guided Lab Challenge
            </div>
            <h2 className="text-base font-bold text-slate-900">
              Challenge: Master the Hazardous Grid & Compare with the Goal-Based Planner
            </h2>
            <p className="text-xs text-slate-600">
              Complete all three live experimental milestones below. The studio automatically verifies your progress from the active simulation state.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onLaunchGuidedChallenge}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-sm inline-flex items-center gap-1.5 transition"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              1-Click Load Challenge Preset
            </button>
            <button
              onClick={() => onNavigateTab('comparison')}
              className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
            >
              Open Comparison Lab
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <div
            className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
              step1Done
                ? 'bg-white border-emerald-400 text-emerald-950'
                : 'bg-white/70 border-slate-200 text-slate-600'
            }`}
          >
            {step1Done ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <Circle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-bold">Step 1: Load Hazardous Grid</div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Select the 6×8 <em>Hazardous Grid</em> preset (currently: <strong>{env.name}</strong>).
              </p>
            </div>
          </div>

          <div
            className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
              step2Done
                ? 'bg-white border-emerald-400 text-emerald-950'
                : 'bg-white/70 border-slate-200 text-slate-600'
            }`}
          >
            {step2Done ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <Circle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-bold">
                Step 2: Train Hazard-Free Greedy Policy
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Train ≥30 episodes and reach ≥80% greedy eval success with 0 eval hazard hits (current: {history.length} ep, {latestEvalSummary.successRate}% success).
              </p>
            </div>
          </div>

          <div
            className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
              step3Done
                ? 'bg-white border-emerald-400 text-emerald-950'
                : 'bg-white/70 border-slate-200 text-slate-600'
            }`}
          >
            {step3Done ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <Circle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-bold">
                Step 3: Benchmark Against Goal Planner
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Run a 3-Agent Baseline Benchmark in the Algorithm Comparison Lab.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Short lessons, knowledge checks, and a live algorithm sandbox */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 px-2 pb-2">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Learning path
            </div>
            <span className="text-[11px] font-medium text-slate-500">
              {completedLessons.size} / {lessons.length} complete
            </span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-slate-100 mb-3"
            role="progressbar"
            aria-label="Learning path progress"
            aria-valuemin={0}
            aria-valuemax={lessons.length}
            aria-valuenow={completedLessons.size}
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${(completedLessons.size / lessons.length) * 100}%` }}
            />
          </div>
          <nav aria-label="Learning lessons" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5">
          {lessons.map((item, idx) => (
            <button
              key={idx}
              onClick={() => changeLesson(idx)}
              aria-current={activeLesson === idx ? 'step' : undefined}
              className={`w-full min-w-0 text-left px-3 py-2.5 rounded-lg text-xs transition flex items-center gap-2 ${
                activeLesson === idx
                  ? 'bg-emerald-50 text-emerald-900 font-semibold border border-emerald-200'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="inline-flex w-5 h-5 shrink-0 items-center justify-center rounded-full bg-white border border-slate-200 text-[10px] font-mono">
                {completedLessons.has(idx) ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  idx + 1
                )}
              </span>
              <span className="min-w-0 break-words leading-tight">{item.title}</span>
            </button>
          ))}
          </nav>
        </div>

        <div className="lg:col-span-8 space-y-6">
          {/* Active Lesson Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">
                  Lesson {activeLesson + 1} of {lessons.length} · {lesson.subtitle}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-1 flex items-start gap-2">
                  <BookOpen className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{lesson.title}</span>
                </h3>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  disabled={activeLesson === 0}
                  onClick={() => changeLesson(Math.max(0, activeLesson - 1))}
                  className="px-2.5 py-1.5 rounded border border-slate-200 text-xs disabled:opacity-40 hover:bg-slate-50"
                >
                  Prev
                </button>
                <button
                  disabled={activeLesson === lessons.length - 1}
                  onClick={() => changeLesson(Math.min(lessons.length - 1, activeLesson + 1))}
                  className="px-2.5 py-1.5 rounded border border-slate-200 text-xs disabled:opacity-40 hover:bg-slate-50"
                >
                  Next
                </button>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                In simple terms
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{lesson.body}</p>
            </div>

            <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-sky-800 mb-1">
                Grid-world example
              </div>
              <p className="text-sm text-sky-950 leading-relaxed">{lesson.example}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 text-emerald-300 font-mono text-xs leading-relaxed overflow-x-auto">
              {lesson.formula}
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-sm text-emerald-950 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>Remember:</strong> {lesson.takeaway}
              </div>
            </div>

            <section className="rounded-xl border border-slate-200 p-4 space-y-3" aria-labelledby="lesson-question">
              <div className="flex items-start gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <h4 id="lesson-question" className="text-sm font-bold text-slate-900">
                  Quick check: {lesson.question}
                </h4>
              </div>
              <div className="grid gap-2">
                {lesson.answers.map((answer, index) => {
                  const isSelected = selectedAnswer === index;
                  const isCorrectAnswer = index === lesson.correctAnswer;
                  const answerStyle =
                    answerSubmitted && isCorrectAnswer
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-950'
                      : answerSubmitted && isSelected
                      ? 'border-rose-300 bg-rose-50 text-rose-900'
                      : isSelected
                      ? 'border-emerald-400 bg-emerald-50/60 text-emerald-950'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700';
                  return (
                    <button
                      key={answer}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => {
                        setSelectedAnswer(index);
                        setAnswerSubmitted(false);
                      }}
                      className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition ${answerStyle}`}
                    >
                      <span className="mr-2 font-mono text-xs text-slate-400">
                        {String.fromCharCode(65 + index)}.
                      </span>
                      {answer}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={submitAnswer}
                  disabled={selectedAnswer === null}
                  className="px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Check answer
                </button>
                {answerSubmitted && (
                  <p
                    role="status"
                    className={`text-xs font-medium ${
                      answeredCorrectly ? 'text-emerald-800' : 'text-rose-800'
                    }`}
                  >
                    {answeredCorrectly ? 'Correct! ' : 'Not quite. '}
                    {lesson.explanation}
                  </p>
                )}
                {completedLessons.has(activeLesson) && !answerSubmitted && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" />
                    Lesson complete
                  </span>
                )}
              </div>
            </section>
          </div>

          {/* Interactive Bellman Backup Sandbox Calculator */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-teal-600" />
                Try it: how one experience changes Q-values
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Change the numbers and compare how Q-Learning and SARSA learn from the same move. This practice sandbox does not change your saved agent.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <label className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block text-[11px]">Current Q(s, a)</span>
                <input
                  type="number"
                  value={sandboxQsa}
                  onChange={(e) => setSandboxQsa(Number(e.target.value))}
                  className="w-full mt-1 px-2 py-1 rounded border border-slate-300 bg-white font-mono"
                />
              </label>
              <label className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block text-[11px]">Immediate Reward r</span>
                <input
                  type="number"
                  value={sandboxReward}
                  onChange={(e) => setSandboxReward(Number(e.target.value))}
                  className="w-full mt-1 px-2 py-1 rounded border border-slate-300 bg-white font-mono"
                />
              </label>
              <label className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block text-[11px]">Learning Rate α</span>
                <input
                  type="number"
                  step={0.05}
                  min={0.01}
                  max={1}
                  value={sandboxAlpha}
                  onChange={(e) => setSandboxAlpha(Number(e.target.value))}
                  className="w-full mt-1 px-2 py-1 rounded border border-slate-300 bg-white font-mono"
                />
              </label>
              <label className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block text-[11px]">Discount Factor γ</span>
                <input
                  type="number"
                  step={0.05}
                  min={0}
                  max={0.99}
                  value={sandboxGamma}
                  onChange={(e) => setSandboxGamma(Number(e.target.value))}
                  className="w-full mt-1 px-2 py-1 rounded border border-slate-300 bg-white font-mono"
                />
              </label>
              <label className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200">
                <span className="text-emerald-800 font-medium block text-[11px]">
                  Best Next max Q(s&apos;, a&apos;)
                </span>
                <input
                  type="number"
                  value={sandboxNextMaxQ}
                  onChange={(e) => setSandboxNextMaxQ(Number(e.target.value))}
                  className="w-full mt-1 px-2 py-1 rounded border border-emerald-300 bg-white font-mono"
                />
              </label>
              <label className="p-2.5 rounded-lg bg-teal-50/60 border border-teal-200">
                <span className="text-teal-800 font-medium block text-[11px]">
                  Sampled Exploratory Q(s&apos;, a&apos;)
                </span>
                <input
                  type="number"
                  value={sandboxNextSampledQ}
                  onChange={(e) => setSandboxNextSampledQ(Number(e.target.value))}
                  className="w-full mt-1 px-2 py-1 rounded border border-teal-300 bg-white font-mono"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-1">
                <div className="text-xs font-bold text-emerald-900 flex items-center justify-between">
                  <span>Off-Policy Q-Learning Update</span>
                  <span className="font-mono text-sm">
                    {qLearningUpdated.toFixed(2)}
                  </span>
                </div>
                <p className="text-[11px] font-mono text-emerald-800">
                  Target = {sandboxReward} + {sandboxGamma} × ({sandboxNextMaxQ}) ={' '}
                  {qLearningTarget.toFixed(2)}
                </p>
                <p className="text-[11px] text-slate-600">
                  Uses the optimistic maximum next action ({sandboxNextMaxQ}), increasing Q(s,a) from {sandboxQsa} to <strong>{qLearningUpdated.toFixed(2)}</strong>.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-teal-50/60 border border-teal-200 space-y-1">
                <div className="text-xs font-bold text-teal-900 flex items-center justify-between">
                  <span>On-Policy SARSA Update</span>
                  <span className="font-mono text-sm">
                    {sarsaUpdated.toFixed(2)}
                  </span>
                </div>
                <p className="text-[11px] font-mono text-teal-800">
                  Target = {sandboxReward} + {sandboxGamma} × ({sandboxNextSampledQ}) ={' '}
                  {sarsaTarget.toFixed(2)}
                </p>
                <p className="text-[11px] text-slate-600">
                  Uses the actually selected exploratory action ({sandboxNextSampledQ}), pulling Q(s,a) from {sandboxQsa} to <strong>{sarsaUpdated.toFixed(2)}</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
