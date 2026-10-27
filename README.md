# RL Grid World Studio — Autonomous Agent Intelligence Lab

An interactive educational web laboratory for training, visualizing, and benchmarking **Reinforcement Learning (RL)** agents (**Off-Policy Q-Learning** and **On-Policy SARSA**) against a hand-designed **Goal-Based Agent (BFS / Cost-Aware A\* Planner)** in customizable grid-world environments.

---

## 1. Core Learning Objectives & Capabilities

- **Mathematical RL Implementations**:
  - **Off-Policy Q-Learning**:
    $$Q(s,a) \leftarrow Q(s,a) + \alpha \left[ r + \gamma \max_{a'} Q(s',a') - Q(s,a) \right]$$
  - **On-Policy SARSA**:
    $$Q(s,a) \leftarrow Q(s,a) + \alpha \left[ r + \gamma Q(s',a') - Q(s,a) \right]$$
  - **Terminal State Invariant**: Transitions into the terminal Goal state ($G$) set the future bootstrap value strictly to $0$ ($\text{target} = r$).
  - **$\varepsilon$-Greedy Exploration with Seeded Tie-Breaking**: Uses a deterministic Mulberry32 PRNG for reproducible exploration and uniform random tie-breaking among equally valued greedy actions.
- **Hand-Designed Goal-Based Planner Baseline (Non-RL)**:
  - Computes explicit routes using **Unweighted BFS** or **Cost-Aware A\*** graph search.
  - Dynamically recalculates whenever obstacles, hazards, or reward weights change, without training or updating a Q-table.
- **Interactive Grid-World & Reward Studio**:
  - 5 curated benchmark presets (*Simple Navigation*, *Maze Challenge*, *Hazardous Grid*, *Long-Horizon Navigation*, and *Teleporter & Reward Lab*).
  - Custom tile painting (Start, Goal, Obstacles, Hazards, Collectible Bonuses, Paired Teleporters) and grid resizing ($4\times 4$ to $12\times 12$).
  - 4 reward shaping presets (*Balanced Navigation*, *Fastest Route*, *Safest Route*, *Reward Collection*).
- **7 Data-Driven Live Analytical Charts**:
  - Raw & Moving-Average Episode Return, Rolling Success Rate, Episode Steps, $\varepsilon$ Decay Schedule, Training Throughput, and Periodic Greedy Evaluation Checkpoints ($\varepsilon = 0$), paired with an automated curve diagnostic panel.
- **Controlled & Baseline Algorithm Comparison Lab**:
  - Head-to-head single-seed and multi-seed experiments comparing Q-Learning, SARSA, and the Goal-Based Planner.
- **Automated Verification Suite**:
  - 10 built-in mathematical unit tests verifying Bellman backups, terminal states, $\varepsilon$-greedy distributions, obstacle collisions, planner validity, evaluation immutability, and CSV/JSON export fidelity.

---

## 2. Technical Architecture

```text
rl-grid-world-studio/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── README.md
└── src/
    ├── main.tsx                        # Application entry point
    ├── App.tsx                         # Studio shell, navigation & live simulation state
    ├── types/
    │   └── rl.ts                       # TypeScript interfaces for states, actions, rewards & metrics
    ├── engine/
    │   ├── prng.ts                     # Deterministic Mulberry32 seeded PRNG
    │   ├── environment.ts              # Grid-world transitions, presets & BFS validator
    │   ├── agents.ts                   # Q-Learning, SARSA & BFS/A* Goal-Based Planner
    │   ├── training.ts                 # Incremental step/episode training & pure greedy evaluation
    │   ├── analytics.ts                # Moving averages & empirical curve interpretation
    │   └── experiments.ts              # LocalStorage persistence & CSV/JSON exporters
    ├── tests/
    │   └── rl.test.ts                  # 10 automated mathematical verification unit tests
    └── components/
        ├── GridCanvas.tsx              # Interactive grid renderer with policy arrows & Q-splits
        ├── EnvironmentStudioView.tsx   # Topology editor & Reward Configuration Studio
        ├── PolicyQTableView.tsx        # State inspector & searchable State-Action Q-Table
        ├── AnalyticsView.tsx           # 7 live Recharts telemetry charts
        ├── ComparisonLabView.tsx       # Controlled & Baseline comparison workspace
        ├── ExperimentsAndTestsView.tsx # Experiment manager, CSV/JSON export & test runner
        └── LearningGuideView.tsx       # 10-module interactive tutorial & Guided Challenge
```

---

## 3. Formal Transition & Reward Rules

1. **Action Space**: $A = \{\text{UP}, \text{RIGHT}, \text{DOWN}, \text{LEFT}\}$.
2. **Obstacle & Boundary Collisions**: Attempting to move into an obstacle (`#`) or outside the grid boundary is blocked—the agent remains at its current coordinate $s' = s$ and receives `obstaclePenalty` (default `-5`).
3. **Hazard Tiles (`!`)**: Traversable danger cells that apply `hazardPenalty + stepCost` (default `-35 + (-1) = -36`).
4. **Collectible Bonus Tiles (`+`)**: Award `rewardTileValue + stepCost` at most once per tile per episode so agents cannot loop infinitely on bonus cells.
5. **Teleporters (`T`)**: Stepping onto a portal transports the agent to the paired portal coordinate on the same step.
6. **Terminal Goal (`G`)**: Awards `goalReward + stepCost` (default `+100 + (-1) = +99`) and terminates the episode (`done = true`).

---

## 4. Setup & Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Launch the interactive Vite development server
npm run dev

# 3. Build for production
npm run build
```

## 5. Deploying to Vercel

This is a static Vite application. The included `vercel.json` configures Vercel
to build the project and publish the generated `dist/` directory, with a
fallback for client-side routes.

### Deploy from GitHub

1. Push this project to a GitHub repository.
2. In Vercel, choose **Add New → Project** and import that repository.
3. Keep the detected Vite settings: build command `npm run build` and output
   directory `dist`.
4. Deploy. Vercel will build and publish the app, and subsequent pushes to the
   selected branch will trigger new deployments.

### Deploy from the command line

Install and authenticate with the Vercel CLI, then run these commands from the
project directory:

```bash
npx vercel
npx vercel --prod
```

The app's agent memories use browser IndexedDB. They remain in that browser's
site storage and are not synchronized between devices; users should export
their brains if they need a backup or transfer.
