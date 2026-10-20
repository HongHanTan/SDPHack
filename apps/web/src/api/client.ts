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

  // Load inspections from backend or local storage
  public async getInspections(assetId?: string): Promise<{ items: InspectionRecord[] }> {
    if (this.mode === 'engine') {
      return { items: [] };
    }
    if (this.mode === 'mock') {
      let local: InspectionRecord[] = [];
      try {
        const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_INSPECTIONS) : null;
        local = stored ? JSON.parse(stored) : [];
      } catch {
        local = [];
      }
      const combined = [...local, ...MOCK_INSPECTIONS];
      const filtered = assetId ? combined.filter((i) => i.asset_id === assetId) : combined;
      return { items: filtered };
    }

    const query = assetId ? `?asset_id=${encodeURIComponent(assetId)}` : '';
    return this.request<{ items: InspectionRecord[] }>(`/api/inspections${query}`);
  }

  public async createInspection(data: Partial<InspectionRecord>): Promise<InspectionRecord> {
    if (this.mode === 'engine') {
      throw new Error('[ENGINE] Not supported in engine mode — switch to Mock or SWMM API');
    }
    const isGrateAsset = (data.asset_id || '').startsWith('INLET');
    const isoTimestamp = data.timestamp || new Date().toISOString();

    const payload: Partial<InspectionRecord> = {
      asset_id: data.asset_id || 'INLET-D07',
      timestamp: isoTimestamp,
      inspector: data.inspector || 'Inspector Azman (Field Unit A)',
      method: data.method || 'visual',
      source_type: data.source_type || 'synthetic',
      visible_grate_coverage_fraction: isGrateAsset
        ? (data.visible_grate_coverage_fraction ?? 0.65)
        : null as unknown as number,
      debris_category: data.debris_category || 'leaf_litter',
      notes: data.notes || '',
      source_reference: data.source_reference || 'Township FloodOps 3D Client',
    };

    if (this.mode === 'mock') {
      const item: InspectionRecord = {
        inspection_id: `insp-${Date.now()}`,
        asset_id: payload.asset_id!,
        timestamp: payload.timestamp!,
        inspector: payload.inspector!,
        method: payload.method!,
        source_type: payload.source_type!,
        visible_grate_coverage_fraction: payload.visible_grate_coverage_fraction ?? 0.65,
        debris_category: payload.debris_category!,
        notes: payload.notes!,
        source_reference: payload.source_reference,
        media_urls: data.media_urls || ['/assets/mock_inlet_clogged.jpg'],
        media: data.media || [],
      };

      try {
        const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_INSPECTIONS) : null;
        const local = stored ? JSON.parse(stored) : [];
        local.unshift(item);
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY_INSPECTIONS, JSON.stringify(local));
        }
      } catch {
        // Fallback
      }
      MOCK_INSPECTIONS.unshift(item);
      return item;
    }

    return this.request<InspectionRecord>('/api/inspections', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Multipart media upload for inspections per T3 contract
  public async uploadInspectionMedia(
    inspectionId: string,
    file: File
  ): Promise<InspectionMediaItem> {
    if (this.mode === 'engine') {
      throw new Error('[ENGINE] Not supported in engine mode — switch to Mock or SWMM API');
    }
    const maxBytes = 10 * 1024 * 1024; // 10 MiB limit
    if (file.size > maxBytes) {
      throw new Error(`File size ${(file.size / (1024 * 1024)).toFixed(1)}MB exceeds maximum 10 MiB limit.`);
    }

    if (this.mode === 'mock') {
      const mockItem: InspectionMediaItem = {
        media_id: `media-${Date.now()}`,
        filename: file.name,
        content_type: file.type || 'image/jpeg',
        size_bytes: file.size,
        sha256: 'mock-sha256-' + Math.random().toString(36).substring(2, 10),
        url: URL.createObjectURL(file),
        created_at: new Date().toISOString(),
      };

      // Also attach to local mock inspection
      try {
        const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_INSPECTIONS) : null;
        if (stored) {
          const list = JSON.parse(stored) as InspectionRecord[];
          const target = list.find((i) => i.inspection_id === inspectionId);
          if (target) {
            target.media = target.media || [];
            target.media.unshift(mockItem);
            target.media_urls = target.media_urls || [];
            target.media_urls.unshift(mockItem.url);
            localStorage.setItem(STORAGE_KEY_INSPECTIONS, JSON.stringify(list));
          }
        }
      } catch {
        // Ignore
      }

      return mockItem;
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
    if (this.mode === 'mock' || runId === 't1_baseline' || runId === 't1_stronger') {
      return runId === 't1_stronger' ? MOCK_RUN_STRONGER : MOCK_RUN_BASELINE;
    }
    return this.request<SimulationRun>(`/api/simulations/${runId}`);
  }

  public async getSimulationFrames(runId: string): Promise<SimulationFramesResponse> {
    if (this.mode === 'engine') {
      return engineSource.getSimulationFrames(runId);
    }
    if (this.mode === 'mock' || runId === 't1_baseline' || runId === 't1_stronger') {
      return runId === 't1_stronger' ? MOCK_FRAMES_STRONGER : MOCK_FRAMES_BASELINE;
    }
    return this.request<SimulationFramesResponse>(`/api/simulations/${runId}/frames`);
  }

  public async getSimulationMetrics(runId: string): Promise<SimulationMetricsResponse> {
    if (this.mode === 'engine') {
      return engineSource.getSimulationMetrics(runId);
    }
    if (this.mode === 'mock' || runId === 't1_baseline' || runId === 't1_stronger') {
      return runId === 't1_stronger' ? MOCK_METRICS_STRONGER : MOCK_METRICS_BASELINE;
    }
    return this.request<SimulationMetricsResponse>(`/api/simulations/${runId}/metrics`);
  }

  // Explicit helper to get verified offline EPA SWMM 5.2.4 datasets
  public getOfflineFrames(stormId: string): SimulationFramesResponse {
    return stormId === 'synthetic_120mmh_60min' ? MOCK_FRAMES_STRONGER : MOCK_FRAMES_BASELINE;
  }

  public getOfflineMetrics(stormId: string): SimulationMetricsResponse {
    return stormId === 'synthetic_120mmh_60min' ? MOCK_METRICS_STRONGER : MOCK_METRICS_BASELINE;
  }
}

export const apiClient = new ApiClient();
