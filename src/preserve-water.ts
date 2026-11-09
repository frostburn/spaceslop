import * as T from 'three';
import { preserveBatch, preservePart, type PreservePart } from './preserve-geometry';
import { PRESERVE_WATER_START, PRESERVE_WATER_END, preserveWater, preservePools, preserveGround, preserveRandom } from './preserve-layout';
import type { PreserveMaterials } from './preserve-materials';
import { preserveWaterSurface, preservePoolSurface, shadePreserveWater } from './preserve-water-surface';

export function createPreserveWater(m: PreserveMaterials) {
  const root = new T.Group(); root.name = 'preserve-irrigation';
  const clock = { value: 0 }, water = m.water;
  shadePreserveWater(water,clock);
  const positions = [], uv = [], indices = [], rows = 240, cols = 20;
  for (let j = 0; j <= rows; j++) {
    const y = T.MathUtils.lerp(PRESERVE_WATER_START, PRESERVE_WATER_END, j / rows), w = preserveWater(y);
    for (let i = 0; i <= cols; i++) {
      positions.push(w.x + (i / cols * 2 - 1) * w.width, y, w.z);
      uv.push(i / cols, y);
      if (j < rows && i < cols) { const a = j * (cols + 1) + i; indices.push(a, a + 1, a + cols + 1, a + 1, a + cols + 2, a + cols + 1); }
    }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(indices); g.computeVertexNormals();
  const stream = new T.Mesh(preserveWaterSurface(g), water); stream.name = 'ravine-stream'; stream.receiveShadow = true; root.add(stream);
  for(const pool of preservePools){const surface=new T.Mesh(preservePoolSurface(pool),water);surface.name='irrigation-pool';surface.receiveShadow=true;root.add(surface);}
  const stones:PreservePart[]=[],random=preserveRandom(7193);
  function pebble(x:number,y:number,surface:number) {
    const z=preserveGround(x,y),size=.055+random()*.12;if(z+size*.5>surface-.12)return;
    stones.push(preservePart(x,y,z+size*.08,size*(1+random()),size*(.7+random()),size*.45,random()>.4?0x889080:0x666654,random()*Math.PI));
  }
  for(let i=0;i<84;i++){const y=PRESERVE_WATER_START+random()*(PRESERVE_WATER_END-PRESERVE_WATER_START),w=preserveWater(y);pebble(w.x+(random()-.5)*w.width*1.5,y,w.z);}
  for(const pool of preservePools)for(let i=0;i<16;i++){const a=random()*Math.PI*2,r=Math.sqrt(random())*.8;pebble(pool.x+Math.cos(a)*r*pool.rx,pool.y+Math.sin(a)*r*pool.ry,pool.z);}
  const bed=preserveBatch('irrigation-submerged-stones',new T.IcosahedronGeometry(1,1),m.rock,stones);bed.castShadow=false;root.add(bed);
  const parts: PreservePart[] = [], block = (x: number,y: number,z: number,sx: number,sy: number,sz: number,c: number) => parts.push(preservePart(x,y,z,sx,sy,sz,c));
  const source = preserveWater(PRESERVE_WATER_END), sink = preserveWater(PRESERVE_WATER_START);
  for (const [p,y,z] of [[source,PRESERVE_WATER_END,source.z],[sink,PRESERVE_WATER_START,sink.z]] as const) {
    for (const side of [-1,1]) block(p.x+side*(p.width+.15),y,z+.27,.24,1.1,1.2,0x7a8273);
    block(p.x,y+.3,z+.8,p.width*2+.6,.55,.22,0x91917a);
    block(p.x,y,z-.35,p.width*2+.4,1.1,.24,0x5d695e);
    for (let i=-3;i<=3;i++) block(p.x+i*p.width/3,y-.3,z+.12,.05,.12,.75,0x56655c);
  }
  // Supply conduits join the source to the wall. Their mouths face the basin.
  block(source.x-1.45,PRESERVE_WATER_END+.6,source.z+.5,2.3,.22,.26,0x907b51);
  block(-2.9,PRESERVE_WATER_END+.6,source.z+.5,.3,2.6,.3,0x6f7d67);
  root.add(preserveBatch('irrigation-sluice-and-collector',new T.BoxGeometry(),m.metal,parts));
  const spray = new T.InstancedMesh(new T.OctahedronGeometry(1,0),new T.MeshBasicMaterial({color:0xc6e0d5,transparent:true,opacity:.42,depthWrite:false}),64);
  spray.name = 'spillway-whitewater'; spray.instanceMatrix.setUsage(T.DynamicDrawUsage); spray.frustumCulled = false; root.add(spray);
  const transform = new T.Object3D();
  const falls = [74.5,85.5,90.5];
  const update = (time: number) => {
    clock.value = time;
    for (let i=0;i<spray.count;i++) {
      const y=falls[i%falls.length],w=preserveWater(y),life=((time*.8+i*.618)%1+1)%1;
      transform.position.set(w.x+Math.sin(i*8.7)*w.width*.88,y-life*.9,preserveWater(y-life*.9).z+.035+Math.sin(life*Math.PI)*.12);
      transform.scale.set(.025+.03*Math.sin(i*3)**2,.08*(1-life)+.02,.018);
      transform.rotation.set(.3,0,i*2.4); transform.updateMatrix(); spray.setMatrixAt(i,transform.matrix);
    }
    spray.instanceMatrix.needsUpdate=true;
  };
  update(0); spray.computeBoundingSphere(); spray.boundingSphere!.radius += 1; return {root,update,clock};
}
