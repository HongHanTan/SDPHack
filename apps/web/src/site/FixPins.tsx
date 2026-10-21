// Map pins for the automated fix analysis (spec §9): one drei Html card per problem, placed in team coordinates
// (x east, y north, z up → three [x, z, −y]) at the problem's location on the uploaded city. Html removes its own DOM
// node on unmount; nothing else is created here.
import { useMemo, type ReactNode } from 'react';
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

export function FixPins({ site, pins }: { site: SiteSpec; pins: readonly MapPin[] }) {
  const placed = useMemo(() => pins.map((p) => ({ ...p, position: [p.x, groundAt(site, p.x, p.y) + LIFT_M, -p.y] as [number, number, number] })), [site, pins]);
  return <>
    {placed.map((p) => (
      // zIndexRange keeps the cards under the workspace's sticky header and tabs.
      <Html key={p.id} position={p.position} zIndexRange={[20, 10]}>
        <div className="site-fix-pin-anchor"><div className="site-fix-pin" role="dialog" aria-label="Automated analysis finding">{p.content}</div></div>
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
      <span className="site-fix-pin-label">Suggested fix: {view.fix.label}</span>
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
