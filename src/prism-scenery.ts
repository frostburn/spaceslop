import * as T from 'three';
import { prismOptics, caveWallMaterial } from './prism-optics';
import { createPrismMirror } from './prism-mirror';
import { prismCrystals, prismCrystalY, prismScroll, PRISM_DURATION, PRISM_PITCH } from './prism-layout';

export function prismCrystalGeometry(variant:number) {
  const p:number[]=[],uv:number[]=[],ix:number[]=[];
  const rings=[[0,.16],[.08,.40],[.70,.40],[1,0.001]];
  for(let row=0;row<rings.length;row++)for(let col=0;col<=6;col++) {
    const [y,r]=rings[row],a=col/6*Math.PI*2+variant*.21;
    p.push(Math.cos(a)*r,y,Math.sin(a)*r);uv.push(col/6,y);
    if(row<rings.length-1&&col<6){const i=row*7+col;ix.push(i,i+7,i+1,i+1,i+7,i+8);}
  }
  const bottom=p.length/3;p.push(0,0,0);uv.push(.5,0);
  for(let col=0;col<6;col++)ix.push(bottom,col,col+1);
  const tip=p.length/3;p.push(0,1,0);uv.push(.5,1);
  for(let col=0;col<6;col++)ix.push(tip,21+col+1,21+col);
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(ix);geometry.computeVertexNormals();return geometry;
}
function caveGeometry() {
  const p:number[]=[],angles:number[]=[],ix:number[]=[];
  const rows=64,cols=28;
  for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++) {
    const a=(col/cols*2-1)*2.04,y=-24+row/rows*124;
    p.push(Math.sin(a)*5.4,y,-1.5-Math.cos(a)*6.5);angles.push(a);
    if(row<rows&&col<cols){const i=row*(cols+1)+col;ix.push(i,i+cols+1,i+1,i+1,i+cols+1,i+cols+2);}
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));geometry.setAttribute('caveAngle',new T.Float32BufferAttribute(angles,1));geometry.setIndex(ix);return geometry;
}
export function createPrismScenery() {
  const root=new T.Group(),field=new T.Group();root.name='prism-vault';root.visible=false;root.add(field);
  const optics=prismOptics(),wall=new T.Mesh(caveGeometry(),caveWallMaterial(optics.uniforms));wall.frustumCulled=false;wall.name='prism-basalt';field.add(wall);
  const mirror=createPrismMirror(root,optics);field.add(mirror.mirror,mirror.border);
  const transform=new T.Object3D(),inverse=new T.Matrix4(),color=new T.Color(),yAxis=new T.Vector3(0,1,0);
  const batches=Array.from({length:4},(_,variant)=>{
    const recipes=prismCrystals.map((recipe,index)=>({recipe,index})).filter(({recipe})=>recipe.variant===variant);
    const geometry=prismCrystalGeometry(variant),mesh=new T.InstancedMesh(geometry,optics.surface,recipes.length);
    mesh.name=`prism-crystals-${variant}`;mesh.frustumCulled=false;mesh.count=0;
    geometry.setAttribute('rockId',new T.InstancedBufferAttribute(new Float32Array(recipes.length),1).setUsage(T.DynamicDrawUsage));
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.setColorAt(0,new T.Color(0xffffff));field.add(mesh);
    mesh.onBeforeRender=(renderer,_scene,camera)=>{
      inverse.copy(field.matrixWorld).invert();optics.uniforms.viewToCave.value.copy(inverse).multiply(camera.matrixWorld);
      optics.uniforms.caveProjectionInverse.value.copy(camera.projectionMatrixInverse);
      const target=renderer.getRenderTarget();if(target)optics.uniforms.iceViewport.value.set(target.width,target.height);else renderer.getDrawingBufferSize(optics.uniforms.iceViewport.value);
    };
    return {mesh,recipes};
  });
  return {root,ready:Promise.resolve([] as T.Texture[]),setReflectionActors:mirror.setActors,prepareReflection:mirror.prepare,
    update(progress:number,reveal:number,time=progress*PRISM_DURATION) {
      optics.uniforms.caveScroll.value=prismScroll(time);optics.uniforms.caveTime.value=time;
      const angle=-PRISM_PITCH*reveal;field.rotation.x=angle;
      field.position.set(0,-5.3*(1-Math.cos(angle)),5.3*Math.sin(angle));
      for(const {mesh,recipes} of batches) {
        let count=0;
        for(const {recipe,index} of recipes) {
          const y=prismCrystalY(index,time);if(y< -24 || y>30+reveal*60)continue;
          transform.position.copy(recipe.root);transform.position.y=y;
          transform.quaternion.setFromUnitVectors(yAxis,recipe.direction);transform.scale.set(recipe.width,recipe.length,recipe.width);
          transform.updateMatrix();mesh.setMatrixAt(count,transform.matrix);mesh.geometry.getAttribute('rockId').setX(count,recipe.id);
          color.setHex([0xd1e9e6,0xe1d5ec,0xeee1c6][recipe.tint]);mesh.setColorAt(count++,color);
        }
        mesh.count=count;mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor!.needsUpdate=true;mesh.geometry.getAttribute('rockId').needsUpdate=true;
      }
    },
    capture(renderer:T.WebGLRenderer,camera:T.Camera){optics.refraction.capture(renderer,camera,root,field);},
    prime(){this.update(0,0);mirror.prime();},
  };
}
