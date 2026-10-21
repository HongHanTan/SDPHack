import { useEffect, useMemo } from 'react';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { DATUM, GRID } from '@floodops/engine/scenario/config';
import { visualGround } from '../engine/visualGround';
import type { RoadStudy } from './roadStudy';

export function RoadStudyOverlay({study}:{study:RoadStudy}) {
  const geometry=useMemo(()=>{
    const vertices:number[]=[];const half=study.cellSizeM*0.46;
    for(const cell of study.cells){const x=DATUM.x0+(cell%GRID.nx+0.5)*GRID.dx,y=DATUM.y0+(Math.floor(cell/GRID.nx)+0.5)*GRID.dx;
      for(const [dx,dy] of [[-half,-half],[half,-half],[half,half],[-half,-half],[half,half],[-half,half]])vertices.push(x+dx,visualGround(x+dx,y+dy)+0.05,-y-dy);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();return g;
  },[study]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  const {x,y}=study.point;const ground=visualGround(x,y);
  return <group><mesh geometry={geometry} renderOrder={8}><meshBasicMaterial color="#13a69b" transparent opacity={0.24} depthTest={false} depthWrite={false} side={THREE.DoubleSide}/></mesh><mesh position={[x,ground+0.12,-y]} rotation={[-Math.PI/2,0,0]} renderOrder={10}><ringGeometry args={[0.8,1.25,24]}/><meshBasicMaterial color="#e1a622" depthTest={false}/></mesh><Text position={[x,ground+2.5,-y]} fontSize={0.9} color="#94651d" anchorY="bottom">ROAD POINT R1</Text></group>;
}
