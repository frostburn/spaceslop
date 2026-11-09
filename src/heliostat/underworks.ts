import * as T from 'three';
import {heliostatBatch} from './geometry';
import type {HeliostatMaterials} from './materials';
import {heliostatScroll} from './combat';
import {starConduit} from './thermal';

function serviceIsland(m:HeliostatMaterials,kind:number){
  const root=new T.Group(),b=heliostatBatch(root),side=kind%2?1:-1,x=side*5.4,z=-19;
  const deck=new T.LatheGeometry([new T.Vector2(3.2,-.2),new T.Vector2(4.65,-.2),new T.Vector2(4.65,0),new T.Vector2(3.2,0),new T.Vector2(3.2,-.2)],64).rotateX(Math.PI/2);
  b.add(deck,m.dark,[x,0,z-.18],undefined,true);
  // Open annular catwalks retain views of the planet between their structures.
  for(const zz of[z,z-.65])for(const r of[3.2,4.65])b.ring(r,.11,[x,0,zz],m.titanium,[0,0,0]);
  for(let i=0;i<20;i++){
    const a=i*Math.PI/10,c=Math.cos(a),s=Math.sin(a);
    b.rod([x+c*3.2,s*3.2,z],[x+c*4.65,s*4.65,z],.13,m.dark,8);
    b.rod([x+c*4.65,s*4.65,z-.65],[x+Math.cos(a+.3)*4.65,Math.sin(a+.3)*4.65,z],.045,m.titanium,6);
    if(i%2===0)b.box([.22,.26,.1],[x+c*4.2,s*4.2,z+.16],i%4?m.cyan:m.amber,.02,[0,0,a]);
  }
  // A substantial generator pier, with copper windings and ceramic shoulders.
  b.rod([x,0,z-.6],[x,0,z+3],1.1,m.dark,16);
  for(let i=0;i<12;i++)b.ring(1.18,.065,[x,0,z+.2+i*.24],m.hotCoil,[0,0,0],28);
  for(const zz of[z+.2,z+3.1])b.rod([x,0,zz-.16],[x,0,zz+.16],1.45,m.titanium,20);
  for(const dx of[-1.5,1.5])b.box([.45,1.1,2.5],[x+dx,0,z+1.6],m.ceramic,.08);
  b.rod([x,0,z+3.2],[x,0,z+7.4],.16,m.titanium,10);
  b.add(new T.SphereGeometry(.15,10,8),m.amber,[x,0,z+7.5]);
  for(const y of[-5.8,5.8]){
    for(const zz of[z-.4,z+.5])b.rod([-14,y,zz],[14,y,zz],.12,m.dark,8);
    for(let j=-13;j<13;j+=2)b.rod([j,y,z-.4],[j+2,y,z+.5],.045,m.titanium,6);
    for(const xx of[-14,14])b.rod([xx,y,z-.4],[xx,y,z+.5],.08,m.titanium,6);
  }
  for(const side of[-1,1]){
    const tx=side*8.8;
    b.rod([tx,-9,z-3],[tx,9,z-3],.38,m.graphite,12);
    starConduit(b,m,[[tx,side*14,z+1],[tx,0,z+1],[tx,-side*14,z+1]],.36,false);
    starConduit(b,m,[[tx,side*5,z+1],[tx,side*6.8,z+1.5],[x,side*6.8,z+1.5],[x,side*1.05,z+1.5]],.25);
    for(const y of[-6,-3,0,3,6])b.ring(.47,.07,[tx,y,z-3],m.titanium);
    b.box([4.8,9,.3],[side*12,1,z-1],m.dark,.05,[0,side*.3,0]);
    for(let j=0;j<15;j++)b.box([4.5,.12,.48],[side*12,-3+j*.57,z-.8],m.graphite);
  }
  if(kind===2){
    for(const dx of[-2,2]){
      b.rod([dx,8,z-.6],[dx,12,z-.6],.65,m.blue,16);
      b.pipe([[dx,7.8,z-.6],[dx,6,z+1.1],[x,4,z+1.1],[x,1,z+1.1]],.12,m.copper);
    }
  }
  b.finish();return root;
}

/** Deep platforms and transfer bridges extend beneath the entire route. */
export function createUnderworks(m:HeliostatMaterials){
  const root=new T.Group();root.name='heliostat-deep-service-network';
  const templates=Array.from({length:3},(_,i)=>serviceIsland(m,i));
  const islands=Array.from({length:15},(_,i)=>{const node=templates[i%3].clone(true),origin=i*28-14;node.position.y=origin;root.add(node);return{root:node,origin,kind:i%3};});
  return{root,islands,update(time:number){const scroll=heliostatScroll(time);for(const island of islands){const y=island.origin-scroll;island.root.visible=y>-45&&y<65;}},
    prepare(offset:number){
      const parentVisible=root.visible;root.visible=true;
      const state=islands.map(i=>({y:i.root.position.y,visible:i.root.visible})),seen=new Set<number>();
      for(const island of islands){island.root.visible=!seen.has(island.kind);seen.add(island.kind);if(island.root.visible)island.root.position.y=offset;}
      return()=>{root.visible=parentVisible;islands.forEach((island,i)=>{island.root.position.y=state[i].y;island.root.visible=state[i].visible;});};
    }};
}
