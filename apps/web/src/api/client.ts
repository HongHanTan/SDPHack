import {
  ApiErrorResponse,
  BootstrapResponse,
  DebrisCreateRequest,
  DebrisPreset,
  HealthResponse,
  InspectionMediaItem,
  InspectionRecord,
  SimulationCreateRequest,
  SimulationFramesResponse,
  SimulationMetricsResponse,
  SimulationRun,
  SourceType,
  StormPreset,
  TownshipAssetsResponse,
} from '../types';
import {
  MOCK_ASSETS,
  MOCK_BOOTSTRAP,
  MOCK_FRAMES_BASELINE,
  MOCK_FRAMES_STRONGER,
  MOCK_HEALTH,
  MOCK_INSPECTIONS,
  MOCK_METRICS_BASELINE,
  MOCK_METRICS_STRONGER,
  MOCK_RUN_BASELINE,
  MOCK_RUN_STRONGER,
} from '../mocks/fixtures';
import { engineSource } from '../engine/engineSource';

export type DataMode = 'engine' | 'mock' | 'api';

const STORAGE_KEY_MODE = 'floodops_data_mode';
const STORAGE_KEY_BASE_URL = 'floodops_api_base_url';
const STORAGE_KEY_INSPECTIONS = 'floodops_local_inspections';

export class ApiClient {
  private mode: DataMode;
  private baseUrl: string;

  constructor() {
    const envMode = (import.meta.env.VITE_DATA_MODE as DataMode) || 'engine';
    const savedMode = (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY_MODE)) as DataMode | null;
    this.mode = savedMode || envMode;

    const envBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    const savedBaseUrl = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_BASE_URL) : null;
    this.baseUrl = savedBaseUrl || envBaseUrl;
  }

  public getDataMode(): DataMode {
    return this.mode;
  }

  public setDataMode(mode: DataMode): void {
    this.mode = mode;
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_MODE, mode);
    }
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public setBaseUrl(url: string): void {
    this.baseUrl = url;
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_BASE_URL, url);
    }
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    let res: Response;
    try {
      res = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options?.headers || {}),
        },
      });
    } catch (networkError: unknown) {
      throw new Error(
        `[Network Error] Failed to connect to FloodOps API at ${url}. ${
          networkError instanceof Error ? networkError.message : String(networkError)
        }`
      );
    }

    if (!res.ok) {
      let errorData: ApiErrorResponse | null = null;
      try {
        errorData = (await res.json()) as ApiErrorResponse;
      } catch {
        // Ignored
      }
      const message = errorData?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
      const code = errorData?.error?.code || `HTTP_${res.status}`;
      const err = new Error(`[${code}] ${message}`);
      (err as unknown as { code: string; details: unknown }).code = code;
      (err as unknown as { code: string; details: unknown }).details = errorData?.error?.details;
      throw err;
    }

    return (await res.json()) as T;
  }

  // --- API Methods ---

  public async getHealth(): Promise<HealthResponse> {
    if (this.mode === 'engine') {
      return engineSource.getHealth();
    }
    if (this.mode === 'mock') {
      return MOCK_HEALTH;
    }
    return this.request<HealthResponse>('/api/health');
  }

  public async getBootstrap(): Promise<BootstrapResponse> {
    if (this.mode === 'engine') {
      return engineSource.getBootstrap();
    }
    if (this.mode === 'mock') {
      return MOCK_BOOTSTRAP;
    }
    return this.request<BootstrapResponse>('/api/bootstrap');
  }

  public async getTownshipAssets(townshipId: string = 'taman_kyra_demo'): Promise<TownshipAssetsResponse> {
    if (this.mode === 'engine') {
      return engineSource.getTownshipAssets();
    }
    if (this.mode === 'mock') {
      return MOCK_ASSETS;
    }
    return this.request<TownshipAssetsResponse>(`/api/townships/${townshipId}/assets`);
  }

  public async createStorm(storm: {
    name: string;
    intensity_mmh: number;
    duration_s: number;
    source_type?: SourceType;
  }): Promise<StormPreset> {
    if (this.mode === 'engine') {
      throw new Error('[ENGINE] Not supported in engine mode — switch to Mock or SWMM API');
    }
    if (this.mode === 'mock') {
      return {
        storm_id: `mock-storm-${Date.now()}`,
        name: storm.name || 'Custom Mock Storm',
        source_type: storm.source_type || 'synthetic',
        parameters: {
          intensity_mmh: storm.intensity_mmh || 80,
          duration_s: storm.duration_s || 3600,
          pattern: 'constant',
        },
      };
    }
    return this.request<StormPreset>('/api/storms', {
      method: 'POST',
      body: JSON.stringify(storm),
    });
  }

  // Local evidence stays in this browser; API evidence stays on the server.
  private inspectionKey() { return `${STORAGE_KEY_INSPECTIONS}_${this.mode}`; }

  public async getInspections(assetId?: string): Promise<{ items: InspectionRecord[] }> {
    if (this.mode === 'api') {
      const query = assetId ? `?asset_id=${encodeURIComponent(assetId)}` : '';
      return this.request(`/api/inspections${query}`);
    }
    let stored = localStorage.getItem(this.inspectionKey());
    if (!stored && this.mode === 'mock') {
      const legacy = localStorage.getItem(STORAGE_KEY_INSPECTIONS);
      if (legacy) { JSON.parse(legacy); localStorage.setItem(this.inspectionKey(), legacy); stored = legacy; }
    }
    const local: InspectionRecord[] = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(local)) throw new Error('Saved inspection data is invalid.');
    const fixtures = this.mode === 'mock' ? MOCK_INSPECTIONS.map(i => ({ ...i, source_type: 'synthetic' as const, source_reference: 'Illustrative fixture; not a site observation.' })) : [];
    return { items: [...local, ...fixtures].filter(i => !assetId || i.asset_id === assetId) };
  }

  public async createInspection(data: Partial<InspectionRecord>): Promise<InspectionRecord> {
    const payload = { asset_id: data.asset_id, timestamp: data.timestamp || new Date().toISOString(), inspector: data.inspector,
      method: data.method || 'visual', source_type: data.source_type || 'synthetic',
      visible_grate_coverage_fraction: data.asset_id?.startsWith('INLET') ? data.visible_grate_coverage_fraction : null,
      debris_category: data.debris_category || 'none', notes: data.notes || '', source_reference: data.source_reference || '' };
    if (this.mode === 'api') return this.request('/api/inspections', { method: 'POST', body: JSON.stringify(payload) });
    const item = { ...payload, inspection_id: `insp-${crypto.randomUUID()}`, media_urls: [], media: [] } as InspectionRecord;
    const stored = localStorage.getItem(this.inspectionKey());
    const list = stored ? JSON.parse(stored) : [];
    localStorage.setItem(this.inspectionKey(), JSON.stringify([item, ...list]));
    return item;
  }

  public async uploadInspectionMedia(inspectionId: string, file: File): Promise<InspectionMediaItem> {
    if (file.size > 10 * 1024 * 1024) throw new Error('Media is limited to 10 MiB.');
    if (!['image/png', 'image/jpeg', 'image/webp', 'application/pdf'].includes(file.type)) throw new Error('Use PNG, JPEG, WebP or PDF.');
    if (this.mode !== 'api') {
      const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Unable to read attachment.')); reader.readAsDataURL(file); });
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))).map(b => b.toString(16).padStart(2, '0')).join('');
      const media: InspectionMediaItem = { media_id: crypto.randomUUID(), filename: file.name, content_type: file.type, size_bytes: file.size, sha256: hash, url: dataUrl, created_at: new Date().toISOString() };
      const stored = localStorage.getItem(this.inspectionKey());
      const list: InspectionRecord[] = stored ? JSON.parse(stored) : [];
      const item = list.find(i => i.inspection_id === inspectionId);
      if (!item) throw new Error('Inspection not found; attachment was not saved.');
      item.media = [...(item.media || []), media]; item.media_urls = [...(item.media_urls || []), media.url];
      localStorage.setItem(this.inspectionKey(), JSON.stringify(list));
      return media;
    }

    // Real API Multipart Upload (FormData)
    const formData = new FormData();
    formData.append('file', file);

    const url = `${this.baseUrl}/api/inspections/${inspectionId}/media`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        body: formData,
        // Notice: Content-Type header is omitted to let browser calculate boundary
      });
    } catch (networkError: unknown) {
      throw new Error(
        `[Network Error] Failed to upload media attachment to ${url}: ${
          networkError instanceof Error ? networkError.message : String(networkError)
        }`
      );
    }

    if (!res.ok) {
      let errorData: ApiErrorResponse | null = null;
      try {
        errorData = (await res.json()) as ApiErrorResponse;
      } catch {
        // Ignored
      }
      const message = errorData?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
      const code = errorData?.error?.code || `HTTP_${res.status}`;
      throw new Error(`[${code}] Media upload failed: ${message}`);
    }

    return (await res.json()) as InspectionMediaItem;
  }

  public async createDebrisScenario(
    data: DebrisCreateRequest | Partial<DebrisPreset>
  ): Promise<DebrisPreset> {
    if (this.mode === 'engine') {
      throw new Error('[ENGINE] Not supported in engine mode — switch to Mock or SWMM API');
    }
    if (this.mode === 'mock') {
      const clogging =
        'hydraulic_inlet_clogging_fraction' in data
          ? data.hydraulic_inlet_clogging_fraction
          : data.parameters?.hydraulic_inlet_clogging_fraction ?? 0.4;
      const inletId = 'inlet_id' in data ? data.inlet_id : data.parameters?.inlet_id || 'INLET-D07';

      return {
        debris_scenario_id: `mock-debris-${Date.now()}`,
        name: data.name || 'Custom Debris Hypothesis',
        source_type: 'assumed',
        parameters: {
          inlet_id: inletId,
          hydraulic_inlet_clogging_fraction: clogging,
          parameter_status: 'assumed_not_calibrated',
        },
        swmm_supported: false,
      };
    }

    return this.request<DebrisPreset>('/api/debris/scenarios', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async createSimulation(req: SimulationCreateRequest): Promise<{ run_id: string; status: string }> {
    if (this.mode === 'engine') {
      return engineSource.createSimulation(req);
    }
    if (this.mode === 'mock') {
      const isStronger = req.storm_id === 'synthetic_120mmh_60min';
      return {
        run_id: isStronger ? 't1_stronger' : 't1_baseline',
        status: 'succeeded',
      };
    }
    return this.request<{ run_id: string; status: string }>('/api/simulations', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  public async getSimulation(runId: string): Promise<SimulationRun> {
    if (this.mode === 'engine') {
      return engineSource.getSimulation(runId);
    }
    if (this.mode === 'mock') {
      return runId === 't1_stronger' ? MOCK_RUN_STRONGER : MOCK_RUN_BASELINE;
    }
    return this.request<SimulationRun>(`/api/simulations/${runId}`);
  }

  public async getSimulationFrames(runId: string): Promise<SimulationFramesResponse> {
    if (this.mode === 'engine') {
      return engineSource.getSimulationFrames(runId);
    }
    if (this.mode === 'mock') {
      return runId === 't1_stronger' ? MOCK_FRAMES_STRONGER : MOCK_FRAMES_BASELINE;
    }
    return this.request<SimulationFramesResponse>(`/api/simulations/${runId}/frames`);
  }

  public async getSimulationMetrics(runId: string): Promise<SimulationMetricsResponse> {
    if (this.mode === 'engine') {
      return engineSource.getSimulationMetrics(runId);
    }
    if (this.mode === 'mock') {
      return runId === 't1_stronger' ? MOCK_METRICS_STRONGER : MOCK_METRICS_BASELINE;
    }
    return this.request<SimulationMetricsResponse>(`/api/simulations/${runId}/metrics`);
  }

  // Explicit helper to get verified offline EPA SWMM 5.2.4 datasets
  public getOfflineFrames(stormId: string): SimulationFramesResponse {
    if (!['synthetic_80mmh_60min', 'synthetic_120mmh_60min'].includes(stormId)) throw new Error('No retained offline result exists for this storm.');
    return stormId === 'synthetic_120mmh_60min' ? MOCK_FRAMES_STRONGER : MOCK_FRAMES_BASELINE;
  }

  public getOfflineMetrics(stormId: string): SimulationMetricsResponse {
    if (!['synthetic_80mmh_60min', 'synthetic_120mmh_60min'].includes(stormId)) throw new Error('No retained offline result exists for this storm.');
    return stormId === 'synthetic_120mmh_60min' ? MOCK_METRICS_STRONGER : MOCK_METRICS_BASELINE;
  }
}

export const apiClient = new ApiClient();
