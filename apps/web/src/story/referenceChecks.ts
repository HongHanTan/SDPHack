import { runSimulation } from '@floodops/engine/sim/engine';
import { LandUse, type Grid, type Scenario } from '@floodops/engine/sim/types';
import { manningFullCapacity } from '@floodops/engine/sim/pipes';

export interface ReferenceCheck {id:string;title:string;expected:number;calculated:number;absolute_error:number;tolerance:number;unit:string;passed:boolean;reference:string}
export function browserReferenceChecks():ReferenceCheck[] {
  const grid:Grid={nx:4,ny:4,dx:2,z:new Float32Array(16),land:new Uint8Array(16).fill(LandUse.ROAD),infil:new Float32Array(16),building:new Int32Array(16).fill(-1),h0:new Float32Array(16)};
  const scenario:Scenario={grid,network:{nodes:[],pipes:[],outfalls:[],pumps:[]},storm:{id:'reference-rain',label:'Reference rainfall',returnPeriod:0,blockS:60,intensity:[120/3.6e6],provisional:true,peakMinute:0},river:{times:[0],levels:[0]},dt:0.5,recessionS:0,frameEveryS:30,thresholds:{road:0.15,home:0.3},sagCell:0};
  const rain=runSimulation(scenario);const rainExpected=120/3.6e6*60;
  const still=structuredClone(scenario);still.storm.intensity=[0];still.grid.z=Float32Array.from({length:16},(_,i)=>i%4*0.1);still.grid.h0=Float32Array.from(still.grid.z,z=>1-z);
  const lake=runSimulation(still);const lakeFrame=lake.frames.at(-1)!;
  const stillError=Math.max(...lakeFrame.depth.map((d,i)=>Math.abs(d+still.grid.z[i]-1)));
  const expectedPipe=(1/0.013)*(Math.PI*0.6**2/4)*(0.6/4)**(2/3)*Math.sqrt(0.01);
  const cases=[
    {id:'rain',title:'Closed flat surface: rainfall equals depth increase',expected:rainExpected,calculated:rain.frames.at(-1)!.depth[0],tolerance:1e-8,unit:'m',reference:'Independent depth = rain intensity x duration; 120 mm/h for 60 s, no infiltration, drains or open boundaries.'},
    {id:'still',title:'Still water: maximum level departure over uneven ground',expected:0,calculated:stillError,tolerance:1e-6,unit:'m',reference:'Hydrostatic reference: z + h = 1 m everywhere, no rain or external flows. Maximum water-level departure.'},
    {id:'pipe',title:'Full-pipe capacity agrees with SI Manning reference',expected:expectedPipe,calculated:manningFullCapacity(0.6,0.01,0.013),tolerance:1e-12,unit:'m3/s',reference:'Independent formula with D=0.6 m, n=0.013, gradient=0.01. This checks a capacity calculation, not dynamic pressure routing.'},
  ];
  return cases.map(c=>({...c,absolute_error:Math.abs(c.calculated-c.expected),passed:Math.abs(c.calculated-c.expected)<=c.tolerance}));
}
