import {createIoTerrain} from './io-terrain';
import {createIoIndustry,ioSites} from './io-industry';
import {createIoLava} from './io-lava';
import {createIoActivity} from './io-activity';
import {createIoShadowAnchor} from './io-shadow';
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ioRock,ioCrust,ioHot,ioWeather,ioRandom,poseIoEnvironment } from './io-materials';
import { createCaldera } from './io-rigs';
import { ioFrame,ioWorld,ioGroundHeight,ioChannel,IO_BOSS_Y,IO_BOSS_Z,IO_FOOT_DROP,IO_CALDERA_Y,IO_BREACH_Y,IO_APRON_Y } from './io-layout';

export function createIoScenery(){
  const root=new T.Group();root.name='io-caldera-world';root.visible=false;
  const world=new T.Group();root.add(world);
  const industry=createIoIndustry(),activity=createIoActivity(industry.vents,industry.burners);world.add(industry.root,activity.root);
  const sun=new T.DirectionalLight(0xffecd0,3.5);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=sun.shadow.camera.bottom=-22;sun.shadow.camera.right=sun.shadow.camera.top=22;
  sun.shadow.camera.near=.5;sun.shadow.camera.far=120;sun.shadow.bias=-.0004;sun.shadow.normalBias=.06;
  world.add(sun,sun.target);
  const anchorShadow=createIoShadowAnchor(sun,world);
  const lavaFill=new T.PointLight(0xff500f,95,45,2);lavaFill.position.set(0,IO_CALDERA_Y-2,-3.5);world.add(lavaFill);
  const boss=createCaldera();boss.root.position.set(0,IO_BOSS_Y,IO_BOSS_Z);boss.root.rotation.x=Math.PI/2;world.add(boss.root);
  world.add(createIoTerrain());
  const lavaFlow=createIoLava();
  const lava=new T.Mesh(new T.CircleGeometry(1,80).scale(16.8,18.8,1).translate(0,IO_CALDERA_Y,0),lavaFlow.material);
  lava.name='caldera-lava-lake';lava.position.z=-6.85;world.add(lava);
  const apron=new T.Mesh(new T.CircleGeometry(1,48).scale(4.5,7,1).translate(0,IO_APRON_Y,0),lavaFlow.material);apron.position.z=-6.85;apron.name='caldera-rim-spill';world.add(apron);
  const path:T.Vector2[]=[];
  for(let i=0;i<=48;i++){const x=-20+i*40/48;path.push(new T.Vector2(x,IO_BREACH_Y+x*.48+Math.sin(x*.8)*.45+2.1));}
  for(let i=48;i>=0;i--){const x=-20+i*40/48;path.push(new T.Vector2(x,IO_BREACH_Y+x*.48+Math.sin(x*.8)*.45-2.1));}
  const breach=new T.Mesh(new T.ShapeGeometry(new T.Shape(path)),lavaFlow.material);breach.position.z=-6.75;breach.name='molten-refinery-breach';world.add(breach);
  const rng=ioRandom(78266),matrix=new T.Matrix4(),position=new T.Vector3(),rotation=new T.Quaternion(),scale=new T.Vector3(),axis=new T.Vector3(0,0,1);
  function irregular(seed:number){
    const r=ioRandom(seed),segments=18,levels=[-.5,-.32,-.12,.14,.34,.47],vertices:number[]=[],uvs:number[]=[],indices:number[]=[];
    const profile=Array.from({length:segments},()=>.86+r()*.28);
    for(let j=0;j<levels.length;j++)for(let i=0;i<=segments;i++){
      if(i===segments){const start=j*(segments+1)*3;vertices.push(...vertices.slice(start,start+3));uvs.push(1,j/4);continue;}
      const k=i%segments,a=k/segments*Math.PI*2,ledge=[1.04,1.17,1.08,.93,1.0,.82][j],rad=profile[k]*ledge+(r()-.5)*.10;
      vertices.push(Math.cos(a)*rad,Math.sin(a)*rad,levels[j]+(r()-.5)*.05);uvs.push(i/segments,j/4);
    }
    for(let j=0;j<levels.length-1;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+segments+1;indices.push(a,a+1,b,a+1,b+1,b);}
    const top=vertices.length/3;vertices.push(0,0,.5);uvs.push(.5,.5);
    const bottom=vertices.length/3;vertices.push(0,0,-.5);uvs.push(.5,.5);
    for(let i=0;i<segments;i++){indices.push(top,(levels.length-1)*(segments+1)+i,(levels.length-1)*(segments+1)+i+1);indices.push(bottom,i+1,i);}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setIndex(indices);
    const geometry=g.toNonIndexed();g.dispose();geometry.computeVertexNormals();return ioWeather(geometry,seed);
  }
  // Inset Voronoi cells form unique fractured slabs instead of repeating a hexagon.
  const slabGeometries:T.BufferGeometry[]=[];
  for(const patch of [{rx:16.6,ry:18.6,y:IO_CALDERA_Y,apron:false},{rx:4.4,ry:6.9,y:IO_APRON_Y,apron:true}]){
    const seeds:T.Vector2[]=[];
    for(let iy=-5;iy<=5;iy++)for(let ix=-6;ix<=6;ix++){
      const x=ix*2.65+(iy%2)*1.30+(rng()-.5)*1.7,y=iy*3+(rng()-.5)*1.9;
      if(Math.hypot(x/patch.rx,y/patch.ry)<.99)seeds.push(new T.Vector2(x,y));
    }
    for(const [cell,seed] of seeds.entries()){
      if(cell%23===8)continue; // Exposed molten pockets interrupt the cooled plates.
      let polygon=Array.from({length:64},(_,i)=>new T.Vector2(Math.cos(i/64*Math.PI*2)*patch.rx,Math.sin(i/64*Math.PI*2)*patch.ry));
      for(const other of seeds){
        if(seed===other)continue;
        const normal=other.clone().sub(seed),limit=(other.lengthSq()-seed.lengthSq())*.5,clipped:T.Vector2[]=[];
        for(let i=0;i<polygon.length;i++){
          const a=polygon[i],b=polygon[(i+1)%polygon.length],da=a.dot(normal)-limit,db=b.dot(normal)-limit;
          if(da<=0)clipped.push(a);
          if((da<0)!==(db<0))clipped.push(a.clone().lerp(b,da/(da-db)));
        }
        polygon=clipped;if(!polygon.length)break;
      }
      if(patch.apron){
        const limit=IO_CALDERA_Y-18.6-patch.y,clipped:T.Vector2[]=[];
        for(let i=0;i<polygon.length;i++){
          const a=polygon[i],b=polygon[(i+1)%polygon.length],da=a.y-limit,db=b.y-limit;
          if(da<=0)clipped.push(a);
          if((da<0)!==(db<0))clipped.push(a.clone().lerp(b,da/(da-db)));
        }
        polygon=clipped;
      }
      if(polygon.length<3)continue;
      const edge:T.Vector2[]=[];
      for(let i=0;i<polygon.length;i++){
        const a=polygon[i].clone().sub(seed).multiplyScalar(.94).add(seed),b=polygon[(i+1)%polygon.length].clone().sub(seed).multiplyScalar(.94).add(seed);
        const steps=Math.max(1,Math.ceil(a.distanceTo(b)/.5));
        for(let j=0;j<steps;j++){const p=a.clone().lerp(b,j/steps),x=p.x,y=p.y;p.x+=Math.sin(y*2.4+x*.8)*.07;p.y+=Math.sin(x*2.1-y*.6)*.07;edge.push(p);}
      }
      const shape=new T.Shape(edge);
      const g=new T.ExtrudeGeometry(shape,{depth:.43+rng()*.13,bevelEnabled:true,bevelSize:.035,bevelThickness:.025,bevelSegments:1,steps:1});g.translate(0,patch.y,-6.80+rng()*.06);
      const pos=g.attributes.position,uv=g.attributes.uv;
      for(let i=0;i<pos.count;i++)uv.setXY(i,pos.getX(i)*.35,pos.getY(i)*.35);
      slabGeometries.push(ioWeather(g,Math.floor(rng()*10000)));
    }
  }
  const crustGeometry=mergeGeometries(slabGeometries),heat:number[]=[],cp=crustGeometry.attributes.position,cn=crustGeometry.attributes.normal;
  for(let i=0;i<cp.count;i++)heat.push(Math.abs(cn.getZ(i))<.7?Math.max(0,Math.min(1,(-6.34-cp.getZ(i))/.48)):0);
  crustGeometry.setAttribute('temperature',new T.Float32BufferAttribute(heat,1));
  const crust=new T.Mesh(crustGeometry,ioCrust);crust.name='broken-lava-crust';world.add(crust);slabGeometries.forEach(g=>g.dispose());

  const rocks=new T.InstancedMesh(irregular(18),ioRock,480);let count=0;
  function rock(x:number,y:number,z:number,sx:number,sy:number,sz:number){
    position.set(x,y,z);rotation.setFromAxisAngle(axis,rng()*6.28);scale.set(sx,sy,sz);matrix.compose(position,rotation,scale);rocks.setMatrixAt(count++,matrix);
  }
  for(let i=0;i<60;i++){
    const a=i/60*Math.PI*2,x=Math.cos(a)*17.8,y=IO_CALDERA_Y+Math.sin(a)*19.8;
    if(Math.abs(x)<5&&y<IO_CALDERA_Y-13)continue;
    rock(x,y,ioGroundHeight(x,y)+.4,1.5+rng()*1.9,1.6+rng()*1.5,1.5+rng()*2);
  }
  for(let i=0;i<160;i++){
    const side=i%2?-1:1,x=side*(5.5+rng()*18),y=-15+rng()*(IO_CALDERA_Y+45);
    if(Math.hypot(x/19,(y-IO_CALDERA_Y)/22)<1.1||ioSites.some(([sx,sy])=>Math.hypot(sx-Math.sign(sx)*.55+ioChannel(sy)-x,sy+1-y)<3.1))continue;
    rock(x,y,ioGroundHeight(x,y)+.2,.5+rng()*1.2,.7+rng()*1.2,.6+rng()*1.3);
  }
  for(let i=0;i<100;i++){
    const y=-12+rng()*(IO_CALDERA_Y-12),x=(i%2?-1:1)*(3.2+rng()*2.1)+ioChannel(y);
    if(ioSites.some(([sx,sy])=>Math.hypot(sx-Math.sign(sx)*.55+ioChannel(sy)-x,sy-y)<3.1))continue;
    rock(x,y,ioGroundHeight(x,y)+.12,.45+rng()*.6,.6+rng()*.65,.6+rng()*.75);
  }
  // Six fixed rock shelves beneath the six load-bearing foot anchors.
  for(const side of [-1,1])for(let row=0;row<3;row++){
    const x=side*(6.1+row*.25),y=IO_BOSS_Y-(3.7-row*3.3),top=IO_BOSS_Z-IO_FOOT_DROP-.17;
    rock(x,y,(top-8)/2,1.2,1.8,top+8);
  }
  rocks.count=count;rocks.name='caldera-rock-volumes';world.add(rocks);
  // Basalt rubble, sulfur-stained chips and scree settle around the changing banks.
  const rubble=new T.InstancedMesh(new T.DodecahedronGeometry(1,0),ioRock,1800),chipColor=new T.Color();let chips=0;
  for(let i=0;i<1800;i++){
    const y=-14+rng()*(IO_CALDERA_Y+38),side=i%2?-1:1,x=side*(2.8+rng()*12)+ioChannel(y);
    if(Math.hypot(x/16,(y-IO_CALDERA_Y)/18)<.96)continue;
    const size=.055+Math.pow(rng(),2)*.40;
    position.set(x,y,ioGroundHeight(x,y)+size*.18);rotation.setFromAxisAngle(axis,rng()*6.28);scale.set(size*(1+rng()),size*(1+rng()),size*.8);
    matrix.compose(position,rotation,scale);rubble.setMatrixAt(chips,matrix);
    chipColor.setHex(rng()>.8?0xd7b553:0xaaaaaa);rubble.setColorAt(chips++,chipColor);
  }
  rubble.count=chips;rubble.name='io-basalt-scree';world.add(rubble);

  // Talus collects along the irregular shoulders, with some fragments half
  // buried in the ledges instead of tracing a uniform row along a mesh grid.
  const talus=new T.InstancedMesh(rubble.geometry,ioRock,1400),tilt=new T.Euler();let stones=0;
  for(let i=0;i<1400;i++){
    const y=-12+rng()*(IO_CALDERA_Y+22),x=ioChannel(y)+(i%2?-1:1)*(1.7+rng()*2.3),z=ioGroundHeight(x,y);
    if(z<-5.5||ioSites.some(([sx,sy])=>Math.hypot(sx-Math.sign(sx)*.55+ioChannel(sy)-x,sy-y)<1.8))continue;
    const size=.04+Math.pow(rng(),2)*.32;position.set(x,y,z+size*.22);rotation.setFromEuler(tilt.set(rng()*.6,rng()*.6,rng()*6.28));scale.set(size*(.7+rng()),size*(.8+rng()),size*.65);
    matrix.compose(position,rotation,scale);talus.setMatrixAt(stones,matrix);chipColor.setHex(rng()>.9?0xb0a27a:0x999999);talus.setColorAt(stones++,chipColor);
  }
  talus.count=stones;talus.name='io-bank-talus';world.add(talus);

  // A few real emissive fissures cut across the shoulder, clear of the flight lane.
  for(let i=0;i<16;i++){
    const side=i%2?-1:1,x=side*(8+i*1.6),y=8+i*10;
    const line=new T.CatmullRomCurve3(Array.from({length:9},(_,j)=>{const px=x+(j-4)*.48,py=y+Math.sin(j*1.7)*.26;return new T.Vector3(px,py,ioGroundHeight(px,py)+.035);}));
    world.add(new T.Mesh(new T.TubeGeometry(line,28,.045,5),ioHot));
  }
  world.traverse(o=>{if(o instanceof T.Mesh&&o!==lava&&o!==apron&&o!==breach&&!([o.material].flat().some(m=>m.transparent))){o.castShadow=o.receiveShadow=true;}});
  function update(time:number,rise:number){
    const frame=ioFrame(time,rise),origin=ioWorld(0,0,time,rise);world.rotation.set(-frame.pitch,frame.bank,0);world.position.set(origin.x,origin.y,origin.z);lavaFlow.update(time);industry.update(time);activity.update(time);ioHot.emissiveIntensity=1.5+Math.sin(time*1.7)*.12;
    anchorShadow(frame.scroll,frame.trackX);poseIoEnvironment(rise,frame.pitch,frame.bank);
  }
  update(0,0);
  const culling=new Map<T.Mesh,boolean>();
  return {root,world,boss,update,prime(active:boolean){root.traverse(o=>{if(o instanceof T.Mesh){if(active){culling.set(o,o.frustumCulled);o.frustumCulled=false;}else{o.frustumCulled=culling.get(o)??o.frustumCulled;}}});if(!active)culling.clear();}};
}
