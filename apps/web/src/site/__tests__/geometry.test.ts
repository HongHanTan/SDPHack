import {describe,expect,it} from 'vitest';
import sample from '../../../public/site-examples/riverside-complete.site.json';
import type {ImportedSite} from '../types';
import {siteBounds,terrainHeight} from '../geometry';
import {inferRole} from '../api';
describe('uploaded site geometry',()=>{
 it('uses the uploaded grid elevations and preserves horizontal translation',()=>{
  const site=sample as unknown as ImportedSite;
  const first=site.terrain[0];expect(terrainHeight(site,first.x,first.y)).toBeCloseTo(first.z);
  const moved=structuredClone(site);moved.nodes.forEach(n=>{n.x+=500;n.y-=700;});moved.terrain.forEach(n=>{n.x+=500;n.y-=700;});
  moved.inlets.forEach(n=>{n.x+=500;n.y-=700;});
  moved.roads.forEach(f=>(f.geometry.coordinates as number[][]).forEach(p=>{p[0]+=500;p[1]-=700;}));
  moved.buildings.forEach(f=>(f.geometry.coordinates as number[][][])[0].forEach(p=>{p[0]+=500;p[1]-=700;}));
  expect(siteBounds(moved).x-siteBounds(site).x).toBe(500);expect(siteBounds(moved).y-siteBounds(site).y).toBe(-700);
  expect(terrainHeight(moved,first.x+500,first.y-700)).toBeCloseTo(first.z);
 });
 it('interpolates a complete rectangular terrain grid rather than a fixed demo bowl',()=>{
  const site={...sample,terrain:[{x:0,y:0,z:0},{x:10,y:0,z:10},{x:0,y:10,z:10},{x:10,y:10,z:20}]} as unknown as ImportedSite;
  expect(terrainHeight(site,5,5)).toBe(10);expect(terrainHeight(site,0,10)).toBe(10);
 });
 it('identifies only documented file roles',()=>{
  expect(inferRole('customer.site.json')).toBe('bundle');expect(inferRole('nodes.csv')).toBe('nodes');expect(inferRole('buildings.geojson')).toBe('buildings');
 });
});
