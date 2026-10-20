// Ported from apps/legacy (Hong Han): the plan view's scale bar steps and camera fit.

export const SCALE_STEPS_M = [10, 20, 50, 100, 200] as const;
export const SCALE_MAX_PX = 160;
export const MARGIN_PX = 16;
/** The team scene's lawn extent (scene x/z, metres): the area 2D frames. */
export const SITE = { cx: 45, cz: -10, w: 240, h: 280 } as const;
/** Approximate ground level of the team scene (scene y). */
export const GROUND_Y = 11;

/** The largest step whose bar fits in SCALE_MAX_PX at `mpp` metres per pixel (the smallest step if none fits). */
export function pickScaleStep(mpp: number): { metres: number; px: number } {
  const m = Math.max(1e-6, mpp);
  let metres: number = SCALE_STEPS_M[0];
  for (const s of SCALE_STEPS_M) if (s / m <= SCALE_MAX_PX) metres = s;
  return { metres, px: Math.round(metres / m) };
}

/** Orthographic zoom (pixels per metre) that fits the site in the viewport with MARGIN_PX on every side. */
export function orthoZoomFor(viewW: number, viewH: number, siteW: number = SITE.w, siteH: number = SITE.h): number {
  const mpp = Math.max(siteW / Math.max(1, viewW - 2 * MARGIN_PX), siteH / Math.max(1, viewH - 2 * MARGIN_PX));
  return 1 / mpp;
}

/** Height above the target at which a perspective camera of `fovDeg` sees the same frame as the ortho camera. */
export function topHeightFor(viewH: number, zoom: number, fovDeg: number): number {
  return viewH / 2 / zoom / Math.tan((fovDeg * Math.PI) / 360);
}
