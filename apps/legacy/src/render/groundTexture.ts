import * as THREE from 'three';
import { INFIL_BY_LAND } from '@floodops/engine/scenario/terrain';
import { LandUse, type Grid } from '@floodops/engine/sim/types';
import { mulberry32 } from './rng';

export type Look = 'day' | 'xray';

// fills indexed by LandUse code: ROOF, ROAD, LAWN, PARK, POND, RIVER
export const GROUND = {
  day: {
    fills: ['#fbfaf7', '#f4f1ea', '#dfe6d3', '#cfdcc0', '#cfe0e0', '#9fd0e0'],
    bioswale: '#c7d9b5',
    roadEdge: '#e2ddd2',
    lotEdge: null as string | null,
    lotShadow: 'rgba(60, 50, 30, 0.12)' as string | null,
  },
  xray: {
    fills: ['#142033', '#1d2d45', '#142033', '#142033', '#10283f', '#10283f'],
    bioswale: '#142033',
    roadEdge: '#2e4a6e',
    lotEdge: '#22344f' as string | null,
    lotShadow: null as string | null,
  },
};

/** Bioswale cells are PARK cells whose infiltration was raised by the bioswales preset. */
export function isBioswale(grid: Grid, c: number): boolean {
  return grid.land[c] === LandUse.PARK && grid.infil[c] > INFIL_BY_LAND[LandUse.PARK] + 1e-12;
}

export function landColor(code: number, look: Look, bioswale = false): string {
  const p = GROUND[look];
  return bioswale ? p.bioswale : p.fills[code];
}

/** Paints the land-use grid into a square texture (north at the top), matching the terrain's cell-centre UVs. */
export function paintGround(grid: Grid, look: Look, size: number): THREE.CanvasTexture {
  const { nx, ny, land } = grid;
  const s = size / nx;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const pal = GROUND[look];
  const rnd = mulberry32(7);
  const tmp = new THREE.Color();
  const px = (i: number) => i * s;
  const py = (j: number) => (ny - 1 - j) * s;

  for (let c = 0; c < nx * ny; c++) {
    if (land[c] === LandUse.ROOF) continue;
    const i = c % nx;
    const j = Math.floor(c / nx);
    let col = landColor(land[c], look, isBioswale(grid, c));
    if (look === 'day' && land[c] === LandUse.LAWN) col = tmp.set(col).offsetHSL(0, 0, (rnd() - 0.5) * 0.06).getStyle();
    ctx.fillStyle = col;
    ctx.fillRect(px(i), py(j), s + 0.5, s + 0.5);
  }

  const off = Math.max(1, s * 0.15);
  if (pal.lotShadow) {
    ctx.fillStyle = pal.lotShadow;
    for (let c = 0; c < nx * ny; c++) {
      if (land[c] !== LandUse.ROOF) continue;
      ctx.fillRect(px(c % nx) + off, py(Math.floor(c / nx)) + off, s, s);
    }
  }
  ctx.fillStyle = pal.fills[LandUse.ROOF];
  for (let c = 0; c < nx * ny; c++) {
    if (land[c] !== LandUse.ROOF) continue;
    ctx.fillRect(px(c % nx), py(Math.floor(c / nx)), s + 0.5, s + 0.5);
  }

  const edges = (pred: (c: number) => boolean, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, s * 0.12);
    ctx.beginPath();
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const c = j * nx + i;
        const here = pred(c);
        if (i < nx - 1 && here !== pred(c + 1)) {
          ctx.moveTo(px(i + 1), py(j));
          ctx.lineTo(px(i + 1), py(j) + s);
        }
        if (j < ny - 1 && here !== pred(c + nx)) {
          ctx.moveTo(px(i), py(j));
          ctx.lineTo(px(i) + s, py(j));
        }
      }
    }
    ctx.stroke();
  };
  edges((c) => land[c] === LandUse.ROAD, pal.roadEdge);
  if (pal.lotEdge) edges((c) => land[c] === LandUse.ROOF, pal.lotEdge);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
