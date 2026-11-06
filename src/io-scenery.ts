import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ioRock,ioGround,ioCeramic,ioSteel,ioDark,ioHot,ioRust,ioWeather,ioRandom } from './io-materials';
import { createCaldera } from './io-rigs';
import { ioFrame,ioWorld,ioGroundHeight,IO_BOSS_Y,IO_BOSS_Z,IO_FOOT_DROP } from './io-layout';

export function createIoScenery(){
  const root=new T.Group();root.name='io-caldera-world';root.visible=false;
  const world=new T.Group();root.add(world);
  const boss=createCaldera();boss.root.position.set(0,IO_BOSS_Y,IO_BOSS_Z);boss.root.rotation.x=Math.PI/2;world.add(boss.root);
  const land=new T.PlaneGeometry(120,168,120,168);land.translate(0,48,0);
  const p=land.attributes.position,uv=land.attributes.uv,colors:number[]=[];
  const basalt=new T.Color(0x39332c),sulfur=new T.Color(0xc8ae5a),red=new T.Color(0x894731),pale=new T.Color(0xb7aa83),color=new T.Color();
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i);p.setZ(i,ioGroundHeight(x,y));uv.setXY(i,x*.19,y*.19);
    const stain=Math.sin(x*.17+Math.sin(y*.12)*1.4)*Math.cos(y*.11-x*.06),bank=Math.min(1,Math.max(0,(Math.abs(x)-1.6)/1.2));
    color.copy(basalt).lerp(sulfur,Math.min(1,Math.max(0,stain+.28))*bank*.95).lerp(red,Math.max(0,-stain-.35)*bank*.7);
    color.lerp(pale,Math.max(0,Math.sin(y*.15+x*.21)-.65)*bank*.8);
    colors.push(color.r,color.g,color.b);
  }
  land.setAttribute('color',new T.Float32BufferAttribute(colors,3));land.computeVertexNormals();
  const ground=new T.Mesh(land,ioGround);ground.name='io-heightfield';world.add(ground);

  // A genuine lake below genuine crust slabs; camera pitching exposes their depth.
  const lavaMaterial=new T.ShaderMaterial({uniforms:{clock:{value:0}},vertexShader:'varying vec2 ground;void main(){ground=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`varying vec2 ground;uniform float clock;
    void main(){float heat=.5+.2*sin(ground.x*.45+ground.y*.23+clock*.45)+.15*sin(ground.y*.73-ground.x*.13-clock*.3);
    vec3 c=mix(vec3(.75,.045,.001),vec3(1.,.47,.025),clamp(heat,0.,1.));gl_FragColor=vec4(c,1.);
    #include <colorspace_fragment>
    }`});
  const lava=new T.Mesh(new T.CircleGeometry(1,80),lavaMaterial);lava.name='caldera-lava-lake';lava.position.set(0,56,-6.85);lava.scale.set(16.8,18.8,1);world.add(lava);
  const rng=ioRandom(78266),matrix=new T.Matrix4(),position=new T.Vector3(),rotation=new T.Quaternion(),scale=new T.Vector3(),axis=new T.Vector3(0,0,1);
  function irregular(seed:number){
    const r=ioRandom(seed),geometry=new T.CylinderGeometry(1,1.15,1,7,1).rotateX(Math.PI/2);
    const v=geometry.attributes.position;const corner=Array.from({length:7},()=>.85+r()*.30);
    for(let i=0;i<v.count;i++){const x=v.getX(i),y=v.getY(i),a=(Math.atan2(y,x)+Math.PI*2)%(Math.PI*2),s=corner[Math.round(a/(Math.PI*2)*7)%7];v.setXYZ(i,x*s,y*s,v.getZ(i));}
    geometry.computeVertexNormals();return ioWeather(geometry,seed);
  }
  // Inset Voronoi cells form unique fractured slabs instead of repeating a hexagon.
  const seeds:T.Vector2[]=[];
  for(let iy=-5;iy<=5;iy++)for(let ix=-6;ix<=6;ix++){
    const x=ix*2.65+(iy%2)*1.30+(rng()-.5)*1.7,y=iy*3+(rng()-.5)*1.9;
    if(Math.hypot(x/16.6,y/18.6)<.99)seeds.push(new T.Vector2(x,y));
  }
  const slabGeometries:T.BufferGeometry[]=[];
  for(const seed of seeds){
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
    const shape=new T.Shape(polygon.map(p=>p.clone().sub(seed).multiplyScalar(.94).add(seed)));
    const g=new T.ExtrudeGeometry(shape,{depth:.43+rng()*.13,bevelEnabled:false,steps:1});g.translate(0,56,-6.80+rng()*.06);
    const pos=g.attributes.position,uv=g.attributes.uv;
    for(let i=0;i<pos.count;i++)uv.setXY(i,pos.getX(i)*.35,pos.getY(i)*.35);
    slabGeometries.push(ioWeather(g,Math.floor(rng()*10000)));
  }
  const crust=new T.Mesh(mergeGeometries(slabGeometries),ioRock);crust.name='broken-lava-crust';world.add(crust);slabGeometries.forEach(g=>g.dispose());

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
    rock(x,y,ioGroundHeight(x,y)+.18,.5+rng()*.5,.7+rng()*.5,.65+rng()*.7);
  }
  // Six fixed rock shelves beneath the six load-bearing foot anchors.
  for(const side of [-1,1])for(let row=0;row<3;row++){
    const x=side*(6.1+row*.25),y=IO_BOSS_Y-(3.7-row*3.3),top=IO_BOSS_Z-IO_FOOT_DROP-.17;
    rock(x,y,(top-8)/2,1.2,1.8,top+8);
  }
  rocks.count=count;rocks.name='caldera-rock-volumes';world.add(rocks);

  // Batched industrial modules, built once in stable world coordinates.
  const batches=new Map<T.Material,T.BufferGeometry[]>();
  function add(g:T.BufferGeometry,m:T.Material){if(m===ioCeramic)ioWeather(g,38);const list=batches.get(m)||[];list.push(g);batches.set(m,list);}
  function block(x:number,y:number,z:number,w:number,d:number,h:number,m:T.Material){add(new T.BoxGeometry(w,d,h).translate(x,y,z),m);}
  for(const side of [-1,1]){
    const pipeline=new T.CatmullRomCurve3(Array.from({length:23},(_,i)=>{const y=-16+i*2.6,x=side*(3.1+Math.sin(y*.14)*.17);return new T.Vector3(x,y,ioGroundHeight(x,y)+.18);}));
    add(new T.TubeGeometry(pipeline,92,.13,8,false),ioRust);
    for(let i=0;i<7;i++){
      const y=-9+i*7,x=side*(3.9+i%2*.35),z=ioGroundHeight(x,y);
      block(x,y,z+.18,3,3.2,.35,ioSteel);
      const tank=new T.CylinderGeometry(.46,.50,1.25,12).rotateX(Math.PI/2).translate(x,y,z+1.2);add(tank,ioCeramic);
      block(x+side*.9,y,z+1.0,.25,.55,1.65,ioSteel);
      block(x,y,z+2.15,1.35,.16,.1,ioRust);
      for(let j=0;j<4;j++)block(x+side*1.3,y-1.1+j*.7,z+.8,.05,.05,1.2,ioSteel);
      block(x+side*1.3,y,z+1.42,.06,2.6,.06,ioSteel);
      block(side*2.6,y,z+.03,.20,1.5,.03,ioCeramic);
    }
  }
  for(const[m,geometries]of batches){const g=mergeGeometries(geometries);world.add(new T.Mesh(g,m));geometries.forEach(g=>g.dispose());}
  // A few real emissive fissures cut across the shoulder, clear of the flight lane.
  for(let i=0;i<5;i++){
    const side=i%2?-1:1,x=side*(8+i*1.6),y=6+i*6;
    const line=new T.CatmullRomCurve3(Array.from({length:9},(_,j)=>{const px=x+(j-4)*.48,py=y+Math.sin(j*1.7)*.26;return new T.Vector3(px,py,ioGroundHeight(px,py)+.035);}));
    world.add(new T.Mesh(new T.TubeGeometry(line,28,.045,5),ioHot));
  }
  function update(time:number,rise:number){
    const frame=ioFrame(time,rise),origin=ioWorld(0,0,time,rise);world.rotation.x=-frame.pitch;world.position.set(0,origin.y,origin.z);lavaMaterial.uniforms.clock.value=time;
  }
  update(0,0);
  return {root,world,boss,update,prime(active:boolean){root.traverse(o=>{if(o instanceof T.Mesh)o.frustumCulled=!active;});}};
}
