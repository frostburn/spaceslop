import * as T from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import type { prismOptics } from './prism-optics';
import { prismLight } from './prism-light';

// A single bounded live reflection. Optical layers and projectile effects never
// feed back into the mirror; the reflected cave uses its analytic environment.
export function createPrismMirror(root:T.Group,optics:ReturnType<typeof prismOptics>) {
  // The local XY plane is below the combat lane; its normal follows the
  // pitched corridor into the boss view. One pass reflects actual undersides.
  const geometry=new T.PlaneGeometry(2,124,1,124);geometry.translate(0,38,0);
  const mirror=new Reflector(geometry,{textureWidth:384,textureHeight:768,multisample:0,clipBias:.003,
    shader:{name:'prism-live-river',uniforms:{tDiffuse:{value:null},color:{value:new T.Color()},textureMatrix:{value:new T.Matrix4()},
      caveScroll:optics.uniforms.caveScroll,caveTime:optics.uniforms.caveTime,caveEye:optics.uniforms.caveEye},
      vertexShader:`uniform mat4 textureMatrix;uniform float caveScroll;varying vec4 vProject;varying vec2 vRiver;
        void main(){vec3 p=position;float y=p.y+caveScroll;p.x*=3.8+sin(y*.31)*.28+sin(y*.83)*.12;
          vProject=textureMatrix*vec4(p,1.0);vRiver=p.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,
      fragmentShader:`${prismLight}
        uniform sampler2D tDiffuse;varying vec4 vProject;varying vec2 vRiver;
        void main(){vec2 ripple=riverCurrent(vRiver);vec2 uv=vProject.xy/vProject.w+ripple*.4;
          vec3 live=texture2D(tDiffuse,clamp(uv,vec2(.002),vec2(.998))).rgb;
          vec2 roof=vRiver+vec2(0,caveScroll)+ripple*7.0;
          vec3 reflection=caveRoof(roof)*.22+live*.90;
          float shore=smoothstep(2.6,4.1,abs(vRiver.x));
          float stones=caveNoise(roof*8.0);float foam=positivePow(caveNoise(vRiver*vec2(2.0,20.0)+ripple*25.0),6.0);
          vec3 water=vec3(.004,.014,.023)+vec3(.022,.032,.028)*stones*shore;
          water+=reflection;
          // Narrow white streaks reveal moving liquid even outside the light fans.
          water+=foam*.006+shore*foam*.06;
          gl_FragColor=vec4(safeHDR(water),1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`}});
  (mirror.material as T.ShaderMaterial).uniforms.caveScroll=optics.uniforms.caveScroll;
  (mirror.material as T.ShaderMaterial).uniforms.caveTime=optics.uniforms.caveTime;
  (mirror.material as T.ShaderMaterial).uniforms.caveEye=optics.uniforms.caveEye;
  mirror.name='prism-live-river';mirror.position.z=-3.8;mirror.frustumCulled=false;
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
      renderer.xr.enabled=xr;renderer.shadowMap.autoUpdate=shadow;renderer.setViewport(viewport);renderer.setRenderTarget(target);renderer.setScissorTest(scissor);
    }
  };
  return {mirror,
    async prepare(renderer:T.WebGLRenderer,camera:T.Camera,signal:AbortSignal) {
      const scene=new T.Scene(),key=new T.DirectionalLight(0xb9e8ff,2.7);key.position.set(3,5,6);
      const bounce=new T.DirectionalLight(0xc4dcff,1.1);bounce.position.set(0,1,-6);
      scene.add(key,bounce,new T.HemisphereLight(0xd6e3ff,0x514873,1.75));
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
