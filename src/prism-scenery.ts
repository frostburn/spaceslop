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
  const p:number[]=[],ix:number[]=[];
  const rows=248,cols=20;
  for(const side of [-1,1]) {
    const offset=p.length/3;
    for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++) {
      const y=-24+row/rows*124,u=col/cols;
      p.push(side*(3.45+u*5.5),y,-4.25+Math.pow(u,.65)*3.5+Math.sin(col*8.7+row*2.9)*.16);
      if(row<rows&&col<cols){const i=offset+row*(cols+1)+col;ix.push(i,i+cols+1,i+1,i+1,i+cols+1,i+cols+2);}
    }
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));geometry.setIndex(ix);return geometry;
}
// Bounded additive beam ribbons and analytic glints replace a full-screen bloom
// chain. They sit below combat geometry and never hide warning markers.
function stellarEffects(uniforms:ReturnType<typeof prismOptics>['uniforms']) {
  const p:number[]=[],coords:number[]=[],seeds:number[]=[];
  for(let i=0;i<12;i++) {
    const y=-20+i*8.0,wide=i%3===0?.22:.065;
    const a=new T.Vector3(7.5,y+6,-.55),b=new T.Vector3(-5.8,y-3,-2.7),n=new T.Vector3(.55,-.83,0).multiplyScalar(wide);
    for(const [point,along,across] of [[a.clone().sub(n),0,-1],[b.clone().sub(n),1,-1],[a.clone().add(n),0,1],
      [a.clone().add(n),0,1],[b.clone().sub(n),1,-1],[b.clone().add(n),1,1]] as [T.Vector3,number,number][]) {
      p.push(...point.toArray());coords.push(along,across);seeds.push(i);
    }
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));
  geometry.setAttribute('beamCoord',new T.Float32BufferAttribute(coords,2));geometry.setAttribute('beamSeed',new T.Float32BufferAttribute(seeds,1));
  const beams=new T.Mesh(geometry,new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,
    vertexShader:`uniform float caveScroll;attribute vec2 beamCoord;attribute float beamSeed;varying vec2 vBeam;varying float vSeed;
      void main(){vec3 p=position;float center=-20.0+beamSeed*8.0;p.y+=mod(center-caveScroll+24.0,96.0)-24.0-center;vBeam=beamCoord;vSeed=beamSeed;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,
    fragmentShader:`uniform float caveTime;varying vec2 vBeam;varying float vSeed;
      void main(){float core=pow(1.0-abs(vBeam.y),9.0),halo=pow(1.0-abs(vBeam.y),2.0);
        float fade=smoothstep(0.0,.1,vBeam.x)*(1.0-smoothstep(.8,1.0,vBeam.x));
        float shimmer=.85+.15*sin(caveTime*.65+vSeed*3.0);
        gl_FragColor=vec4(vec3(1.0,.94,.82)*(core*4.0+halo*.3)*shimmer,fade*.4);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`}));
  beams.name='prism-stellar-rays';beams.frustumCulled=false;
  const points=new T.BufferGeometry();points.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(prismCrystals.length*3),3));
  points.setAttribute('glintSeed',new T.Float32BufferAttribute(prismCrystals.map((_,i)=>i),1));
  const glints=new T.Points(points,new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    vertexShader:`uniform float caveTime;attribute float glintSeed;varying float vShine;
      void main(){vShine=pow(.5+.5*sin(caveTime*.65+glintSeed*2.4),8.0);
        vec4 p=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*p;
        gl_PointSize=clamp((12.0+vShine*24.0)*32.0/max(8.0,-p.z),3.0,64.0);}`,
    fragmentShader:`varying float vShine;
      void main(){vec2 p=gl_PointCoord*2.0-1.0;float r=length(p);if(r>1.0)discard;
        float crossGlow=pow(max(0.0,1.0-abs(p.x)),44.0)*pow(1.0-abs(p.y),3.0)+pow(max(0.0,1.0-abs(p.y)),44.0)*pow(1.0-abs(p.x),3.0);
        float halo=pow(1.0-r,6.0);float shine=(halo*.65+crossGlow*1.7)*vShine;
        gl_FragColor=vec4(vec3(1.0,.94,.82)*3.0,shine);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`}));
  glints.name='prism-facet-glints';glints.frustumCulled=false;
  return {beams,glints};
}
export function createPrismScenery() {
  const root=new T.Group(),field=new T.Group();root.name='prism-vault';root.visible=false;root.add(field);
  const optics=prismOptics(),wall=new T.Mesh(caveGeometry(),caveWallMaterial(optics.uniforms));wall.frustumCulled=false;wall.name='prism-basalt';field.add(wall);
  const mirror=createPrismMirror(root,optics);field.add(mirror.mirror);
  const bounce=new T.DirectionalLight(0xc4dcff,1.1);bounce.position.set(0,1,-6);field.add(bounce,bounce.target);
  const effects=stellarEffects(optics.uniforms);field.add(effects.beams,effects.glints);
  const tip=new T.Vector3(),transform=new T.Object3D(),inverse=new T.Matrix4(),color=new T.Color(),yAxis=new T.Vector3(0,1,0);
  const batches=Array.from({length:4},(_,variant)=>{
    const recipes=prismCrystals.map((recipe,index)=>({recipe,index})).filter(({recipe})=>recipe.variant===variant);
    const geometry=prismCrystalGeometry(variant),mesh=new T.InstancedMesh(geometry,optics.surface,recipes.length);
    mesh.name=`prism-crystals-${variant}`;mesh.frustumCulled=false;mesh.count=0;
    geometry.setAttribute('rockId',new T.InstancedBufferAttribute(new Float32Array(recipes.length),1).setUsage(T.DynamicDrawUsage));
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.setColorAt(0,new T.Color(0xffffff));field.add(mesh);
    mesh.onBeforeRender=(renderer,_scene,camera)=>{
      inverse.copy(field.matrixWorld).invert();optics.uniforms.viewToCave.value.copy(inverse).multiply(camera.matrixWorld);
      // Reflector changes its cached camera projection for the boss view and
      // oblique clip plane without updating that camera's inverse property.
      optics.uniforms.caveProjectionInverse.value.copy(camera.projectionMatrix).invert();
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
          color.setHex(0xf8fcff);mesh.setColorAt(count++,color);
        }
        mesh.count=count;mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor!.needsUpdate=true;mesh.geometry.getAttribute('rockId').needsUpdate=true;
      }
      const positions=effects.glints.geometry.getAttribute('position');
      prismCrystals.forEach((recipe,i)=>{tip.copy(recipe.root).addScaledVector(recipe.direction,recipe.length*.72);
        positions.setXYZ(i,tip.x,prismCrystalY(i,time)+(tip.y-recipe.root.y),tip.z+.05);});
      positions.needsUpdate=true;
    },
    capture(renderer:T.WebGLRenderer,camera:T.Camera){optics.refraction.capture(renderer,camera,root,field);},
    prime(){this.update(0,0);mirror.prime();},
  };
}
