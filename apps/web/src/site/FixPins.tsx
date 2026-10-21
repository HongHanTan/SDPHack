// Map pins for the automated fix analysis (spec §9): one drei Html card per problem, placed in team coordinates
// (x east, y north, z up → three [x, z, −y]) at the problem's location on the uploaded city. Html removes its own DOM
// node on unmount; nothing else is created here.
import { useMemo, type ReactNode, type SyntheticEvent } from 'react';
import { Html } from '@react-three/drei';
import { LoaderCircle } from 'lucide-react';
import type { SiteSpec } from '@floodops/engine/scenario/site';
import { groundAt, type PinView } from './fixPinText';

export interface MapPin {
  id: string;
  /** Team metres. */
  x: number;
  y: number;
  content: ReactNode;
}

/** Height of a pin's tip above the ground (m). */
const LIFT_M = 2.5;

/**
 * drei's Html renders the cards inside R3F's event wrapper, where OrbitControls' pointerdown captures the pointer and
 * R3F's click raycasts the asset behind the card (which would select it and fly the camera). Stopping these events at
 * the card keeps them on the card: its buttons still get their own clicks, but the map never sees them.
 */
const stop = (e: SyntheticEvent) => e.stopPropagation();
export const KEEP_EVENTS_ON_PIN = {
  onPointerDown: stop, onPointerUp: stop, onPointerMove: stop, onClick: stop, onDoubleClick: stop, onWheel: stop, onContextMenu: stop,
} as const;

/** The card root placed by Html: tip above the problem's location, events kept off the map. */
export function PinAnchor({ children }: { children: ReactNode }) {
  return <div className="site-fix-pin-anchor" {...KEEP_EVENTS_ON_PIN}><div className="site-fix-pin" role="dialog" aria-label="Automated analysis finding">{children}</div></div>;
}

export function FixPins({ site, pins }: { site: SiteSpec; pins: readonly MapPin[] }) {
  const placed = useMemo(() => pins.map((p) => ({ ...p, position: [p.x, groundAt(site, p.x, p.y) + LIFT_M, -p.y] as [number, number, number] })), [site, pins]);
  return <>
    {placed.map((p) => (
      // zIndexRange keeps the cards under the workspace's sticky header and tabs; pointer events stay on for the buttons.
      <Html key={p.id} position={p.position} zIndexRange={[20, 10]} style={{ pointerEvents: 'auto' }}>
        <PinAnchor>{p.content}</PinAnchor>
      </Html>
    ))}
  </>;
}

/** The text and buttons of one problem pin. */
export function FixPinCard({ view, busy, onOk, onDismiss }: { view: PinView; busy: boolean; onOk: (resultKey: string) => void; onDismiss: () => void }) {
  return <>
    <b className="site-fix-pin-heading">{view.heading}</b>
    {view.pending && <small className="site-fix-pin-pending"><LoaderCircle size={12} className="site-spin"/> Automated analysis running; the suggested fix appears here when it is ready.</small>}
    {view.fix && <>
      <span className="site-fix-pin-label">{view.fix.text}</span>
      <dl className="site-fix-pin-rows">{view.fix.rows.map((r) => <div key={r.label}><dt>{r.label}</dt><dd>{r.before} → {r.after}</dd></div>)}</dl>
      <small>{view.fix.cost}. Simulated by the FloodOps engine on your uploaded storm.</small>
    </>}
    {view.note && <small className="site-fix-pin-note">{view.note}</small>}
    <div className="site-fix-pin-actions">
      {view.fix && <button className="site-primary" disabled={busy} onClick={() => onOk(view.fix!.resultKey)}>{busy ? 'Opening…' : 'OK'}</button>}
      <button disabled={busy} onClick={onDismiss}>Dismiss</button>
    </div>
  </>;
}
