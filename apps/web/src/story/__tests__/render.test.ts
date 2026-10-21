import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { engineSource } from '../../engine/engineSource';
import { GuidedStory } from '../GuidedStory';

vi.mock('../StoryViewport',()=>({StoryViewport:()=>createElement('div',{'data-testid':'scene-placeholder'})}));
it('opens with an understandable question, explicit assumptions and no invented results',()=>{
  const html=renderToStaticMarkup(createElement(GuidedStory,{visible:true,scenario:{mode:'engine',storm_id:'synthetic_80mmh_60min',debris_id:'engine_d07_40pct',tailwater:'normal',model_version_id:'taman_kyra_synthetic_v1'},bootstrap:engineSource.getBootstrap(),inspections:[],onChangeScenario:()=>{},onMaintenance:()=>{},onInspect:()=>{},onPrepare:()=>{}}));
  expect(html).toContain('Will cleaning this drain be enough?');
  expect(html).toContain('Test this storm');expect(html).toContain('No inspection recorded');
  expect(html).toContain('not an EPA SWMM run');expect(html).toContain('40% assumed inlet loss');
  expect(html).not.toContain('692.90');expect(html).not.toContain('Maximum water depth at D07');
});
