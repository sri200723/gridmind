import {
  AgentBrainState,
  AlgorithmType,
  BrainCheckpoint,
  EnvironmentConfig,
  SavedExperiment,
} from '../types/rl';

const DATABASE_NAME = 'rl-grid-world-studio-memory';
const DATABASE_VERSION = 1;
const BRAIN_STORE = 'brains';
const ENVIRONMENT_STORE = 'environments';
const CHECKPOINT_STORE = 'checkpoints';
const EXPERIMENT_STORE = 'experiments';
const ARCHIVE_STORE = 'brainArchives';

export const BRAIN_SCHEMA_VERSION = 1;

export interface BrainImportBundle {
  schemaVersion: 1;
  brain: AgentBrainState;
  environment: EnvironmentConfig;
  checkpoint?: BrainCheckpoint;
}

export interface StorageDiagnostics {
  available: boolean;
  message: string;
}

function getIndexedDb(): IDBFactory | null {
  return typeof indexedDB === 'undefined' ? null : indexedDB;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

async function openDatabase(): Promise<IDBDatabase> {
  const factory = getIndexedDb();
  if (!factory) throw new Error('IndexedDB is unavailable in this browser context');

  const request = factory.open(DATABASE_NAME, DATABASE_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(BRAIN_STORE)) {
      database.createObjectStore(BRAIN_STORE, { keyPath: 'agentId' });
    }
    if (!database.objectStoreNames.contains(ENVIRONMENT_STORE)) {
      database.createObjectStore(ENVIRONMENT_STORE, { keyPath: 'id' });
    }
    if (!database.objectStoreNames.contains(CHECKPOINT_STORE)) {
      const store = database.createObjectStore(CHECKPOINT_STORE, { keyPath: 'id' });
      store.createIndex('agentId', 'agentId', { unique: false });
    }
    if (!database.objectStoreNames.contains(EXPERIMENT_STORE)) {
      database.createObjectStore(EXPERIMENT_STORE, { keyPath: 'id' });
    }
    if (!database.objectStoreNames.contains(ARCHIVE_STORE)) {
      const store = database.createObjectStore(ARCHIVE_STORE, { keyPath: 'id' });
      store.createIndex('agentId', 'agentId', { unique: false });
    }
  };
  return requestToPromise(request);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function environmentFingerprint(environment: EnvironmentConfig): string {
  const canonical = JSON.stringify({
    id: environment.id,
    rows: environment.rows,
    cols: environment.cols,
    grid: environment.grid,
    startPos: environment.startPos,
    goalPos: environment.goalPos,
  });
  let hash = 2166136261;
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function getStorageDiagnostics(): StorageDiagnostics {
  return getIndexedDb()
    ? { available: true, message: 'IndexedDB is available on this device.' }
    : { available: false, message: 'IndexedDB is unavailable; memory cannot be persisted here.' };
}

export async function saveAgentBrain(agentId: AlgorithmType, brainState: AgentBrainState): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(BRAIN_STORE, 'readwrite');
    transaction.objectStore(BRAIN_STORE).put({ ...clone(brainState), agentId });
    await transactionToPromise(transaction);
  } finally {
    database.close();
  }
}

export async function archiveAgentBrain(brainState: AgentBrainState): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(ARCHIVE_STORE, 'readwrite');
    transaction.objectStore(ARCHIVE_STORE).put({
      id: `${brainState.agentId}-${brainState.environmentFingerprint}-${brainState.updatedAt}`,
      ...clone(brainState),
    });
    await transactionToPromise(transaction);
  } finally {
    database.close();
  }
}

export async function loadAgentBrain(agentId: AlgorithmType): Promise<AgentBrainState | null> {
  const database = await openDatabase();
  try {
    const result = await requestToPromise(
      database.transaction(BRAIN_STORE, 'readonly').objectStore(BRAIN_STORE).get(agentId)
    );
    return result ? clone(result as AgentBrainState) : null;
  } finally {
    database.close();
  }
}

export async function saveEnvironment(environment: EnvironmentConfig): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(ENVIRONMENT_STORE, 'readwrite');
    transaction.objectStore(ENVIRONMENT_STORE).put(clone(environment));
    await transactionToPromise(transaction);
  } finally {
    database.close();
  }
}

export async function loadEnvironment(environmentId: string): Promise<EnvironmentConfig | null> {
  const database = await openDatabase();
  try {
    const result = await requestToPromise(
      database.transaction(ENVIRONMENT_STORE, 'readonly').objectStore(ENVIRONMENT_STORE).get(environmentId)
    );
    return result ? clone(result as EnvironmentConfig) : null;
  } finally {
    database.close();
  }
}

export async function saveTrainingCheckpoint(checkpoint: BrainCheckpoint): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(CHECKPOINT_STORE, 'readwrite');
    transaction.objectStore(CHECKPOINT_STORE).put(clone(checkpoint));
    await transactionToPromise(transaction);
  } finally {
    database.close();
  }
}

export async function saveBrainImportBundle(bundle: BrainImportBundle): Promise<void> {
  const database = await openDatabase();
  const stores = bundle.checkpoint
    ? [ENVIRONMENT_STORE, BRAIN_STORE, CHECKPOINT_STORE]
    : [ENVIRONMENT_STORE, BRAIN_STORE];
  try {
    const transaction = database.transaction(stores, 'readwrite');
    transaction.objectStore(ENVIRONMENT_STORE).put(clone(bundle.environment));
    transaction.objectStore(BRAIN_STORE).put({
      ...clone(bundle.brain),
      agentId: bundle.brain.agentId,
    });
    if (bundle.checkpoint) {
      transaction.objectStore(CHECKPOINT_STORE).put(clone(bundle.checkpoint));
    }
    await transactionToPromise(transaction);
  } finally {
    database.close();
  }
}

export async function loadTrainingCheckpoint(
  agentId: AlgorithmType,
  environmentFingerprint?: string,
  maxCompletedEpisodes?: number
): Promise<BrainCheckpoint | null> {
  const database = await openDatabase();
  try {
    const store = database.transaction(CHECKPOINT_STORE, 'readonly').objectStore(CHECKPOINT_STORE);
    const request = store.index('agentId').getAll();
    const rows = await requestToPromise(request) as BrainCheckpoint[];
    const matching = rows.filter(
      (row) =>
        row.agentId === agentId &&
        (environmentFingerprint === undefined ||
          row.environmentFingerprint === environmentFingerprint) &&
        (maxCompletedEpisodes === undefined ||
          row.completedEpisodes <= maxCompletedEpisodes) &&
        Array.isArray(row.history) &&
        row.history.every(
          (record) =>
            record.algorithm === agentId &&
            record.episode <= row.completedEpisodes
        ) &&
        Array.isArray(row.evaluations) &&
        row.evaluations.every(
          (evaluation) => evaluation.episode <= row.completedEpisodes
        )
    );
    matching.sort((a, b) => b.completedEpisodes - a.completedEpisodes);
    return matching[0] ? clone(matching[0]) : null;
  } finally {
    database.close();
  }
}

export async function saveExperiment(experiment: SavedExperiment): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(EXPERIMENT_STORE, 'readwrite');
    transaction.objectStore(EXPERIMENT_STORE).put(clone(experiment));
    await transactionToPromise(transaction);
  } finally {
    database.close();
  }
}

export async function deleteExperiment(experimentId: string): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(EXPERIMENT_STORE, 'readwrite');
    transaction.objectStore(EXPERIMENT_STORE).delete(experimentId);
    await transactionToPromise(transaction);
  } finally {
    database.close();
  }
}

export async function loadExperiments(): Promise<SavedExperiment[]> {
  const database = await openDatabase();
  try {
    const result = await requestToPromise(
      database.transaction(EXPERIMENT_STORE, 'readonly').objectStore(EXPERIMENT_STORE).getAll()
    );
    return clone(result as SavedExperiment[]);
  } finally {
    database.close();
  }
}

export function exportBrain(bundle: BrainImportBundle): string {
  return JSON.stringify(bundle, null, 2);
}

function isAlgorithm(value: unknown): value is AlgorithmType {
  return value === 'q_learning' || value === 'sarsa' || value === 'goal_based';
}

export function validateBrainImport(value: unknown): value is BrainImportBundle {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<BrainImportBundle>;
  if (candidate.schemaVersion !== BRAIN_SCHEMA_VERSION) return false;
  if (!candidate.brain || !candidate.environment || !isAlgorithm(candidate.brain.agentId)) return false;
  if (candidate.brain.algorithm !== candidate.brain.agentId) return false;
  if (candidate.brain.environmentFingerprint !== environmentFingerprint(candidate.environment)) return false;
  if (candidate.brain.qTable !== null && typeof candidate.brain.qTable !== 'object') return false;
  return true;
}

export async function importBrain(file: File): Promise<BrainImportBundle> {
  const parsed: unknown = JSON.parse(await file.text());
  if (!validateBrainImport(parsed)) {
    throw new Error('Invalid or incompatible brain export.');
  }
  return clone(parsed);
}
