export type Ring = Array<[number, number]>;

/** Shoelace centroid and (absolute) area; falls back to the vertex mean for degenerate rings. */
export function polygonCentroidArea(ring: Ring): { cx: number; cy: number; area: number } {
  const pts = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring;
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    const cross = x0 * y1 - x1 * y0;
    a += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  if (Math.abs(a) < 1e-12) {
    const n = pts.length || 1;
    return { cx: pts.reduce((s, p) => s + p[0], 0) / n, cy: pts.reduce((s, p) => s + p[1], 0) / n, area: 0 };
  }
  return { cx: cx / (3 * a), cy: cy / (3 * a), area: Math.abs(a / 2) };
}

/** Oriented rectangle around a footprint: axis = rotationDeg if given, else the longest edge; width runs along the axis. */
export function fitRect(ring: Ring, rotationDeg?: number): { cx: number; cy: number; width: number; depth: number; rotationDeg: number } {
  let angle = rotationDeg;
  if (angle === undefined) {
    let best = -1;
    for (let i = 0; i + 1 < ring.length; i++) {
      const dx = ring[i + 1][0] - ring[i][0];
      const dy = ring[i + 1][1] - ring[i][1];
      const len = Math.hypot(dx, dy);
      if (len > best + 1e-9) {
        best = len;
        angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      }
    }
    // Close the ring if the last point isn't the first.
    const [fx, fy] = ring[0];
    const [lx, ly] = ring[ring.length - 1];
    const closing = Math.hypot(fx - lx, fy - ly);
    if (closing > best + 1e-9) angle = (Math.atan2(fy - ly, fx - lx) * 180) / Math.PI;
  }
  const a = ((angle ?? 0) * Math.PI) / 180;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (const [x, y] of ring) {
    const u = x * ux + y * uy;
    const v = -x * uy + y * ux;
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }
  const mu = (minU + maxU) / 2;
  const mv = (minV + maxV) / 2;
  return { cx: mu * ux - mv * uy, cy: mu * uy + mv * ux, width: maxU - minU, depth: maxV - minV, rotationDeg: angle ?? 0 };
}
