import * as T from 'three';
import {createVentGeology} from './vent-geology';
import {createVentAtlas,ventCardGeometry} from './vent-atlas';
import {loadEncounterTexture} from './encounter-texture';
import {ioNoise} from './io-layout';
import {VENT_DURATION,VENT_APPROACH,VENT_PITCH,ventFrame,ventWorld,ventFloor,ventCliffEdge,ventFarEdge,ventFarFloor,ventBossPose,ventAnchors} from './vent-layout';

function random(seed:number){return()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};}
export function createVentScenery(){
 const root=new T.Group();root.name='hydrothermal-vents';root.visible=false;
 const world=new T.Group();root.add(world);world.add(createVentGeology());
 const atlas=createVentAtlas(),material=new T.MeshBasicMaterial({map:atlas,alphaTest:.15,side:T.DoubleSide});
 const ready=loadEncounterTexture('ventAtlas',texture=>{texture.anisotropy=4;material.map=texture;material.needsUpdate=true;});
 const rng=random(52391),batches=Array.from({length:8},()=>[] as T.Matrix4[]),emitters:{x:number;y:number;z:number;pale:boolean}[]=[];
 const matrix=new T.Matrix4(),p=new T.Vector3(),q=new T.Quaternion(),scale=new T.Vector3(),axis=new T.Vector3(0,0,1);
 function card(cell:number,x:number,y:number,z:number,w:number,h:number,front=false,angle=0){
  p.set(x,y,z);q.setFromEuler(new T.Euler(front?Math.PI/2:0,0,angle));scale.set(w,h,1);matrix.compose(p,q,scale);batches[cell].push(matrix.clone());
 }
 for(let y=-12,index=0;y<150;y+=5.2,index++)for(const side of [-1,1]){
  const variant=index+(side>0?1:0),x=side*(4.8+rng()*1.1),vent=variant%3===1,cell=vent?(variant%2?2:3):variant%2;
  const w=4.5+rng()*1.5,h=6.5+rng()*2.2,z=ventFloor(x,y)+.09;
  card(cell,x,y,z,w,h,false,(rng()-.5)*.25);
  if(vent)emitters.push({x,y:y+h*.27,z:z+.1,pale:cell===3});
  card(index%2===0?0:1,side*(9+rng()*4),y+1,-3-rng()*2,7,10,false,rng()*.3);
 }
 for(const a of ventAnchors)card(1,a.x,a.y,1.0,2.3,3.3);
 // The back rim is world-fixed vertical artwork; its top edges become visible
 // as we face the abyss. Floor modules remain horizontal and pass below us.
 for(let x=-21,index=0;x<=21;x+=4.3,index++){
  const y=ventFarEdge(x)+2.5,z=3.5+rng()*2,cell=4+index%3,w=4.5+rng()*2.7,h=6+rng()*3.8;
  card(cell,x+(rng()-.5)*.8,y,z,w,h,true);
  if(cell===5)emitters.push({x,y:y-.1,z:z+h*.375,pale:x>0});
  const backX=x+(rng()-.5)*2,backY=y+6+rng()*3,backZ=6+rng()*2,backW=6+rng()*3,backH=10+rng()*6,back=index%3===0?5:7;
  card(back,backX,backY,backZ,backW,backH,true);
  emitters.push({x:backX-(back===7?backW*.07:0),y:backY-.1,z:backZ+backH*.36,pale:index%2===0});
 }
 const cards:T.InstancedMesh[]=[];
 for(let cell=0;cell<8;cell++){
  const mesh=new T.InstancedMesh(ventCardGeometry(cell),material,batches[cell].length);mesh.name=`vent-raster-layer-${cell}`;mesh.frustumCulled=false;
  batches[cell].forEach((m,i)=>{mesh.setMatrixAt(i,m);mesh.setColorAt(i,new T.Color().setRGB(cell>=4?.55:.76,cell>=4?.7:.9,cell>=4?.76:.95));});world.add(mesh);cards.push(mesh);
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
