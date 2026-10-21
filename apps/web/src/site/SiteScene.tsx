import {useEffect,useMemo} from 'react';
import {Canvas, type ThreeEvent} from '@react-three/fiber';
import {OrbitControls,Line} from '@react-three/drei';
import * as THREE from 'three';
import type {SiteProject} from './types';
import type {SimulationFrame} from '../types';
import {siteBounds,terrainHeight} from './geometry';

function AssetLabel({text,position,selected,height,onSelect}:{text:string;position:[number,number,number];selected?:boolean;height:number;onSelect:()=>void}){
 const texture=useMemo(()=>{
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d')!;ctx.font='600 28px Arial';canvas.width=Math.ceil(ctx.measureText(text).width)+28;canvas.height=52;
  ctx.font='600 28px Arial';ctx.fillStyle='#fffffff2';ctx.strokeStyle=selected?'#e94560':'#becfd7';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(1,1,canvas.width-2,50,7);ctx.fill();ctx.stroke();ctx.fillStyle=selected?'#bf2440':'#305e74';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,canvas.width/2,27);
  return new THREE.CanvasTexture(canvas);
 },[text,selected]);
 useEffect(()=>()=>texture.dispose(),[texture]);
 return <sprite position={position} scale={[height*texture.image.width/texture.image.height,height,1]} renderOrder={1000} onClick={e=>{e.stopPropagation();onSelect();}}><spriteMaterial map={texture} transparent depthTest={false} depthWrite={false}/></sprite>;
}

function Road({coordinates,width,ground,point,xray}:{coordinates:number[][];width:number;ground:(x:number,y:number)=>number;point:(x:number,y:number,z:number)=>[number,number,number];xray:boolean}){
 const geometry=useMemo(()=>{
  const vertices:number[]=[];
  for(let i=1;i<coordinates.length;i++){
   const a=coordinates[i-1],b=coordinates[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(!length)continue;
   const dx=-(b[1]-a[1])/length*width/2,dy=(b[0]-a[0])/length*width/2;
   const corners=[[a[0]+dx,a[1]+dy],[a[0]-dx,a[1]-dy],[b[0]+dx,b[1]+dy],[b[0]-dx,b[1]-dy]].map(p=>point(p[0],p[1],ground(p[0],p[1])+.08));
   for(const index of [0,1,2,1,3,2])vertices.push(...corners[index]);
  }
  const value=new THREE.BufferGeometry();value.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));value.computeVertexNormals();return value;
 },[coordinates,width,ground,point]);
 return <mesh geometry={geometry}><meshStandardMaterial color="#63727b" side={THREE.DoubleSide} transparent opacity={xray?.35:1} depthWrite={!xray}/></mesh>;
}

interface SceneProps {project:SiteProject;phase:number;xray:boolean;selected:string|null;onSelect:(id:string)=>void;frame?:SimulationFrame;pipeOption?:{asset_id:string;after:number}}
function Scene({project,phase,xray,selected,onSelect,frame,pipeOption}:SceneProps){
 const site=project.site,b=siteBounds(site);
 const point=useMemo(()=>(x:number,y:number,z:number):[number,number,number]=>[x-b.x,z-b.z,-(y-b.y)],[b]);
 const ground=useMemo(()=>(x:number,y:number)=>terrainHeight(site,x,y),[site]);
 const mesh=useMemo(()=>{
  if(!site.terrain.length)return null;
  const xs=[...new Set(site.terrain.map(p=>p.x))].sort((a,b)=>a-b),ys=[...new Set(site.terrain.map(p=>p.y))].sort((a,b)=>a-b);
  const lookup=new Map(site.terrain.map(p=>[`${p.x},${p.y}`,p.z]));
  const vertices:number[]=[];for(const y of ys)for(const x of xs)vertices.push(x-b.x,lookup.get(`${x},${y}`)!-b.z,-(y-b.y));
  const indices:number[]=[];for(let j=0;j<ys.length-1;j++)for(let i=0;i<xs.length-1;i++){const n=j*xs.length+i;indices.push(n,n+1,n+xs.length,n+1,n+xs.length+1,n+xs.length);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
 },[project.project_id]);
 const pick=(e:ThreeEvent<MouseEvent>,id:string)=>{e.stopPropagation();onSelect(id);};
 return <>
  <ambientLight intensity={1.2}/><directionalLight position={[60,140,30]} intensity={2}/><hemisphereLight args={['#e3f5ff','#809682',.8]}/>
  {phase>=1&&(mesh?<mesh geometry={mesh}><meshStandardMaterial color="#a7c0a7" side={THREE.DoubleSide} transparent opacity={xray?.38:1} depthWrite={!xray}/></mesh>:<mesh rotation={[-Math.PI/2,0,0]} position={[0,ground(b.x,b.y)-b.z,0]}><planeGeometry args={[b.span*1.15,b.span*1.15]}/><meshStandardMaterial color="#d8e1e6" transparent opacity={.5}/></mesh>)}
  {phase>=2&&site.roads.map((road,i)=><Road key={`road-${i}`} coordinates={road.geometry.coordinates as number[][]} width={road.properties.width_m!} ground={ground} point={point} xray={xray}/>)}
  {phase>=2&&site.buildings.map((building,i)=>{
   const ring=(building.geometry.coordinates as number[][][])[0];const shape=new THREE.Shape(ring.map(p=>new THREE.Vector2(p[0]-b.x,p[1]-b.y)));
   const x=ring.reduce((s,p)=>s+p[0],0)/ring.length,y=ring.reduce((s,p)=>s+p[1],0)/ring.length;
   return <mesh key={`building-${i}`} rotation={[-Math.PI/2,0,0]} position={[0,ground(x,y)-b.z,0]}><extrudeGeometry args={[shape,{depth:building.properties.height_m!,bevelEnabled:false}]}/><meshStandardMaterial color={i%2?'#e9dfcd':'#d8e5ec'} transparent opacity={xray?.5:1} side={THREE.DoubleSide}/></mesh>;
  })}
  {phase>=3&&site.pipes.map(pipe=>{
   const from=site.nodes.find(n=>n.node_id===pipe.from_node_id)!,to=site.nodes.find(n=>n.node_id===pipe.to_node_id)!;
   const state=frame?.pipe_states.find(p=>p.conduit_id===pipe.conduit_id);
   const displayedDiameter=pipeOption?.asset_id===pipe.conduit_id?pipeOption.after:pipe.diameter_m;
   const color=selected===pipe.conduit_id?'#e11d48':state?.status==='surcharged'?'#f04438':state?.status==='near_capacity'?'#e9a323':'#087d88';
   const a=point(from.x,from.y,from.invert_elevation_m??ground(from.x,from.y)),c=point(to.x,to.y,to.invert_elevation_m??ground(to.x,to.y));
   return <group key={pipe.conduit_id}><Line points={[a,c]} color={color} lineWidth={selected===pipe.conduit_id?6:3} dashed={displayedDiameter===null} dashSize={2} gapSize={1} onClick={e=>pick(e,pipe.conduit_id)}/>{selected===pipe.conduit_id&&<AssetLabel position={[(a[0]+c[0])/2,(a[1]+c[1])/2+2,(a[2]+c[2])/2]} text={`${pipe.conduit_id} · ${displayedDiameter===null?'diameter unknown':`${Math.round(displayedDiameter*1000)} mm`}${pipeOption?.asset_id===pipe.conduit_id?' option':''}`} selected height={b.span*.025} onSelect={()=>onSelect(pipe.conduit_id)}/>}</group>;
  })}
  {phase>=3&&site.nodes.map(n=>{
   const z=n.ground_elevation_m??ground(n.x,n.y),bottom=n.invert_elevation_m??z,height=Math.max(.1,z-bottom);
   const state=frame?.node_states.find(v=>v.node_id===n.node_id),water=Math.min(height+2,state?.depth_m??0);
   return <group key={n.node_id}>
    <mesh position={point(n.x,n.y,bottom+height/2)} onClick={e=>pick(e,n.node_id)}><cylinderGeometry args={[.8,.8,height,12]}/><meshStandardMaterial color={selected===n.node_id?'#ff4560':n.node_type==='outfall'?'#254c74':'#5b7485'} transparent opacity={.55}/></mesh>
    <mesh position={point(n.x,n.y,z+.15)} onClick={e=>pick(e,n.node_id)}><cylinderGeometry args={[1,1,.3,16]}/><meshStandardMaterial color={selected===n.node_id?'#f43f5e':'#f1f6f8'}/></mesh>
    {water>0&&<mesh position={point(n.x,n.y,bottom+water/2)}><cylinderGeometry args={[.61,.61,water,12]}/><meshStandardMaterial color={state?.status==='flooding'?'#f04438':'#258ddd'} transparent opacity={.85}/></mesh>}
    <AssetLabel position={point(n.x,n.y,z+2)} text={n.node_id} selected={selected===n.node_id} height={b.span*.025} onSelect={()=>onSelect(n.node_id)}/>
   </group>;
  })}
  {phase>=3&&site.inlets.map(n=><mesh key={n.inlet_id} position={point(n.x,n.y,(n.ground_elevation_m??ground(n.x,n.y))+.3)} onClick={e=>pick(e,n.inlet_id)}><boxGeometry args={[1.1,.2,1.1]}/><meshStandardMaterial color={selected===n.inlet_id?'#f43f5e':'#edb340'}/></mesh>)}
  <OrbitControls makeDefault target={[0,3,0]} minDistance={8} maxDistance={b.span*4}/>
 </>;
}

export function SiteScene(props:SceneProps){
 const b=siteBounds(props.project.site);
 return <Canvas key={props.project.project_id} camera={{position:[b.span*.55,b.span*.7,b.span*.8],fov:45,near:.1,far:b.span*20}} gl={{antialias:true,preserveDrawingBuffer:true}} dpr={[1,1.5]}><color attach="background" args={['#edf3f5']}/><Scene {...props}/></Canvas>;
}
