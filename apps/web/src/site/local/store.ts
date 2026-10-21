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
/** A run and its results; `metrics` and `depth` are null until the run succeeds. */
export interface StoredRun {
  run: SimulationRun & { created_at: string };
  projectId: string;
  frames: SimulationFrame[];
  metrics: SimulationMetricsResponse | null;
  depth: DepthGrids | null;
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
  private records = { inspections: new Map<string, { projectId: string; rec: StoredRecord }>(), proposals: new Map<string, { projectId: string; rec: StoredRecord }>() };
  private media = new Map<string, Blob>();

  async putProject(p: StoredProject) { this.projects.set(p.project_id, structuredClone(p)); }
  async getProject(id: string) { const p = this.projects.get(id); return p && structuredClone(p); }
  async listProjects() { return [...this.projects.values()].map((p) => structuredClone(p)); }
  async putRun(r: StoredRun) { this.runs.set(r.run.run_id, structuredClone(r)); }
  async getRun(id: string) { const r = this.runs.get(id); return r && structuredClone(r); }
  async listRuns(projectId: string) { return [...this.runs.values()].filter((r) => r.projectId === projectId).map((r) => structuredClone(r)); }
  async deleteRun(id: string) { this.runs.delete(id); }
  async putRecord(store: RecordStore, projectId: string, rec: StoredRecord) { this.records[store].set(rec.id, { projectId, rec: structuredClone(rec) }); }
  async listRecords(store: RecordStore, projectId: string) { return [...this.records[store].values()].filter((r) => r.projectId === projectId).map((r) => structuredClone(r.rec)); }
  async putMedia(id: string, blob: Blob) { this.media.set(id, blob); }
  async getMedia(id: string) { return this.media.get(id); }
}

export const DB_NAME = 'floodops-local-sites';
const DB_VERSION = 1;

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
      this.db = new Promise<IDBDatabase>((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
          reject(new Error('This browser has no IndexedDB, so site projects cannot be stored locally.'));
          return;
        }
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          db.createObjectStore('projects', { keyPath: 'project_id' });
          db.createObjectStore('runs', { keyPath: 'run.run_id' }).createIndex('projectId', 'projectId');
          db.createObjectStore('inspections', { keyPath: 'rec.id' }).createIndex('projectId', 'projectId');
          db.createObjectStore('proposals', { keyPath: 'rec.id' }).createIndex('projectId', 'projectId');
          db.createObjectStore('media');
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('Could not open the local site database.'));
        req.onblocked = () => reject(new Error('The local site database is blocked by another open tab. Close it and try again.'));
      });
      this.db.catch(() => {
        this.db = null;
      });
    }
    return this.db;
  }

  /** One request in its own transaction; resolves when the transaction completes. */
  private async tx<T>(store: string, mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open();
    const t = db.transaction(store, mode);
    const committed = new Promise<void>((resolve, reject) => {
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error ?? new Error('IndexedDB transaction failed.'));
      t.onabort = () => reject(t.error ?? new Error('IndexedDB transaction aborted (storage may be full).'));
    });
    const [value] = await Promise.all([done(op(t.objectStore(store))), committed]);
    return value;
  }

  async putProject(p: StoredProject) { await this.tx('projects', 'readwrite', (s) => s.put(p)); }
  getProject(id: string) { return this.tx<StoredProject | undefined>('projects', 'readonly', (s) => s.get(id)); }
  listProjects() { return this.tx<StoredProject[]>('projects', 'readonly', (s) => s.getAll()); }
  async putRun(r: StoredRun) { await this.tx('runs', 'readwrite', (s) => s.put(r)); }
  getRun(id: string) { return this.tx<StoredRun | undefined>('runs', 'readonly', (s) => s.get(id)); }
  listRuns(projectId: string) { return this.tx<StoredRun[]>('runs', 'readonly', (s) => s.index('projectId').getAll(projectId)); }
  async deleteRun(id: string) { await this.tx('runs', 'readwrite', (s) => s.delete(id)); }
  async putRecord(store: RecordStore, projectId: string, rec: StoredRecord) { await this.tx(store, 'readwrite', (s) => s.put({ projectId, rec })); }
  async listRecords(store: RecordStore, projectId: string) {
    const rows = await this.tx<{ rec: StoredRecord }[]>(store, 'readonly', (s) => s.index('projectId').getAll(projectId));
    return rows.map((r) => r.rec);
  }
  async putMedia(id: string, blob: Blob) { await this.tx('media', 'readwrite', (s) => s.put(blob, id)); }
  getMedia(id: string) { return this.tx<Blob | undefined>('media', 'readonly', (s) => s.get(id)); }
}
