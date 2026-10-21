// Map pins for the automated fix analysis (spec §9): one drei Html card per problem, placed in team coordinates
// (x east, y north, z up → three [x, z, −y]) at the problem's location on the uploaded city. Html removes its own DOM
// node on unmount; nothing else is created here.
import { useEffect, useMemo, useState, type ReactNode, type SyntheticEvent } from 'react';
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
  /** Short marker tooltip, e.g. the problem heading. */
  title?: string;
  /** Marker shows a spinner while the analysis for this problem is still running. */
  pending?: boolean;
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

/**
 * Map marker in the legacy viewer's pin style (round head with an icon, short stem): the problem shows as a pin first;
 * pressing it opens its card above the pin. One card is open at a time.
 */
export function PinMarker({ title, pending, open, onToggle }: { title?: string; pending?: boolean; open: boolean; onToggle: () => void }) {
  return <button type="button" className={`site-map-pin ${open ? 'open' : ''} ${pending ? 'pending' : ''}`} aria-expanded={open} aria-label={title ? `${title}: ${open ? 'hide' : 'show'} suggested fix` : 'Show suggested fix'} title={title} onClick={onToggle}>
    <span className="site-map-pin-head">{pending ? <LoaderCircle size={13} className="site-spin"/> : <span aria-hidden>⚠</span>}</span>
  </button>;
}

export function FixPins({ site, pins }: { site: SiteSpec; pins: readonly MapPin[] }) {
  const placed = useMemo(() => pins.map((p) => ({ ...p, position: [p.x, groundAt(site, p.x, p.y) + LIFT_M, -p.y] as [number, number, number] })), [site, pins]);
  const [openId, setOpenId] = useState<string | null>(null);
  // A pin that disappears (seek back, Dismiss, OK) closes its card.
  useEffect(() => {
    if (openId && !pins.some((p) => p.id === openId)) setOpenId(null);
  }, [pins, openId]);
  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenId(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId]);
  return <>
    {placed.map((p) => (
      // zIndexRange keeps pins under the workspace's sticky header and tabs; the open pin sits above the others.
      <Html key={p.id} position={p.position} zIndexRange={openId === p.id ? [30, 21] : [20, 10]} style={{ pointerEvents: 'auto' }}>
        <div className="site-map-pin-anchor" {...KEEP_EVENTS_ON_PIN}>
          {openId === p.id && <div className="site-fix-pin site-fix-pin-popover" role="dialog" aria-label="Automated analysis finding">
            <button type="button" className="site-fix-pin-close" aria-label="Close" onClick={() => setOpenId(null)}>×</button>
            {p.content}
          </div>}
          <PinMarker title={p.title} pending={p.pending} open={openId === p.id} onToggle={() => setOpenId((cur) => (cur === p.id ? null : p.id))} />
        </div>
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
