import * as T from 'three';
import { preserveBatch, preservePart, type PreservePart } from './preserve-geometry';
import { PRESERVE_WATER_START, PRESERVE_WATER_END, preserveWater } from './preserve-layout';
import type { PreserveMaterials } from './preserve-materials';

export function createPreserveWater(m: PreserveMaterials) {
  const root = new T.Group(); root.name = 'preserve-irrigation';
  const clock = { value: 0 }, water = m.water;
  water.onBeforeCompile = shader => {
    shader.uniforms.preserveFlowTime = clock;
    shader.vertexShader = 'varying vec3 vPreserveWater;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPreserveWater=position;');
    shader.fragmentShader = 'uniform float preserveFlowTime; varying vec3 vPreserveWater;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      float wave=.012*sin(vPreserveWater.x*17.+vPreserveWater.y*9.+preserveFlowTime*2.3)
        +.008*sin(vPreserveWater.x*9.-vPreserveWater.y*15.+preserveFlowTime*3.1);
      normal=perturbNormalArb(-vViewPosition,normal,vec2(dFdx(wave),dFdy(wave)),faceDirection);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float flow=sin(vPreserveWater.y*35.+preserveFlowTime*6.+sin(vPreserveWater.x*19.));
      diffuseColor.rgb*=.95+.05*flow;
    `);
  };
  water.customProgramCacheKey = () => 'preserve-irrigation-flow-v1';
  const positions = [], uv = [], indices = [], rows = 210, cols = 12;
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
  const stream = new T.Mesh(g, water); stream.name = 'ravine-stream'; stream.receiveShadow = true; root.add(stream);
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
