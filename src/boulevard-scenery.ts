import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {block,boulevardBatch,boulevardBeam,boulevardRandom,type BoulevardPart} from './boulevard-geometry';
import {buildingVectors,palmVectors,trunkVectors,horizonVectors} from './boulevard-vectors';
import {createBoulevardMaterials} from './boulevard-materials';
import {createBoulevardArch,archDrains} from './boulevard-arch';
import {drainSite,type DrainSite} from './boulevard-weather';
import {createBoulevardRoad} from './boulevard-road';
import {createBoulevardFacades,facadeInstances,type FacadePart} from './boulevard-facades';
import {addBoulevardVenue,venueMarqueeGeometry} from './boulevard-venues';
import {BOULEVARD_DECK,BOULEVARD_PITCH,BOULEVARD_RISE,boulevardScroll} from './boulevard';
const CYAN=0x4acddd,VIOLET=0xa259ef;
function organicLeaves(){
 const pieces:T.BufferGeometry[]=[];
 for(let n=0;n<9;n++){
  const p:number[]=[],uv:number[]=[];
  const vertex=(x:number,y:number,z:number,u:number,v:number)=>{p.push(x,y,z);uv.push(u,v);};
  const z=(t:number)=>Math.sin(t*Math.PI)*.34-t*t*.36;
  for(let i=0;i<14;i++)for(const side of[-1,1]){
   const t=.07+i*.064,reach=.12+.42*Math.sin(t*Math.PI),y=t*1.8,tip=y+.13;
   vertex(0,y,z(t),.5,t);vertex(side*reach*.45,y+.04,z(t)+.025,side<0?0:1,t);vertex(side*reach,tip,z(t)-.09,side<0?0:1,t+.02);
   vertex(0,y,z(t),.5,t);vertex(side*reach,tip,z(t)-.09,side<0?0:1,t+.02);vertex(side*reach*.43,y+.11,z(t)+.01,side<0?0:1,t+.03);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();g.rotateZ(n*Math.PI*2/9+.06*Math.sin(n*9));pieces.push(g);
 }
 const g=mergeGeometries(pieces);pieces.forEach(p=>p.dispose());return g;
}
function sunGeometry(){
 const pieces:T.BufferGeometry[]=[];
 for(let i=0;i<9;i++){
  const low=-5.2+i*1.15,high=low+.85,shape=new T.Shape();const half=(y:number)=>Math.sqrt(Math.max(0,5.4**2-y*y));
  shape.moveTo(-half(low),low);shape.lineTo(half(low),low);shape.lineTo(half(high),high);shape.lineTo(-half(high),high);shape.closePath();pieces.push(new T.ShapeGeometry(shape));
 }
 const g=mergeGeometries(pieces);pieces.forEach(p=>p.dispose());return g;
}
export function createBoulevardScenery(){
 const root=new T.Group();root.name='synthwave-boulevard';const world=new T.Group();root.add(world);world.scale.x=.78;
 const materials=createBoulevardMaterials(),facades=createBoulevardFacades(),drains:DrainSite[]=[];
 const masonry=new RoundedBoxGeometry(1,1,1,2,.08),box=new T.BoxGeometry(1,1,1),wireBox=buildingVectors(),cylinder=new T.CylinderGeometry(1,1,1,10).rotateX(Math.PI/2),leaves=organicLeaves(),wireLeaves=palmVectors(),wireTrunk=trunkVectors(),arch=createBoulevardArch(materials),marqueeGeometry=venueMarqueeGeometry(),wireSpire=buildingVectors(.51),spireBody=new T.CylinderGeometry(.36,Math.SQRT1_2,1,4,1,false,Math.PI/4).rotateX(Math.PI/2);
 const chunks:T.Group[]=[],tracks:{root:T.Group;y:number;direction:number}[]=[],traffic:{root:T.Group;y:number;lane:number;phase:number}[]=[];
 const poolWater=new T.ShaderMaterial({uniforms:{clock:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;vec4 p=vec4(position,1.);\n#ifdef USE_INSTANCING\np=instanceMatrix*p;\n#endif\ngl_Position=projectionMatrix*modelViewMatrix*p;}',fragmentShader:'uniform float clock;varying vec2 vUv;void main(){vec2 p=(vUv-.5)*2.;float wave=sin(p.x*17.+sin(p.y*9.+clock*.5))*cos(p.y*19.-clock*.7);float glint=pow(max(0.,wave),24.);vec3 c=vec3(.005,.075,.12)+vec3(.035,.18,.23)*glint;gl_FragColor=vec4(c,1.);\n#include <colorspace_fragment>\n}'});
 const glowMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,vertexShader:'varying vec2 vUv;varying vec3 vColor;void main(){vUv=uv;vColor=vec3(1.);vec4 p=vec4(position,1.);\n#ifdef USE_INSTANCING\np=instanceMatrix*p;\n#endif\n#ifdef USE_INSTANCING_COLOR\nvColor=instanceColor;\n#endif\ngl_Position=projectionMatrix*modelViewMatrix*p;}',fragmentShader:'varying vec2 vUv;varying vec3 vColor;void main(){float a=pow(max(0.,1.-length((vUv-.5)*2.)),2.);gl_FragColor=vec4(vColor,a*.28);}'});
 for(let index=0;index<22;index++){
  const chunk=new T.Group(),base=index*14-14,random=boulevardRandom(901+index*71);chunk.position.y=base;chunk.name='boulevard-bay-'+index;chunks.push(chunk);world.add(chunk);
  const solid:BoulevardPart[]=[],metal:BoulevardPart[]=[],pink:BoulevardPart[]=[],cyan:BoulevardPart[]=[],warm:BoulevardPart[]=[],wires:BoulevardPart[]=[],trunks:BoulevardPart[]=[],fronds:BoulevardPart[]=[],holo:BoulevardPart[]=[],holoTrunks:BoulevardPart[]=[],glows:BoulevardPart[]=[];
  const round:BoulevardPart[]=[],marquee:BoulevardPart[]=[],water:BoulevardPart[]=[],spires:BoulevardPart[]=[],facadeParts:FacadePart[]=[];
  const venues={solid,metal,pink,cyan,warm,round,marquee,water,facades:facadeParts},nightlife=index>=4,dense=index>=9;
  for(const side of[-1,1]){
   solid.push(block(side*4.5,7,BOULEVARD_DECK-.1,1.8,14,.3,0x615268));
   metal.push(block(side*3.65,7,BOULEVARD_DECK+.18,.06,14,.12));pink.push(block(side*3.67,7,BOULEVARD_DECK+.25,.025,14,.025));
   let roofLine=0;
   for(let by=0;by<3;by++){
    const y=1.6+by*4.6,w=2.5+random()*1.4,h=1.8+random()*1.0,x=side*(4.05+w/2),depth=3+random();
    addBoulevardVenue(venues,index,by,side,x,y,w,depth,h,BOULEVARD_DECK);
    roofLine=Math.max(roofLine,h+(nightlife?2.6:.62));
    if((index+by+(side>0?1:0))%3===2&&index%4===2&&by===1)drains.push(drainSite(side*3.54,base+y,BOULEVARD_DECK+h*.83-.05,index,index*3+(side>0?1:0)));
    if(nightlife){
     const wx=x+side*.35,tier=(index+by)%3;
     if(tier===0)spires.push(block(wx,y,BOULEVARD_DECK+h+1.0,w*.90,depth*.85,2.0,side<0?CYAN:VIOLET));
     else{
      wires.push(block(wx,y,BOULEVARD_DECK+h+.6,w*.85,depth*.85,1.2,by%2?CYAN:VIOLET));
      wires.push(block(wx,y+.1,BOULEVARD_DECK+h+1.5,w*.50,depth*.50,.6,by%2?CYAN:VIOLET));
      if(tier===2)cyan.push(block(wx,y+.1,BOULEVARD_DECK+h+2.15,.035,.035,.7));
     }
     if(dense)spires.push(block(side*(8.0+random()*2.5),y+1,BOULEVARD_DECK+3.5,w*.9,depth*.95,5+random()*4,side<0?0x542879:0x205668));
    }
   }
   for(let i=0;i<3;i++){
    const y=.4+i*4.5,x=side*(3.78+random()*.12),h=roofLine+1.0+random()*.45;
    trunks.push(block(x,y,BOULEVARD_DECK+h/2,.105,.105,h,0x806343));
    metal.push(block(x,y,BOULEVARD_DECK+.08,.42,.42,.16));warm.push(block(x-side*.17,y,BOULEVARD_DECK+.23,.045,.13,.18));
    const foliage=block(x,y,BOULEVARD_DECK+h,.85,.85,1,0x488e74,random()*6);
    if(i===index%3)holoTrunks.push(block(x,y,BOULEVARD_DECK,.105,.105,h,side<0?CYAN:VIOLET));
    (i===index%3?holo:fronds).push({...foliage,color:i===index%3?(side<0?CYAN:VIOLET):foliage.color});glows.push(block(x,y,BOULEVARD_DECK+.035,3.8,4.5,1,side<0?0x38c0df:0xed39ac));
   }
  }
  const add=(name:string,g:T.BufferGeometry,m:T.Material,parts:BoulevardPart[])=>{if(parts.length)chunk.add(boulevardBatch(name,g,m,parts));};
  add('boulevard-masonry',masonry,materials.stone,solid);add('boulevard-chrome',box,materials.chrome,metal);
  add('boulevard-rounded-corners',cylinder,materials.glass,round);add('boulevard-club-marquees',marqueeGeometry,materials.pink,marquee);chunk.add(facadeInstances(facadeParts,facades.material));
  add('boulevard-pink-fixtures',box,materials.pink,pink);add('boulevard-cyan-fixtures',box,materials.cyan,cyan);add('boulevard-warm-windows',box,materials.amber,warm);
  add('boulevard-building-backs',box,materials.backFaces,wires);add('boulevard-spire-backs',spireBody,materials.backFaces,spires);
  add('boulevard-holographic-buildings',wireBox,materials.wire,wires);add('boulevard-holographic-spires',wireSpire,materials.wire,spires);add('boulevard-rooftop-pools',new T.PlaneGeometry(1,1),poolWater,water);add('boulevard-palm-trunks',cylinder,materials.bark,trunks);add('boulevard-organic-palms',leaves,materials.leaf,fronds);add('boulevard-wire-palms',wireLeaves,materials.wire,holo);add('boulevard-vector-palm-trunks',wireTrunk,materials.wire,holoTrunks);add('boulevard-light-pools',new T.PlaneGeometry(1,1),glowMaterial,glows);
  if(index%3===1&&index<=7){const gateway=arch.root.clone(true);gateway.position.y=8;chunk.add(gateway);archDrains().forEach((p,i)=>drains.push(drainSite(p.x,base+8+p.y,p.z,index,index*5+i)));}
  if(index===5||index===10){
   const bridge=new T.Group();bridge.position.set(0,7,0);bridge.rotation.z=index%2?.25:-.25;chunk.add(bridge);
   for(const side of[-1,1]){const x=side*2.1,y=-.30,a=bridge.rotation.z;drains.push(drainSite(x*Math.cos(a)-y*Math.sin(a),base+7+x*Math.sin(a)+y*Math.cos(a),1.94,index,index*7+(side>0?1:0)));}
   const beams:BoulevardPart[]=[];for(let i=0;i<10;i++){const x=-7+i*1.5;beams.push(boulevardBeam(new T.Vector3(x,0,1.35),new T.Vector3(x+1.5,0,1.95),.045,CYAN));beams.push(boulevardBeam(new T.Vector3(x,0,1.95),new T.Vector3(x+1.5,0,1.35),.045,CYAN));}
   bridge.add(boulevardBatch('monorail-triangular-truss',box,materials.cyan,beams));
   bridge.add(boulevardBatch('monorail-supports',box,materials.chrome,[-1,1].map(s=>block(s*4.6,0,(1.95+BOULEVARD_DECK)/2,.22,.35,1.95-BOULEVARD_DECK))));
   const rail=new T.Mesh(new T.BoxGeometry(16,.55,.12),materials.chrome);rail.position.z=2;bridge.add(rail);const strip=new T.Mesh(new T.BoxGeometry(16,.035,.04),materials.pink);strip.position.set(0,-.3,2.02);bridge.add(strip);
   const train=new T.Group();for(let car=0;car<3;car++){const body=new T.Mesh(new T.BoxGeometry(1.5,.5,.55),materials.shell);body.position.set(car*1.65,0,2.35);train.add(body);const pane=new T.Mesh(new T.BoxGeometry(1.28,.52,.27),materials.amber);pane.position.set(car*1.65,0,2.4);train.add(pane);}
   bridge.add(train);tracks.push({root:train,y:base+7,direction:index%2?1:-1});
  }
 }
 const road=createBoulevardRoad(materials.roadMap,drains);world.add(road.root);
 // Low-poly horizon relief is a true mesh, not a backdrop plate.
 const hills=new T.PlaneGeometry(70,30,20,7),hp=hills.attributes.position;const random=boulevardRandom(552);
 for(let i=0;i<hp.count;i++){const x=hp.getX(i),y=hp.getY(i);hp.setXYZ(i,x,y,Math.max(0,Math.abs(x)-9)*.23+random()*4);}
 hills.computeVertexNormals();const horizon=new T.Mesh(horizonVectors(hills),materials.wire);horizon.name='boulevard-distant-mountains';horizon.scale.setScalar(2.2);world.add(horizon);hills.dispose();
 const sunRoot=new T.Group(),sun=new T.Mesh(sunGeometry(),materials.amber);sun.rotation.x=Math.PI/2;sunRoot.add(sun);world.add(sunRoot);
 const skyStars=new T.BufferGeometry(),positions:number[]=[];for(let i=0;i<350;i++)positions.push((random()-.5)*220,80+random()*100,-8+random()*70);skyStars.setAttribute('position',new T.Float32BufferAttribute(positions,3));const stars=new T.Points(skyStars,new T.PointsMaterial({color:0x69658d,size:.13}));world.add(stars);
 // Small ground traffic stays below combat altitude and flows through the resort.
 for(let i=0;i<8;i++){const car=new T.Group(),body=new T.Mesh(new T.BoxGeometry(.40,.82,.18),materials.shell);car.add(body);const light=new T.Mesh(new T.BoxGeometry(.33,.035,.05),materials.amber);light.position.set(0,-.41,.02);car.add(light);world.add(car);traffic.push({root:car,y:0,lane:i%2?1.3:-1.3,phase:i*13.7});}
 return{root,world,materials,road,facades,chunks,tracks,traffic,horizon,
  update(time:number,reveal:number,clock:number){const scroll=boulevardScroll(time),pitch=BOULEVARD_PITCH*reveal;poolWater.uniforms.clock.value=clock;world.rotation.x=-pitch;world.position.set(0,-scroll*Math.cos(pitch)-BOULEVARD_RISE*reveal*Math.sin(pitch),scroll*Math.sin(pitch)-BOULEVARD_RISE*reveal*Math.cos(pitch));road.update(scroll,clock,reveal);
   for(const[i,chunk]of chunks.entries()){const base=i*14-14;chunk.position.y=base+(i>=16&&time>100?Math.max(0,Math.floor((scroll-base+25)/84))*84:0);}
   for(const t of tracks)t.root.position.x=((clock*.8*t.direction+20)%28+28)%28-14;
   traffic.forEach(c=>{c.root.position.set(c.lane,scroll+((c.phase+clock*(c.lane>0?.8:-1.1))%48+48)%48-17,BOULEVARD_DECK+.22);c.root.rotation.z=c.lane>0?0:Math.PI;});
   horizon.position.set(0,scroll+180,-6.6);sunRoot.position.set(0,scroll+48,10);stars.position.y=scroll;
  },prime(active:boolean){road.prime(active);world.traverse(o=>{if(o instanceof T.Mesh)o.frustumCulled=!active;});road.rain.root.frustumCulled=false;},dispose(){road.dispose();}};
}
