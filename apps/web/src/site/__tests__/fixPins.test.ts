import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { timingHint } from '../FixFinderPanel';
import { FixPinCard, KEEP_EVENTS_ON_PIN, PinAnchor, PinMarker } from '../FixPins';
import type { PinView } from '../fixPinText';

type Props = Record<string, unknown> & { children?: ReactNode };

/** Every element in a rendered tree (function components are called, as React would). */
function elements(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Props>(node)) return [];
  if (typeof node.type === 'function') return elements((node.type as (p: Props) => ReactNode)(node.props));
  return [node, ...elements(node.props.children)];
}
const fakeEvent = () => ({ stopPropagation: vi.fn() });

describe('PinAnchor', () => {
  it('stops pointer, click and wheel events at the card so the map controls and asset picking never get them', () => {
    const [anchor] = elements(createElement(PinAnchor, null, 'card'));
    expect(anchor.props.className).toBe('site-fix-pin-anchor');
    for (const name of ['onPointerDown', 'onPointerUp', 'onPointerMove', 'onClick', 'onWheel']) {
      const handler = anchor.props[name] as (e: unknown) => void;
      expect(handler, name).toBe(KEEP_EVENTS_ON_PIN[name as keyof typeof KEEP_EVENTS_ON_PIN]);
      const e = fakeEvent();
      handler(e);
      expect(e.stopPropagation, name).toHaveBeenCalledOnce();
    }
  });
});

describe('FixPinCard', () => {
  const view: PinView = {
    heading: '⚠ Bottleneck: PIPE-P07 full at 12:30', pending: false,
    fix: { label: 'Upsize PIPE-P07 to Ø750 mm', text: 'Suggested fix: Upsize PIPE-P07 to Ø750 mm', rows: [], cost: 'about RM 1 (indicative)', resultKey: 'k1' },
  };
  it('OK and Dismiss buttons call their handlers (the anchor only stops propagation after them)', () => {
    const onOk = vi.fn();
    const onDismiss = vi.fn();
    const buttons = elements(createElement(PinAnchor, null, createElement(FixPinCard, { view, busy: false, onOk, onDismiss }))).filter((e) => e.type === 'button');
    expect(buttons.map((b) => b.props.children)).toEqual(['OK', 'Dismiss']);
    (buttons[0].props.onClick as () => void)();
    (buttons[1].props.onClick as () => void)();
    expect(onOk).toHaveBeenCalledWith('k1');
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

describe('PinMarker', () => {
  it('is a legacy-style map pin button that toggles its card and reports whether it is open', () => {
    const onToggle = vi.fn();
    const [closed] = elements(createElement(PinMarker, { title: '⚠ Bottleneck: PIPE-P07 full at 01:30', open: false, onToggle }));
    expect(closed.type).toBe('button');
    expect(closed.props['aria-expanded']).toBe(false);
    expect(closed.props.className).toContain('site-map-pin');
    (closed.props.onClick as () => void)();
    expect(onToggle).toHaveBeenCalledOnce();
    const [open] = elements(createElement(PinMarker, { open: true, pending: true, onToggle }));
    expect(open.props['aria-expanded']).toBe(true);
    expect(open.props.className).toContain('open');
    expect(open.props.className).toContain('pending');
  });
});

describe('timingHint', () => {
  it('gives the measured time per candidate and says "in parallel" only with more than one worker', () => {
    expect(timingHint(1)).toBe('About 30–60 s per candidate. Problem pins appear on the map as the baseline plays.');
    expect(timingHint(3)).toBe('About 30–60 s per candidate; up to 3 run in parallel. Problem pins appear on the map as the baseline plays.');
  });
});
