import { describe, expect, it } from 'vitest';
import { orthoZoomFor, pickScaleStep, topHeightFor } from '../scaleBar';

describe('scaleBar', () => {
  it('picks the largest step that fits in 160 px', () => {
    expect(pickScaleStep(0.5)).toEqual({ metres: 50, px: 100 });
    expect(pickScaleStep(10)).toEqual({ metres: 200, px: 20 });
    expect(pickScaleStep(0.01)).toEqual({ metres: 10, px: 1000 });
  });
  it('fits the 240 × 280 m site inside the viewport with a 16 px margin', () => {
    expect(orthoZoomFor(1000, 800)).toBeCloseTo(768 / 280, 6);
    expect(orthoZoomFor(400, 2000)).toBeCloseTo(368 / 240, 6);
  });
  it('places the perspective camera so its frame matches the ortho frame', () => {
    expect(topHeightFor(800, 2, 45)).toBeCloseTo(200 / Math.tan((22.5 * Math.PI) / 180), 6);
  });
});
