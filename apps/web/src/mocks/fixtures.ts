import {
  BootstrapResponse,
  HealthResponse,
  InspectionRecord,
  SimulationFramesResponse,
  SimulationMetricsResponse,
  SimulationRun,
  TownshipAssetsResponse,
} from '../types';

import rawAssets from './data/assets.json';
import rawBootstrap from './data/bootstrap.json';
import rawFramesBaseline from './data/frames-baseline.json';
import rawMetricsBaseline from './data/metrics-baseline.json';
import rawRunBaseline from './data/run-baseline.json';
import rawFramesStronger from './data/frames-stronger.json';
import rawMetricsStronger from './data/metrics-stronger.json';
import rawRunStronger from './data/run-stronger.json';

export const MOCK_HEALTH: HealthResponse = {
  status: 'ok',
  api_version: '1.0.0',
  swmm: {
    available: true,
    engine: 'EPA SWMM',
    engine_version: '5.2.4',
    execution_verified: true,
    message: 'Native SWMM engine and verified T1 output artifacts are fully loaded.',
  },
  capabilities: {
    assets: true,
    storm_creation: false,
    simulations: false,
    inspections: false,
    debris: false,
    comparisons: false,
  },
};

export const MOCK_BOOTSTRAP: BootstrapResponse = rawBootstrap as unknown as BootstrapResponse;

export const MOCK_ASSETS: TownshipAssetsResponse = rawAssets as unknown as TownshipAssetsResponse;

export const MOCK_RUN_BASELINE: SimulationRun = rawRunBaseline as unknown as SimulationRun;
export const MOCK_FRAMES_BASELINE: SimulationFramesResponse = rawFramesBaseline as unknown as SimulationFramesResponse;
export const MOCK_METRICS_BASELINE: SimulationMetricsResponse = rawMetricsBaseline as unknown as SimulationMetricsResponse;

export const MOCK_RUN_STRONGER: SimulationRun = rawRunStronger as unknown as SimulationRun;
export const MOCK_FRAMES_STRONGER: SimulationFramesResponse = rawFramesStronger as unknown as SimulationFramesResponse;
export const MOCK_METRICS_STRONGER: SimulationMetricsResponse = rawMetricsStronger as unknown as SimulationMetricsResponse;

// Default to baseline
export const MOCK_RUN = MOCK_RUN_BASELINE;
export const MOCK_FRAMES = MOCK_FRAMES_BASELINE;
export const MOCK_METRICS = MOCK_METRICS_BASELINE;

export const MOCK_INSPECTIONS: InspectionRecord[] = [
  {
    inspection_id: 'insp-2026-10-18-001',
    asset_id: 'INLET-D07',
    timestamp: '2026-10-18T14:30:00+08:00',
    inspector: 'Inspector Azman (Field Team A)',
    method: 'visual',
    source_type: 'observed',
    visible_grate_coverage_fraction: 0.65, // 65% visual blockage observed on ground
    debris_category: 'leaf_litter',
    notes: 'Severe accumulation of leaf litter and organic road silt covering over 60% of grate surface. Tree overhanging right above curb throat.',
    media_urls: ['/assets/mock_inlet_clogged.jpg'],
  },
  {
    inspection_id: 'insp-2026-10-10-002',
    asset_id: 'INLET-D07',
    timestamp: '2026-10-10T09:15:00+08:00',
    inspector: 'Inspector Azman (Field Team A)',
    method: 'visual',
    source_type: 'observed',
    visible_grate_coverage_fraction: 0.15,
    debris_category: 'plastic',
    notes: 'Routine weekly check. Clean condition with minor windblown litter.',
  },
  {
    inspection_id: 'insp-2026-10-05-003',
    asset_id: 'INLET-D01',
    timestamp: '2026-10-05T11:00:00+08:00',
    inspector: 'Inspector Siti (Field Unit B)',
    method: 'visual',
    source_type: 'observed',
    visible_grate_coverage_fraction: 0.1,
    debris_category: 'sediment',
    notes: 'Grate in good condition, slight sand deposition at throat.',
  },
];
