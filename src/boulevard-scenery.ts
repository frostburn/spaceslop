import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {block,boulevardBatch,boulevardBeam,boulevardRandom,type BoulevardPart} from './boulevard-geometry';
import {buildingVectors,palmVectors,trunkVectors} from './boulevard-vectors';
import {createBoulevardCityLights} from './boulevard-city-lights';
import {createBoulevardMountains} from './boulevard-mountains';
import {createBoulevardTraffic} from './boulevard-traffic';
import {createBoulevardSun} from './boulevard-sun';
import {createBoulevardPalmLighting} from './boulevard-palms';
import {createBoulevardWaterfalls,WATERFALL_BAYS} from './boulevard-waterfalls';
import {createBoulevardMaterials} from './boulevard-materials';
import {createBoulevardArch,archDrains} from './boulevard-arch';
import {drainSite,type DrainSite} from './boulevard-weather';
import {createBoulevardRoad} from './boulevard-road';
import {createBoulevardFountain,FOUNTAIN_Y} from './boulevard-fountain';
import {CROSSING_BAY,CROSSING_WIDTH,CROSSING_REACH,LAMP_OFFSETS,LAMP_X,LAMP_REACH} from './boulevard-layout';
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
export function createBoulevardScenery(){
 const root=new T.Group();root.name='synthwave-boulevard';const world=new T.Group();root.add(world);world.scale.x=.78;
 const materials=createBoulevardMaterials(),city=createBoulevardCityLights(materials),cityMaterials={...materials,...city},drains:DrainSite[]=[];
 const palmLighting=createBoulevardPalmLighting(materials),waterfalls=createBoulevardWaterfalls(cityMaterials);
 const masonry=new RoundedBoxGeometry(1,1,1,2,.08),box=new T.BoxGeometry(1,1,1),wireBox=buildingVectors(),cylinder=new T.CylinderGeometry(1,1,1,10).rotateX(Math.PI/2),leaves=organicLeaves(),wireLeaves=palmVectors(),wireTrunk=trunkVectors(),arch=createBoulevardArch(cityMaterials),marqueeGeometry=venueMarqueeGeometry(),wireSpire=buildingVectors(.51),spireBody=new T.CylinderGeometry(.36,Math.SQRT1_2,1,4,1,false,Math.PI/4).rotateX(Math.PI/2);
 const chunks:T.Group[]=[],tracks:{root:T.Group;y:number;direction:number}[]=[];
 const poolWater=new T.ShaderMaterial({uniforms:{clock:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;vec4 p=vec4(position,1.);\n#ifdef USE_INSTANCING\np=instanceMatrix*p;\n#endif\ngl_Position=projectionMatrix*modelViewMatrix*p;}',fragmentShader:'uniform float clock;varying vec2 vUv;void main(){vec2 p=(vUv-.5)*2.;float wave=sin(p.x*17.+sin(p.y*9.+clock*.5))*cos(p.y*19.-clock*.7);float glint=pow(max(0.,wave),24.);vec3 c=vec3(.005,.075,.12)+vec3(.035,.18,.23)*glint;gl_FragColor=vec4(c,1.);\n#include <colorspace_fragment>\n}'});
 const glowSource=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,vertexShader:'varying vec2 vUv;varying vec3 vColor;void main(){vUv=uv;vColor=vec3(1.);vec4 p=vec4(position,1.);\n#ifdef USE_INSTANCING\np=instanceMatrix*p;\n#endif\n#ifdef USE_INSTANCING_COLOR\nvColor=instanceColor;\n#endif\ngl_Position=projectionMatrix*modelViewMatrix*p;}',fragmentShader:'varying vec2 vUv;varying vec3 vColor;void main(){float a=pow(max(0.,1.-length((vUv-.5)*2.)),2.);gl_FragColor=vec4(vColor,a*.28);\n#include <colorspace_fragment>\n}'});
 const glowMaterial=city.emission(glowSource,.86,.85);glowSource.dispose();
 for(let index=0;index<22;index++){
  const chunk=new T.Group(),base=index*14-14,random=boulevardRandom(901+index*71);chunk.position.y=base;chunk.name='boulevard-bay-'+index;chunks.push(chunk);world.add(chunk);
  const solid:BoulevardPart[]=[],metal:BoulevardPart[]=[],pink:BoulevardPart[]=[],cyan:BoulevardPart[]=[],warm:BoulevardPart[]=[],wires:BoulevardPart[]=[],trunks:BoulevardPart[]=[],fronds:BoulevardPart[]=[],holo:BoulevardPart[]=[],holoTrunks:BoulevardPart[]=[],glows:BoulevardPart[]=[],uplights:BoulevardPart[]=[];
  const hasWaterfall=(WATERFALL_BAYS as readonly number[]).includes(index);
  const round:BoulevardPart[]=[],marquee:BoulevardPart[]=[],water:BoulevardPart[]=[],spires:BoulevardPart[]=[],lamps:BoulevardPart[]=[],windows:BoulevardPart[]=[],rooms:BoulevardPart[]=[],columns:BoulevardPart[]=[];
  const venues={solid,metal,pink,cyan,warm,round,marquee,water,windows,rooms,columns},nightlife=index>=4,dense=index>=9;
  for(const side of[-1,1]){
   const crossing=index===CROSSING_BAY;
   const walks=crossing?[[2.1,4.2],[11.9,4.2]]:[[7,14]];
   for(const[y,length]of walks){solid.push(block(side*4.5,y,BOULEVARD_DECK-.1,1.8,length,.3,0x615268));metal.push(block(side*3.65,y,BOULEVARD_DECK+.18,.06,length,.12));pink.push(block(side*3.67,y,BOULEVARD_DECK+.25,.025,length,.025));}
   if(crossing)for(const end of[-1,1]){
    solid.push(block(side*(CROSSING_REACH+3.6)/2,7+end*(CROSSING_WIDTH/2+.45),BOULEVARD_DECK-.1,CROSSING_REACH-3.6,.8,.3,0x615268));
    metal.push(block(side*(CROSSING_REACH+3.6)/2,7+end*(CROSSING_WIDTH/2+.08),BOULEVARD_DECK+.18,CROSSING_REACH-3.6,.06,.12));
    pink.push(block(side*(CROSSING_REACH+3.6)/2,7+end*(CROSSING_WIDTH/2+.06),BOULEVARD_DECK+.25,CROSSING_REACH-3.6,.025,.025));
   }
   let roofLine=0;
   for(let by=0;by<3;by++){
    // Pocket courts, a fountain plaza and staggered setbacks keep the route straight
    // while changing the silhouette and distance to the street.
    if(by===1&&(hasWaterfall||index===5||index===6||index===10||index%7===3))continue;
    const y=crossing?(by===0?1.5:12.2):1.6+by*4.6,w=2.4+random()*2.1,h=1.6+random()*1.8,depth=crossing?2.5:2.5+random()*1.4;
    const street=4.15+(index===5?1.2:((index+by)%4===0?.9:random()*.35)),x=side*(street+w/2);
    addBoulevardVenue(venues,index,by,side,x,y,w,depth,h,BOULEVARD_DECK);
    roofLine=Math.max(roofLine,h+(nightlife?2.6:.62));
    if((index+by+(side>0?1:0))%3===2&&index%4===2&&by===1&&street-.51<3.6)drains.push(drainSite(side*(street-.51),base+y,BOULEVARD_DECK+h*.83-.05,index,index*3+(side>0?1:0)));
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
    if(crossing&&i===1)continue;
    const y=crossing&&i===2?10.1:.4+i*4.5,x=side*(3.78+random()*.12),h=roofLine+1.0+random()*.45;
    trunks.push(block(x,y,BOULEVARD_DECK+h/2,.105,.105,h,0x806343));
    metal.push(block(x,y,BOULEVARD_DECK+.08,.42,.42,.16));warm.push(block(x-side*.17,y,BOULEVARD_DECK+.23,.045,.13,.18));
    uplights.push(block(x-side*.17,y,BOULEVARD_DECK+.34,.045,.055,.025));
    const foliage=block(x,y,BOULEVARD_DECK+h,.85,.85,1,0x488e74,random()*6);
    if(i===index%3)holoTrunks.push(block(x,y,BOULEVARD_DECK,.105,.105,h,side<0?CYAN:VIOLET));
    (i===index%3?holo:fronds).push({...foliage,color:i===index%3?(side<0?CYAN:VIOLET):foliage.color});glows.push(block(x,y,BOULEVARD_DECK+.035,3.8,4.5,1,side<0?0x38c0df:0xed39ac));
   }
   for(const y of LAMP_OFFSETS){
    // Downward-facing luminous cores remain visible to the reflection camera.
    metal.push(block(side*LAMP_X,y,BOULEVARD_DECK+1.22,.07,.07,2.44));
    metal.push(block(side*(LAMP_X+LAMP_REACH)/2,y,BOULEVARD_DECK+2.44,LAMP_X-LAMP_REACH+.13,.09,.10));
    metal.push(block(side*LAMP_REACH,y,BOULEVARD_DECK+2.41,.65,.29,.13));
    lamps.push(block(side*LAMP_REACH,y,BOULEVARD_DECK+2.333,.51,.21,.025));
   }
  }
  // A taller opposite-side lot must not swallow the lower promenade's crowns.
  const crownFloor=Math.max(...solid.map(p=>p.z+p.sz/2))+1.05;
  for(const p of[...fronds,...holo])p.z=Math.max(p.z,crownFloor);
  for(const p of trunks){p.sz=Math.max(p.sz,crownFloor-BOULEVARD_DECK);p.z=BOULEVARD_DECK+p.sz/2;}
  for(const p of holoTrunks)p.sz=Math.max(p.sz,crownFloor-BOULEVARD_DECK);
  const add=(name:string,g:T.BufferGeometry,m:T.Material,parts:BoulevardPart[])=>{if(parts.length)chunk.add(boulevardBatch(name,g,m,parts));};
  add('boulevard-masonry',masonry,city.stone,solid);add('boulevard-chrome',box,materials.chrome,metal);
  add('boulevard-rounded-corners',cylinder,materials.glass,round);add('boulevard-club-marquees',marqueeGeometry,city.pink,marquee);add('boulevard-recessed-glazing',box,materials.windows,windows);add('boulevard-room-interiors',box,city.interior,rooms);add('boulevard-portico-columns',cylinder,materials.chrome,columns);
  add('boulevard-pink-fixtures',box,city.pink,pink);add('boulevard-cyan-fixtures',box,city.cyan,cyan);add('boulevard-warm-windows',box,city.amber,warm);add('boulevard-street-lamps',box,city.streetLamp,lamps);
  add('boulevard-building-backs',box,materials.backFaces,wires);add('boulevard-spire-backs',spireBody,materials.backFaces,spires);
  add('boulevard-holographic-buildings',wireBox,city.wire,wires);add('boulevard-holographic-spires',wireSpire,city.wire,spires);add('boulevard-rooftop-pools',new T.PlaneGeometry(1,1),poolWater,water);add('boulevard-palm-trunks',cylinder,palmLighting.bark,trunks);add('boulevard-organic-palms',leaves,palmLighting.leaf,fronds);add('boulevard-wire-palms',wireLeaves,city.wire,holo);add('boulevard-vector-palm-trunks',wireTrunk,city.wire,holoTrunks);add('boulevard-light-pools',new T.PlaneGeometry(1,1),glowMaterial,glows);add('boulevard-palm-uplights',new T.SphereGeometry(1,6,4),palmLighting.fixtures,uplights);
  if(hasWaterfall)for(const side of[-1,1])chunk.add(waterfalls.create(index,side));
  if(index%3===1&&index<=7){const gateway=arch.root.clone(true);gateway.position.y=8;chunk.add(gateway);archDrains().forEach((p,i)=>drains.push(drainSite(p.x,base+8+p.y,p.z,index,index*5+i)));}
  if(index===6||index===10){
   const bridge=new T.Group();bridge.position.set(0,7,0);bridge.rotation.z=index%2?.25:-.25;chunk.add(bridge);
   for(const side of[-1,1]){const x=side*2.1,y=-.30,a=bridge.rotation.z;drains.push(drainSite(x*Math.cos(a)-y*Math.sin(a),base+7+x*Math.sin(a)+y*Math.cos(a),1.94,index,index*7+(side>0?1:0)));}
   const beams:BoulevardPart[]=[];for(let i=0;i<10;i++){const x=-7+i*1.5;beams.push(boulevardBeam(new T.Vector3(x,0,1.35),new T.Vector3(x+1.5,0,1.95),.045,CYAN));beams.push(boulevardBeam(new T.Vector3(x,0,1.95),new T.Vector3(x+1.5,0,1.35),.045,CYAN));}
   bridge.add(boulevardBatch('monorail-triangular-truss',box,city.cyan,beams));
   bridge.add(boulevardBatch('monorail-supports',box,materials.chrome,[-1,1].map(s=>block(s*4.6,0,(1.95+BOULEVARD_DECK)/2,.22,.35,1.95-BOULEVARD_DECK))));
   const rail=new T.Mesh(new T.BoxGeometry(16,.55,.12),materials.chrome);rail.position.z=2;bridge.add(rail);const strip=new T.Mesh(new T.BoxGeometry(16,.035,.04),materials.pink);strip.position.set(0,-.3,2.02);bridge.add(strip);
   const train=new T.Group();for(let car=0;car<3;car++){const body=new T.Mesh(new T.BoxGeometry(1.5,.5,.55),materials.shell);body.position.set(car*1.65,0,2.35);train.add(body);const pane=new T.Mesh(new T.BoxGeometry(1.28,.52,.27),materials.amber);pane.position.set(car*1.65,0,2.4);train.add(pane);}
   bridge.add(train);tracks.push({root:train,y:base+7,direction:index%2?1:-1});
  }
 }
 const road=createBoulevardRoad(materials.roadMap,drains),fountain=createBoulevardFountain(cityMaterials);world.add(road.root,fountain.root);fountain.root.position.set(0,FOUNTAIN_Y,BOULEVARD_DECK);
 const ridge=createBoulevardMountains(materials.wire),horizon=ridge.root,mountains=ridge.body;world.add(horizon);
 const random=boulevardRandom(552);
 const sun=createBoulevardSun(),sunRoot=sun.root;sunRoot.scale.setScalar(5);world.add(sunRoot);
 const skyStars=new T.BufferGeometry(),positions:number[]=[];for(let i=0;i<350;i++)positions.push((random()-.5)*220,80+random()*100,-8+random()*70);skyStars.setAttribute('position',new T.Float32BufferAttribute(positions,3));const stars=new T.Points(skyStars,new T.PointsMaterial({color:0x69658d,size:.13,depthWrite:false}));stars.name='boulevard-stars';stars.renderOrder=-10;world.add(stars);
 const streetTraffic=createBoulevardTraffic(materials),traffic=streetTraffic.cars;world.add(streetTraffic.root);
 return{root,world,materials,road,fountain,chunks,tracks,traffic,streetTraffic,horizon,mountains,crest:ridge.crest,sunRoot,sun,city,palmLighting,waterfalls,
  update(time:number,reveal:number,clock:number){const scroll=boulevardScroll(time),pitch=BOULEVARD_PITCH*reveal;poolWater.uniforms.clock.value=clock;city.update(clock);sun.update(clock);waterfalls.update(clock);world.rotation.x=-pitch;world.position.set(0,-scroll*Math.cos(pitch)-BOULEVARD_RISE*reveal*Math.sin(pitch),scroll*Math.sin(pitch)-BOULEVARD_RISE*reveal*Math.cos(pitch));road.update(scroll,clock,reveal);fountain.update(clock);
   for(const[i,chunk]of chunks.entries()){const base=i*14-14;chunk.position.y=base+(i>=16&&time>100?Math.max(0,Math.floor((scroll-base+25)/84))*84:0);}
   for(const t of tracks)t.root.position.x=((clock*.8*t.direction+20)%28+28)%28-14;
   streetTraffic.update(scroll,clock);
   horizon.position.set(0,scroll+180,-6.6);sunRoot.position.set(0,scroll+325,2.8);stars.position.y=scroll;
  },prime(active:boolean){road.prime(active);world.traverse(o=>{if(o instanceof T.Mesh)o.frustumCulled=!active;});road.rain.root.frustumCulled=false;fountain.drops.frustumCulled=false;streetTraffic.prime(active);},dispose(){road.dispose();}};
}
