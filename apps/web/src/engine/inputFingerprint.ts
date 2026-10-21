import type { Grid } from '@floodops/engine/sim/types';

async function bytesHash(values:ArrayBufferView) {
  const bytes=new Uint8Array(values.buffer,values.byteOffset,values.byteLength).slice();
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
}
/** Identifies the complete numerical grid, including terrain and initial water, without pretending dimensions alone identify it. */
export async function gridFingerprint(grid:Grid) {
  const [ground,land,infiltration,buildings,initialWater]=await Promise.all([grid.z,grid.land,grid.infil,grid.building,grid.h0].map(bytesHash));
  return {version:'grid-bytes-sha256-v1',nx:grid.nx,ny:grid.ny,dx:grid.dx,ground_sha256:ground,land_sha256:land,infiltration_sha256:infiltration,building_sha256:buildings,initial_water_sha256:initialWater};
}
