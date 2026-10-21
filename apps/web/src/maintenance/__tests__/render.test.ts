import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { MaintenanceWorkspace } from '../MaintenanceWorkspace';
import { AssetDetailModal } from '../../components/AssetDetailModal';
import { engineSource } from '../../engine/engineSource';

it('renders a maintenance-first overview and explicit missing evidence without invented alerts', () => {
  const a=engineSource.getTownshipAssets();
  const html=renderToStaticMarkup(createElement(MaintenanceWorkspace,{view:'priorities',onView:()=>{},nodes:a.nodes,inlets:a.inlets,conduits:a.conduits,inspections:[],selectedAsset:null,onSelectAsset:()=>{},onInspect:()=>{},scenario:{mode:'engine',storm_id:'synthetic_80mmh_60min',debris_id:'engine_d07_40pct',tailwater:'normal',model_version_id:a.model_version_id}}));
  expect(html).toContain('What needs attention?');
  expect(html).toContain('No inspection recorded');
  expect(html).toContain('Illustrative locations');
  expect(html).not.toContain('CRITICAL');
  expect(html).not.toContain('1.24');
});
it('renders real asset dimensions and missing inspection state in the evidence drawer', () => {
  const p=engineSource.getTownshipAssets().conduits.find(p=>p.conduit_id==='PIPE-P07')!;
  const html=renderToStaticMarkup(createElement(AssetDetailModal,{selectedAsset:{type:'conduit',id:p.conduit_id,data:p},onClose:()=>{},inspections:[],onOpenInspect:()=>{},onOpenInterventions:()=>{},currentFrame:null,blockageFraction:0}));
  expect(html).toContain('0.600 m');
  expect(html).toContain('No inspection recorded');
  expect(html).not.toContain('72%');
});
