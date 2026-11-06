import {createIoActivity} from './io-activity';
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ioRock,ioGround,ioCrust,ioCeramic,ioSafety,ioSteel,ioChrome,ioDark,ioHot,ioRust,ioWeather,ioRandom,poseIoEnvironment } from './io-materials';
import { createCaldera } from './io-rigs';
import { ioFrame,ioWorld,ioGroundHeight,ioNoise,ioChannel,smooth01,IO_BOSS_Y,IO_BOSS_Z,IO_FOOT_DROP } from './io-layout';

export function createIoScenery(){
  const root=new T.Group();root.name='io-caldera-world';root.visible=false;
  const world=new T.Group();root.add(world);const activity=createIoActivity();world.add(activity.root);
  const sun=new T.DirectionalLight(0xffecd0,3.5);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=sun.shadow.camera.bottom=-22;sun.shadow.camera.right=sun.shadow.camera.top=22;
  sun.shadow.camera.near=.5;sun.shadow.camera.far=120;sun.shadow.bias=-.00025;sun.shadow.normalBias=.035;
  world.add(sun,sun.target);
  const lavaFill=new T.PointLight(0xff500f,95,45,2);lavaFill.position.set(0,54,-3.5);world.add(lavaFill);
  const boss=createCaldera();boss.root.position.set(0,IO_BOSS_Y,IO_BOSS_Z);boss.root.rotation.x=Math.PI/2;world.add(boss.root);
  const land=new T.PlaneGeometry(120,168,240,336);land.translate(0,48,0);
  const p=land.attributes.position,uv=land.attributes.uv,colors:number[]=[];
  const basalt=new T.Color(0x363638),sulfur=new T.Color(0xbba03b),red=new T.Color(0x80432c),pale=new T.Color(0xc9b995),color=new T.Color();
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i);p.setZ(i,ioGroundHeight(x,y));uv.setXY(i,x*.19,y*.19);
    const stain=ioNoise(x*.31,y*.22)*.65+ioNoise(x*1.4,y*1.4)*.35,bank=smooth01((Math.abs(x-ioChannel(y))-2.35)/1.45);
    color.copy(basalt).lerp(red,bank*.8).lerp(sulfur,bank*smooth01((stain-.35)/.24));
    color.lerp(pale,bank*smooth01((ioNoise(x*.6+40,y*.5)-.51)/.24));
    colors.push(color.r,color.g,color.b);
  }
  land.setAttribute('color',new T.Float32BufferAttribute(colors,3));land.computeVertexNormals();
  const ground=new T.Mesh(land,ioGround);ground.name='io-heightfield';world.add(ground);

  // A genuine lake below genuine crust slabs; camera pitching exposes their depth.
  const lavaMaterial=new T.ShaderMaterial({uniforms:{clock:{value:0}},vertexShader:'varying vec2 ground;void main(){ground=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`varying vec2 ground;uniform float clock;
    void main(){float heat=.5+.2*sin(ground.x*.45+ground.y*.23+clock*.45)+.15*sin(ground.y*.73-ground.x*.13-clock*.3);
    vec3 c=mix(vec3(.7,.025,.001),vec3(3.0,1.1,.045),clamp(heat,0.,1.));gl_FragColor=vec4(c,1.);
    #include <colorspace_fragment>
    }`});
  const lava=new T.Mesh(new T.CircleGeometry(1,80),lavaMaterial);lava.name='caldera-lava-lake';lava.position.set(0,56,-6.85);lava.scale.set(16.8,18.8,1);world.add(lava);
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
  const seeds:T.Vector2[]=[];
  for(let iy=-5;iy<=5;iy++)for(let ix=-6;ix<=6;ix++){
    const x=ix*2.65+(iy%2)*1.30+(rng()-.5)*1.7,y=iy*3+(rng()-.5)*1.9;
    if(Math.hypot(x/16.6,y/18.6)<.99)seeds.push(new T.Vector2(x,y));
  }
  const slabGeometries:T.BufferGeometry[]=[];
  for(const [cell,seed] of seeds.entries()){
    if(cell%23===8)continue; // Exposed molten pockets interrupt the cooled plates.
    let polygon=Array.from({length:64},(_,i)=>new T.Vector2(Math.cos(i/64*Math.PI*2)*16.6,Math.sin(i/64*Math.PI*2)*18.6));
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
    if(polygon.length<3)continue;
    const edge:T.Vector2[]=[];
    for(let i=0;i<polygon.length;i++){
      const a=polygon[i].clone().sub(seed).multiplyScalar(.94).add(seed),b=polygon[(i+1)%polygon.length].clone().sub(seed).multiplyScalar(.94).add(seed);
      const steps=Math.max(1,Math.ceil(a.distanceTo(b)/.5));
      for(let j=0;j<steps;j++){const p=a.clone().lerp(b,j/steps),x=p.x,y=p.y;p.x+=Math.sin(y*2.4+x*.8)*.07;p.y+=Math.sin(x*2.1-y*.6)*.07;edge.push(p);}
    }
    const shape=new T.Shape(edge);
    const g=new T.ExtrudeGeometry(shape,{depth:.43+rng()*.13,bevelEnabled:true,bevelSize:.035,bevelThickness:.025,bevelSegments:1,steps:1});g.translate(0,56,-6.80+rng()*.06);
    const pos=g.attributes.position,uv=g.attributes.uv;
    for(let i=0;i<pos.count;i++)uv.setXY(i,pos.getX(i)*.35,pos.getY(i)*.35);
    slabGeometries.push(ioWeather(g,Math.floor(rng()*10000)));
  }
  const crustGeometry=mergeGeometries(slabGeometries),heat:number[]=[],cp=crustGeometry.attributes.position,cn=crustGeometry.attributes.normal;
  for(let i=0;i<cp.count;i++)heat.push(Math.abs(cn.getZ(i))<.7?Math.max(0,Math.min(1,(-6.34-cp.getZ(i))/.48)):0);
  crustGeometry.setAttribute('temperature',new T.Float32BufferAttribute(heat,1));
  const crust=new T.Mesh(crustGeometry,ioCrust);crust.name='broken-lava-crust';world.add(crust);slabGeometries.forEach(g=>g.dispose());

  const rocks=new T.InstancedMesh(irregular(18),ioRock,170);let count=0;
  function rock(x:number,y:number,z:number,sx:number,sy:number,sz:number){
    position.set(x,y,z);rotation.setFromAxisAngle(axis,rng()*6.28);scale.set(sx,sy,sz);matrix.compose(position,rotation,scale);rocks.setMatrixAt(count++,matrix);
  }
  for(let i=0;i<60;i++){
    const a=i/60*Math.PI*2,x=Math.cos(a)*17.8,y=56+Math.sin(a)*19.8;
    if(Math.abs(x)<5&&y<43)continue;
    rock(x,y,ioGroundHeight(x,y)+.4,1.5+rng()*1.9,1.6+rng()*1.5,1.5+rng()*2);
  }
  for(let i=0;i<55;i++){
    const side=i%2?-1:1,x=side*(5.5+rng()*18),y=-15+rng()*120;
    if(Math.hypot(x/19,(y-56)/22)<1.1)continue;
    rock(x,y,ioGroundHeight(x,y)+.2,.5+rng()*1.2,.7+rng()*1.2,.6+rng()*1.3);
  }
  for(let i=0;i<20;i++){
    const x=(i%2?-1:1)*(3.7+rng()*.6),y=-12+i*2.6;
    if(Array.from({length:7},(_,j)=>-9+j*7).some(v=>Math.abs(v-y)<1.8))continue;
    rock(x,y,ioGroundHeight(x,y)+.18,.5+rng()*.5,.7+rng()*.5,.65+rng()*.7);
  }
  // Six fixed rock shelves beneath the six load-bearing foot anchors.
  for(const side of [-1,1])for(let row=0;row<3;row++){
    const x=side*(6.1+row*.25),y=IO_BOSS_Y-(3.7-row*3.3),top=IO_BOSS_Z-IO_FOOT_DROP-.17;
    rock(x,y,(top-8)/2,1.2,1.8,top+8);
  }
  rocks.count=count;rocks.name='caldera-rock-volumes';world.add(rocks);
  // Basalt rubble, sulfur-stained chips and scree settle around the changing banks.
  const rubble=new T.InstancedMesh(rocks.geometry,ioRock,620),chipColor=new T.Color();let chips=0;
  for(let i=0;i<620;i++){
    const y=-14+rng()*112,side=i%2?-1:1,x=side*(2.8+rng()*12)+ioChannel(y);
    if(Math.hypot(x/16,(y-56)/18)<.96)continue;
    const size=.055+Math.pow(rng(),2)*.40;
    position.set(x,y,ioGroundHeight(x,y)+size*.18);rotation.setFromAxisAngle(axis,rng()*6.28);scale.set(size*(1+rng()),size*(1+rng()),size*.8);
    matrix.compose(position,rotation,scale);rubble.setMatrixAt(chips,matrix);
    chipColor.setHex(rng()>.8?0xd7b553:0xaaaaaa);rubble.setColorAt(chips++,chipColor);
  }
  rubble.count=chips;rubble.name='io-basalt-scree';world.add(rubble);

  // Batched industrial modules, built once in stable world coordinates.
  const batches=new Map<T.Material,T.BufferGeometry[]>();
  function add(g:T.BufferGeometry,m:T.Material){if(m===ioCeramic)ioWeather(g,38);const list=batches.get(m)||[];list.push(g);batches.set(m,list);}
  function block(x:number,y:number,z:number,w:number,d:number,h:number,m:T.Material){add(new T.BoxGeometry(w,d,h).translate(x,y,z),m);}
  for(const side of [-1,1]){
    const pipeX=(y:number)=>side*(2.95+Math.sin(y*.18+side)*.22)+ioChannel(y);
    const pipeline=new T.CatmullRomCurve3(Array.from({length:23},(_,i)=>{const y=-16+i*2.6,x=pipeX(y);return new T.Vector3(x,y,ioGroundHeight(x,y)+.25);}));
    add(new T.TubeGeometry(pipeline,92,.13,8,false),ioRust);
    for(let i=0;i<27;i++){
      const y=-16+i*2,x=pipeX(y),z=ioGroundHeight(x,y)+.25;
      add(new T.TorusGeometry(.16,.035,5,10).rotateX(Math.PI/2).translate(x,y,z),ioSteel);
      block(x,y,z-.20,.5,.15,.08,ioDark);
    }
    for(let i=0;i<7;i++){
      const y=-9+i*7+(side>0?2.7:0),x=side*(3.5+i%3*.18)+ioChannel(y),z=ioGroundHeight(x,y);
      block(x,y,z+.18,1.45,1.9,.15,ioSteel);
      for(let slat=0;slat<8;slat++)block(x-.63+slat*.18,y,z+.27,.035,1.85,.03,ioDark);
      for(const dx of [-.60,.60])for(const dy of [-.8,.8])block(x+dx,y+dy,z+.03,.13,.13,.5,ioDark);
      const tank=new T.CylinderGeometry(.46,.50,1.25,12).rotateX(Math.PI/2).translate(x,y,z+1.2);add(tank,ioCeramic);
      add(new T.SphereGeometry(.46,16,10).scale(1,1,.55).translate(x,y,z+1.82),ioCeramic);
      for(const h of [.65,1.05,1.55])add(new T.TorusGeometry(.51,.055,6,16).translate(x,y,z+h),ioChrome);
      for(let fin=0;fin<7;fin++)block(x+side*.62,y-.65+fin*.18,z+.95,.12,.07,1.0,ioSteel);
      block(x-side*.45,y-.55,z+.75,.42,.55,.48,ioCeramic);
      block(x+side*.9,y,z+1.0,.25,.55,1.65,ioSteel);
      for(let j=0;j<4;j++)block(x+side*.67,y-.8+j*.53,z+.65,.035,.035,.85,ioSafety);
      block(x+side*.67,y,z+1.08,.04,1.65,.04,ioSafety);
      const connector=new T.CatmullRomCurve3([new T.Vector3(x,y,z+2),new T.Vector3(x-side*.25,y+.55,z+2.12),new T.Vector3(pipeX(y+.7),y+.7,z+.28)]);
      add(new T.TubeGeometry(connector,12,.065,6),ioSteel);
      if(i%2===0){
        block(x+side*.43,y-.5,z+1.75,.10,.10,2.7,ioSteel);
        for(let j=0;j<5;j++)block(x+side*.43,y-.5,z+.65+j*.5,.40,.035,.035,ioSafety);
        block(x+side*.43,y-.5,z+3.17,.15,.15,.13,ioHot);
      }
    }
  }
  for(const[m,geometries]of batches){const g=mergeGeometries(geometries);world.add(new T.Mesh(g,m));geometries.forEach(g=>g.dispose());}
  // A few real emissive fissures cut across the shoulder, clear of the flight lane.
  for(let i=0;i<5;i++){
    const side=i%2?-1:1,x=side*(8+i*1.6),y=6+i*6;
    const line=new T.CatmullRomCurve3(Array.from({length:9},(_,j)=>{const px=x+(j-4)*.48,py=y+Math.sin(j*1.7)*.26;return new T.Vector3(px,py,ioGroundHeight(px,py)+.035);}));
    world.add(new T.Mesh(new T.TubeGeometry(line,28,.045,5),ioHot));
  }
  world.traverse(o=>{if(o instanceof T.Mesh&&o!==lava&&!([o.material].flat().some(m=>m.transparent))){o.castShadow=o.receiveShadow=true;}});
  function update(time:number,rise:number){
    const frame=ioFrame(time,rise),origin=ioWorld(0,0,time,rise);world.rotation.x=-frame.pitch;world.position.set(0,origin.y,origin.z);lavaMaterial.uniforms.clock.value=time;activity.update(time);
    sun.position.set(-26,frame.scroll-21,38);sun.target.position.set(0,frame.scroll+7,-3);poseIoEnvironment(rise);
  }
  update(0,0);
  return {root,world,boss,update,prime(active:boolean){root.traverse(o=>{if(o instanceof T.Mesh)o.frustumCulled=!active;});}};
}
