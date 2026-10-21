import type { SimulationFrame, SimulationMetricsResponse, SimulationRun } from '../../types';
import type { SiteProject } from '../types';

export interface SourceText {
  name: string;
  text: string;
}
export interface SiteSources {
  inp: SourceText;
  geojson?: SourceText;
  asc?: SourceText;
}
export type StoredProject = SiteProject & { sources: SiteSources };
/** Street-water depth grids kept with a run: `times.length` grids of `cells` float32 values, back to back. */
export interface DepthGrids {
  times: number[];
  cells: number;
  data: ArrayBuffer;
}
/** A run record only (small): listings and pruning read these. */
export interface StoredRun {
  run: SimulationRun & { created_at: string };
  projectId: string;
}
/** A succeeded run's results (large), stored separately under the run id. */
export interface RunResults {
  frames: SimulationFrame[];
  metrics: SimulationMetricsResponse;
  depth: DepthGrids;
}
export type RecordStore = 'inspections' | 'proposals';
export type StoredRecord = { id: string } & Record<string, unknown>;

export interface SiteStore {
  putProject(p: StoredProject): Promise<void>;
  getProject(id: string): Promise<StoredProject | undefined>;
  listProjects(): Promise<StoredProject[]>;
  putRun(r: StoredRun): Promise<void>;
  getRun(id: string): Promise<StoredRun | undefined>;
  listRuns(projectId: string): Promise<StoredRun[]>;
  putRunResults(id: string, results: RunResults): Promise<void>;
  getRunResults(id: string): Promise<RunResults | undefined>;
  /** Deletes the run record and its results together. */
  deleteRun(id: string): Promise<void>;
  putRecord(store: RecordStore, projectId: string, rec: StoredRecord): Promise<void>;
  listRecords(store: RecordStore, projectId: string): Promise<unknown[]>;
  putMedia(id: string, blob: Blob): Promise<void>;
  getMedia(id: string): Promise<Blob | undefined>;
}

/** In-memory store with the same behaviour (tests; values are copied in and out like IndexedDB). */
export class MemorySiteStore implements SiteStore {
  private projects = new Map<string, StoredProject>();
  private runs = new Map<string, StoredRun>();
  private results = new Map<string, RunResults>();
  private records = { inspections: new Map<string, { projectId: string; rec: StoredRecord }>(), proposals: new Map<string, { projectId: string; rec: StoredRecord }>() };
  private media = new Map<string, Blob>();

  async putProject(p: StoredProject) { this.projects.set(p.project_id, structuredClone(p)); }
  async getProject(id: string) { const p = this.projects.get(id); return p && structuredClone(p); }
  async listProjects() { return [...this.projects.values()].map((p) => structuredClone(p)); }
  async putRun(r: StoredRun) { this.runs.set(r.run.run_id, structuredClone(r)); }
  async getRun(id: string) { const r = this.runs.get(id); return r && structuredClone(r); }
  async listRuns(projectId: string) { return [...this.runs.values()].filter((r) => r.projectId === projectId).map((r) => structuredClone(r)); }
  async putRunResults(id: string, results: RunResults) { this.results.set(id, structuredClone(results)); }
  async getRunResults(id: string) { const r = this.results.get(id); return r && structuredClone(r); }
  async deleteRun(id: string) { this.runs.delete(id); this.results.delete(id); }
  async putRecord(store: RecordStore, projectId: string, rec: StoredRecord) { this.records[store].set(rec.id, { projectId, rec: structuredClone(rec) }); }
  async listRecords(store: RecordStore, projectId: string) { return [...this.records[store].values()].filter((r) => r.projectId === projectId).map((r) => structuredClone(r.rec)); }
  async putMedia(id: string, blob: Blob) { this.media.set(id, blob); }
  async getMedia(id: string) { return this.media.get(id); }
}

export const DB_NAME = 'floodops-local-sites';
// v2: v1 databases created before `runResults` existed lack that store; the upgrade creates any missing store.
const DB_VERSION = 2;

/** Creates every object store the app needs that the database doesn't have yet (keeps existing data). */
function ensureStores(db: IDBDatabase): void {
  const has = (name: string) => db.objectStoreNames.contains(name);
  if (!has('projects')) db.createObjectStore('projects', { keyPath: 'project_id' });
  if (!has('runs')) db.createObjectStore('runs', { keyPath: 'run.run_id' }).createIndex('projectId', 'projectId');
  if (!has('runResults')) db.createObjectStore('runResults');
  if (!has('inspections')) db.createObjectStore('inspections', { keyPath: 'rec.id' }).createIndex('projectId', 'projectId');
  if (!has('proposals')) db.createObjectStore('proposals', { keyPath: 'rec.id' }).createIndex('projectId', 'projectId');
  if (!has('media')) db.createObjectStore('media');
}

const done = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed.'));
  });

/** IndexedDB store: database `floodops-local-sites`, opened once on first use. */
export class IndexedDbSiteStore implements SiteStore {
  private db: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    if (!this.db) {
      const opening = new Promise<IDBDatabase>((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
          reject(new Error('This browser has no IndexedDB, so site projects cannot be stored locally.'));
          return;
        }
        let gaveUp = false;
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => ensureStores(req.result);
        req.onsuccess = () => {
          const db = req.result;
          // An open that completes after we gave up (blocked) must not leak a connection.
          if (gaveUp) {
            db.close();
            return;
          }
          db.onversionchange = () => {
            db.close();
            if (this.db === opening) this.db = null;
          };
          resolve(db);
        };
        req.onerror = () => reject(req.error ?? new Error('Could not open the local site database.'));
        req.onblocked = () => {
          gaveUp = true;
          reject(new Error('The local site database is blocked by another open tab. Close it and try again.'));
        };
      });
      this.db = opening;
      opening.catch(() => {
        if (this.db === opening) this.db = null;
      });
    }
    return this.db;
  }

  /** One request in its own transaction over `stores`; resolves when the transaction completes. */
  private async tx<T>(stores: string | string[], mode: IDBTransactionMode, op: (t: IDBTransaction) => IDBRequest<T>): Promise<T> {
    const db = await this.open();
    const t = db.transaction(stores, mode);
    const committed = new Promise<void>((resolve, reject) => {
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error ?? new Error('IndexedDB transaction failed.'));
      t.onabort = () => reject(t.error ?? new Error('IndexedDB transaction aborted (storage may be full).'));
    });
    const [value] = await Promise.all([done(op(t)), committed]);
    return value;
  }

  async putProject(p: StoredProject) { await this.tx('projects', 'readwrite', (t) => t.objectStore('projects').put(p)); }
  getProject(id: string) { return this.tx<StoredProject | undefined>('projects', 'readonly', (t) => t.objectStore('projects').get(id)); }
  listProjects() { return this.tx<StoredProject[]>('projects', 'readonly', (t) => t.objectStore('projects').getAll()); }
  async putRun(r: StoredRun) { await this.tx('runs', 'readwrite', (t) => t.objectStore('runs').put(r)); }
  getRun(id: string) { return this.tx<StoredRun | undefined>('runs', 'readonly', (t) => t.objectStore('runs').get(id)); }
  listRuns(projectId: string) { return this.tx<StoredRun[]>('runs', 'readonly', (t) => t.objectStore('runs').index('projectId').getAll(projectId)); }
  async putRunResults(id: string, results: RunResults) { await this.tx('runResults', 'readwrite', (t) => t.objectStore('runResults').put(results, id)); }
  getRunResults(id: string) { return this.tx<RunResults | undefined>('runResults', 'readonly', (t) => t.objectStore('runResults').get(id)); }
  async deleteRun(id: string) {
    await this.tx(['runs', 'runResults'], 'readwrite', (t) => {
      t.objectStore('runs').delete(id);
      return t.objectStore('runResults').delete(id);
    });
  }
  async putRecord(store: RecordStore, projectId: string, rec: StoredRecord) { await this.tx(store, 'readwrite', (t) => t.objectStore(store).put({ projectId, rec })); }
  async listRecords(store: RecordStore, projectId: string) {
    const rows = await this.tx<{ rec: StoredRecord }[]>(store, 'readonly', (t) => t.objectStore(store).index('projectId').getAll(projectId));
    return rows.map((r) => r.rec);
  }
  async putMedia(id: string, blob: Blob) { await this.tx('media', 'readwrite', (t) => t.objectStore('media').put(blob, id)); }
  getMedia(id: string) { return this.tx<Blob | undefined>('media', 'readonly', (t) => t.objectStore('media').get(id)); }
}
