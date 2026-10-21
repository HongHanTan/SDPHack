import {describe,expect,it,vi} from 'vitest';
import {siteRequest} from '../api';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {convertSwmmPackage,ascWithoutInp} from '../swmmPackage';
const dir=join(__dirname,'../../../public/site-examples/taman-kyra-swmm');
const read=(name:string)=>({name,text:readFileSync(join(dir,name),'utf8')});
const three=()=>['taman_kyra.inp','taman_kyra_layout.geojson','taman_kyra_ground.asc'].map(read);
describe('SWMM package conversion',()=>{
 it('converts the sample package to a bundle file',async()=>{
  const r=await convertSwmmPackage(three());
  expect(r.errors).toEqual([]);
  expect(r.bundleFile?.name).toBe('taman_kyra.site.json');
  expect(r.bundleFile?.role).toBe('bundle');
  const b=JSON.parse(r.bundleFile!.text);
  expect(b.format).toBe('floodops-site-v1');
  expect(b.project.source_reference).toContain('SHA-256');
  expect(r.originals).toEqual(['taman_kyra.inp','taman_kyra_layout.geojson','taman_kyra_ground.asc']);
 });
 it('rejects an .inp mixed with site tables',async()=>{
  const r=await convertSwmmPackage([read('taman_kyra.inp'),{name:'nodes.csv',text:'node_id\nA'}]);
  expect(r.errors).toContain('Upload either a SWMM package (.inp with optional layout .geojson and height .asc) or the site tables, not both.');
  expect(r.bundleFile).toBeUndefined();
 });
 it('rejects two .inp files',async()=>{
  const r=await convertSwmmPackage([read('taman_kyra.inp'),read('taman_kyra_p07_750.inp')]);
  expect(r.errors.join(' ')).toMatch(/Only one \.inp/);
 });
});
describe('portal edge cases',()=>{
 it('flags a lone .asc',()=>{expect(ascWithoutInp(['g.asc'])).toBe(true);expect(ascWithoutInp(['g.asc','m.inp'])).toBe(false);expect(ascWithoutInp(['nodes.csv'])).toBe(false);});
 it('explains an unreachable API',async()=>{
  const spy=vi.spyOn(globalThis,'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
  await expect(siteRequest('/x')).rejects.toThrow(/Project API unreachable at .*port 8000/);
  spy.mockRestore();
 });
});
