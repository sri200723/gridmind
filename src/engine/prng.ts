/**
 * Deterministic Seeded Pseudo-Random Number Generator (Mulberry32)
 * Ensures 100% reproducible RL training & evaluation runs for a given integer seed.
 */
export class SeededRNG {
  private state: number;

  constructor(seed: number = 42) {
    this.state = (seed >>> 0) || 1;
  }

  /** Returns a float in [0, 1) */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns an integer in [0, maxExclusive) */
  nextInt(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }

  /** Picks a random element uniformly from a non-empty array */
  choice<T>(items: readonly T[]): T {
    return items[this.nextInt(items.length)];
  }
}
