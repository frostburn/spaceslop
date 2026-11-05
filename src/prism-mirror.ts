import * as T from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import type { prismOptics } from './prism-optics';

// A single bounded live reflection. Optical layers and projectile effects never
// feed back into the mirror; the reflected cave uses its analytic environment.
export function createPrismMirror(root:T.Group,optics:ReturnType<typeof prismOptics>) {
  const shape=new T.Shape();shape.moveTo(-1.3,-18);shape.lineTo(1.3,-15);shape.lineTo(1.3,47);
  shape.lineTo(.4,52);shape.lineTo(-1.3,49);shape.closePath();
  const geometry=new T.ShapeGeometry(shape),p=geometry.getAttribute('position'),coords:number[]=[];
  for(let i=0;i<p.count;i++)coords.push(p.getX(i)/1.3,p.getY(i)/35);
  geometry.setAttribute('mirrorCoord',new T.Float32BufferAttribute(coords,2));
  const mirror=new Reflector(geometry,{textureWidth:256,textureHeight:512,multisample:0,clipBias:.003,
    shader:{name:'prism-live-mirror',uniforms:{tDiffuse:{value:null},color:{value:new T.Color()},textureMatrix:{value:new T.Matrix4()}},
      vertexShader:`uniform mat4 textureMatrix;attribute vec2 mirrorCoord;varying vec4 vProject;varying vec2 vFacet;
        void main(){vProject=textureMatrix*vec4(position,1.0);vFacet=mirrorCoord;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader:`uniform sampler2D tDiffuse;varying vec4 vProject;varying vec2 vFacet;
        void main(){vec3 reflection=texture2DProj(tDiffuse,vProject).rgb;float rim=pow(clamp(abs(vFacet.x),0.0,1.0),20.0);
        gl_FragColor=vec4(reflection*vec3(.68,.74,.83)+vec3(.013,.014,.025)+rim*vec3(.16,.13,.20),1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`}});
  mirror.name='prism-live-mirror';mirror.position.set(-4.25,0,-1.7);mirror.rotation.y=.60;mirror.frustumCulled=false;
  const border=new T.LineSegments(new T.EdgesGeometry(geometry),new T.LineBasicMaterial({color:0x8c9da8,transparent:true,opacity:.32}));
  border.position.copy(mirror.position);border.quaternion.copy(mirror.quaternion);
  const draw=mirror.onBeforeRender;
  let actors:T.Object3D[]=[],priming=false,reflecting=false;
  const allowed=new Set<T.Object3D>([root]);
  const viewToCave=new T.Matrix4(),projectionInverse=new T.Matrix4(),viewportSize=new T.Vector2();
  mirror.onBeforeRender=(renderer,scene,camera,g,m,group)=>{
    if(reflecting || optics.refraction.uniforms.captureLayer.value>0)return;
    const target=renderer.getRenderTarget(),viewport=renderer.getViewport(new T.Vector4()),scissor=renderer.getScissorTest();
    const xr=renderer.xr.enabled,shadow=renderer.shadowMap.autoUpdate,visible=mirror.visible;
    const parent=root.parent,siblings=parent?.children??[],states=siblings.map(node=>node.visible),actorStates=actors.map(node=>node.visible);
    const layer=optics.refraction.uniforms.captureLayer.value;
    viewToCave.copy(optics.uniforms.viewToCave.value);projectionInverse.copy(optics.uniforms.caveProjectionInverse.value);viewportSize.copy(optics.uniforms.iceViewport.value);
    reflecting=true;optics.refraction.uniforms.captureLayer.value=1;
    siblings.forEach(node=>{if(!allowed.has(node) && !(node instanceof T.Light))node.visible=false;});
    if(priming)actors.forEach(node=>{node.visible=true;});
    try {renderer.setScissorTest(false);draw.call(mirror,renderer,scene,camera,g,m,group);}
    finally {
      reflecting=false;priming=false;mirror.forceUpdate=false;mirror.visible=visible;
      optics.refraction.uniforms.captureLayer.value=layer;
      optics.uniforms.viewToCave.value.copy(viewToCave);optics.uniforms.caveProjectionInverse.value.copy(projectionInverse);optics.uniforms.iceViewport.value.copy(viewportSize);
      siblings.forEach((node,i)=>{node.visible=states[i];});actors.forEach((node,i)=>{node.visible=actorStates[i];});
      renderer.xr.enabled=xr;renderer.shadowMap.autoUpdate=shadow;renderer.setRenderTarget(target);renderer.setViewport(viewport);renderer.setScissorTest(scissor);
    }
  };
  return {mirror,border,
    async prepare(renderer:T.WebGLRenderer,camera:T.Camera,signal:AbortSignal) {
      const scene=new T.Scene(),key=new T.DirectionalLight(0xb9e8ff,2.7);key.position.set(3,5,6);
      scene.add(key,new T.HemisphereLight(0xd6e3ff,0x514873,1.75));
      const objects:T.Mesh[]=[],seen=new Set<string>();
      for(const actor of [root,...actors])actor.traverse(node=>{
        if(!(node instanceof T.Mesh)||node===mirror)return;
        const materials=[node.material].flat(),signature=materials.map(m=>m.id).join('/')+node.type+Object.keys(node.geometry.attributes).sort().join('/');
        if(seen.has(signature))return;seen.add(signature);objects.push(node.clone(false));
      });
      // Compile against the mirror's linear half-float target, not just the
      // canvas. These are different program variants in WebGLRenderer.
      for(let i=0;i<objects.length;i+=3) {
        await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));if(signal.aborted)return;
        const batch=objects.slice(i,i+3);scene.add(...batch);
        const target=renderer.getRenderTarget();let compiling:Promise<unknown>|undefined;
        try {renderer.setRenderTarget(mirror.getRenderTarget());
          if(renderer.extensions.has('KHR_parallel_shader_compile'))compiling=renderer.compileAsync(scene,camera);
          else renderer.compile(scene,camera);
        } finally {renderer.setRenderTarget(target);}
        await compiling;scene.remove(...batch);
      }
    },setActors(objects:T.Object3D[]) {actors=objects;objects.forEach(object=>allowed.add(object));},
    prime(){priming=true;mirror.forceUpdate=true;}};
}
