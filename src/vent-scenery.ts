import * as T from 'three';
import {createVentFormations,ventTierTint,type VentFormation} from './vent-formations';
import {createVentGeology} from './vent-geology';
import {createVentAtlas,ventCardGeometry,ventCardRelief} from './vent-atlas';
import {loadEncounterTexture} from './encounter-texture';
import {ioNoise} from './io-layout';
import {VENT_PITCH,VENT_STAGE_PITCH,ventFrame,ventWorld,ventFarFloor,ventBossPose} from './vent-layout';

function random(seed:number){return()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};}
export function createVentScenery(){
 const root=new T.Group();root.name='hydrothermal-vents';root.visible=false;
 const world=new T.Group();root.add(world);world.add(createVentGeology());
 const atlas=createVentAtlas(),material=new T.MeshBasicMaterial({map:atlas,alphaTest:.15,side:T.DoubleSide});
 const ready=loadEncounterTexture('ventAtlas',texture=>{texture.anisotropy=4;material.map=texture;material.needsUpdate=true;});
 const rng=random(52391),formations=createVentFormations(),batches=Array.from({length:8},()=>[] as VentFormation[]),emitters:{x:number;y:number;z:number;pale:boolean}[]=[];
 const matrix=new T.Matrix4(),p=new T.Vector3(),q=new T.Quaternion(),scale=new T.Vector3();
 for(const f of formations){
  batches[f.cell].push(f);
  if(f.cell===2||f.cell===3)emitters.push({x:f.x,y:f.y+f.h*.27-ventCardRelief(f.cell,.77)*f.h/7.5*Math.tan(VENT_STAGE_PITCH),z:f.z+ventCardRelief(f.cell,.77)*f.h/7.5+.1,pale:f.cell===3});
  if(f.front&&(f.cell===5||f.cell===7))emitters.push({x:f.x-(f.cell===7?f.w*.07:0),y:f.y-.1,z:f.z+f.h*.375,pale:f.x>0});
 }
 for(let cell=0;cell<8;cell++){
  const mesh=new T.InstancedMesh(ventCardGeometry(cell),material,batches[cell].length);mesh.name=`vent-raster-layer-${cell}`;mesh.frustumCulled=false;
  batches[cell].forEach((f,i)=>{
   p.set(f.x,f.y,f.z);q.setFromEuler(new T.Euler(f.front?Math.PI/2:0,0,f.angle));scale.set(f.w,f.h,f.cell===2||f.cell===3?f.h/7.5:1);matrix.compose(p,q,scale);mesh.setMatrixAt(i,matrix);
   const tint=ventTierTint[f.tier];mesh.setColorAt(i,new T.Color().setRGB(tint[0],tint[1],tint[2]));
  });world.add(mesh);
 }
 const n=64,data=new Uint8Array(n*n*4);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const radius=Math.hypot((x+.5)/n*2-1,(y+.5)/n*2-1),a=Math.max(0,1-radius)**1.2*(.55+ioNoise(x/7+10,y/7+20)*.45);data.set([255,255,255,a*255],(y*n+x)*4);}
 const mask=new T.DataTexture(data,n,n);mask.generateMipmaps=true;mask.minFilter=T.LinearMipmapLinearFilter;mask.magFilter=T.LinearFilter;mask.needsUpdate=true;
 const cloudGeometry=new T.PlaneGeometry(1,1),count=emitters.length*10;
 const alpha=new T.InstancedBufferAttribute(new Float32Array(count),1),tint=new T.InstancedBufferAttribute(new Float32Array(count*3),3);cloudGeometry.setAttribute('opacity',alpha);cloudGeometry.setAttribute('tint',tint);
 const cloudMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{map:{value:mask}},
  vertexShader:`attribute float opacity;attribute vec3 tint;varying vec2 vUv;varying vec4 shade;void main(){vUv=uv;shade=vec4(tint,opacity);vec4 p=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);p.xy+=position.xy*vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));gl_Position=projectionMatrix*p;}`,
  fragmentShader:`uniform sampler2D map;varying vec2 vUv;varying vec4 shade;void main(){gl_FragColor=vec4(shade.rgb,texture2D(map,vUv).a*shade.a);#include <colorspace_fragment>}`.replace(';#include',';\n#include')});
 const clouds=new T.InstancedMesh(cloudGeometry,cloudMaterial,count);clouds.name='vent-mineral-plumes';clouds.frustumCulled=false;world.add(clouds);
 const motesGeometry=new T.BufferGeometry(),motes:number[]=[];
 for(let i=0;i<600;i++)motes.push((rng()-.5)*23,-15+rng()*202,-1+rng()*11);
 motesGeometry.setAttribute('position',new T.Float32BufferAttribute(motes,3));
 const moteMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{clock:{value:0}},vertexShader:`uniform float clock;void main(){vec3 p=position;p.x+=sin(clock*.18+position.y)*.12;p.z+=sin(clock*.1+position.x)*.12;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=1.6;}`,fragmentShader:`void main(){float r=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(.45,.67,.69,(1.-smoothstep(.2,1.,r))*.18);}`});
 const particles=new T.Points(motesGeometry,moteMaterial);particles.name='suspended-vent-particles';world.add(particles);
 const feet=Array.from({length:6},(_,i)=>{const x=(i%2?1:-1)*(4.5+Math.floor(i/2)*.25),y=170+Math.floor(i/2)*1.25;return new T.Vector3(x,y,ventFarFloor(x,y));});
 // Foot shelves use the continuous back-rim mesh.
 const a=new T.Vector3(),b=new T.Vector3(),bossPoint=new T.Vector3(),xAxis=new T.Vector3(1,0,0),direction=new T.Vector3(),up=new T.Vector3(0,1,0),legMaterial=new T.MeshStandardMaterial({color:0x467a80,roughness:.75});
 const legs=feet.map(()=>{const mesh=new T.Mesh(new T.CylinderGeometry(.10,.15,1,7),legMaterial);world.add(mesh);return mesh;});
 function update(time:number,rise:number,alive=true){
  const frame=ventFrame(time,rise),origin=ventWorld(0,0,0,time,rise);world.rotation.x=-frame.pitch;world.position.set(origin.x,origin.y,origin.z);moteMaterial.uniforms.clock.value=time;
  for(let i=0;i<count;i++){
   const e=emitters[Math.floor(i/10)],t=(time*.10+(i%10)/10+Math.floor(i/10)*.37)%1;
   p.set(e.x+Math.sin(i*2.4+t*3)*t*.65,e.y+t*.45,e.z+t*5.5);q.identity();scale.set(1+t*2.4,1.2+t*2.7,1);matrix.compose(p,q,scale);clouds.setMatrixAt(i,matrix);alpha.setX(i,Math.sin(t*Math.PI)*(e.pale?.19:.4));tint.setXYZ(i,e.pale?.38:.035,e.pale?.50:.065,e.pale?.51:.08);
  }
  clouds.instanceMatrix.needsUpdate=true;alpha.needsUpdate=true;
  const pose=ventBossPose(rise);bossPoint.set(pose.x,pose.y,pose.z);
  feet.forEach((foot,i)=>{
   legs[i].visible=alive;const side=i%2?1:-1,row=Math.floor(i/2);a.set(side*2.1,-.8,-row*.5).applyAxisAngle(xAxis,VENT_PITCH).add(bossPoint);
   b.copy(foot);b.x+=pose.x*(1-rise);b.z-=7*(1-rise);const step=Math.sin(rise*Math.PI*8+i*Math.PI);b.z+=Math.max(0,step)*.55*Math.sin(rise*Math.PI);b.y+=step*.3*Math.sin(rise*Math.PI);direction.copy(b).sub(a);legs[i].position.copy(a).add(b).multiplyScalar(.5);legs[i].quaternion.setFromUnitVectors(up,direction.normalize());legs[i].scale.y=a.distanceTo(b);
  });
 }
 update(0,0);
 return{root,world,ready,update,frame:ventFrame,bossPose:ventBossPose};
}
