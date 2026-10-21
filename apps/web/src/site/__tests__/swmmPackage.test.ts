import {describe,expect,it,vi} from 'vitest';
import {siteRequest} from '../api';
describe('portal edge cases',()=>{
 it('answers site requests in the browser, never over the network',async()=>{
  const spy=vi.spyOn(globalThis,'fetch');
  await expect(siteRequest('/x')).rejects.toThrow('Unknown local site request: /x');
  expect(spy).not.toHaveBeenCalled();
  spy.mockRestore();
 });
});
