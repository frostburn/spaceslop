import * as T from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {createSeedPods} from './modules';
import {basinVisible,basinMaskGLSL,BASIN_START,BASIN_END} from './basin';
import {GROVE_GROUND_Z,groveScroll,grovePlateHeight} from './route';
import type {createGrovePlates} from './plates';

type Plates=ReturnType<typeof createGrovePlates>;
const POD_SITES=[[3.65,-7,32,1.9],[4.12,7.3,35,2.4],[4.55,-5.6,33,2.2],[4.95,7,34,2],[5.38,-6.7,32,2.3]];

export function createGroveWater(plane:T.Group,scene:T.Scene,plates:Plates){
  const root=new T.Group();root.name='grove-above-camera';
  const pods=createSeedPods({value:3.4},POD_SITES.length),height=grovePlateHeight(GROVE_GROUND_Z);
  root.add(...pods.meshes);
  // These sources lie behind the flight camera, but inside its mirrored view.
  // Their world anchors scroll with the grove rather than sticking to the lens.
  const starGeometry=new T.BufferGeometry(),positions=new Float32Array(96*3),powers=new Float32Array(96);
  for(let i=0;i<96;i++){positions[i*3]=Math.sin(i*127.1)*31;positions[i*3+1]=Math.sin(i*311.7)*55;positions[i*3+2]=124;powers[i]=.35+.65*(.5+.5*Math.sin(i*59.3));}
  starGeometry.setAttribute('position',new T.BufferAttribute(positions,3));starGeometry.setAttribute('power',new T.BufferAttribute(powers,1));
  const stars=new T.Points(starGeometry,new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    vertexShader:'attribute float power;varying float p;void main(){p=power;gl_PointSize=1.3+power*1.7;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying float p;void main(){float r=length(gl_PointCoord*2.-1.);if(r>1.)discard;gl_FragColor=vec4(mix(vec3(.5,.75,1.),vec3(1.,.9,.7),p)*3.,pow(1.-r,2.)*(.3+p));
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`}));stars.name='grove-reflected-stars';root.add(stars);
  const moon=new T.Mesh(new T.PlaneGeometry(8,8),new T.ShaderMaterial({side:T.DoubleSide,
    vertexShader:'varying vec2 p;void main(){p=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 p;void main(){float rr=dot(p,p);if(rr>1.)discard;vec3 n=vec3(p,sqrt(max(0.,1.-rr)));float phase=max(0.,dot(n,normalize(vec3(-.88,.13,-.46))));
 float grain=.85+.10*sin(p.x*39.+sin(p.y*25.))+.05*sin(p.y*68.+p.x*23.);gl_FragColor=vec4(vec3(.65,.82,1.)*(.001+phase*grain*4.),1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`}));moon.name='grove-reflected-crescent';moon.position.set(12,10,120);root.add(moon);

  // One bounded linear HDR capture, shared by all guttered ground tiles.
  const reflector=new Reflector(new T.PlaneGeometry(1,1),{textureWidth:384,textureHeight:684,multisample:0,clipBias:.003});
  reflector.name='grove-water-capture';reflector.visible=false;
  const mirrorUniforms=(reflector.material as T.ShaderMaterial).uniforms;
  const uniforms={groveReflection:mirrorUniforms.tDiffuse,groveReflectionMatrix:mirrorUniforms.textureMatrix,groveWaterScroll:{value:0},groveWaterClock:{value:0},groveReflectionGain:{value:1}};
  for(const surface of plates.layers[0]){
    const m=surface.mesh.material;Object.assign(m.uniforms,uniforms);
    m.vertexShader='uniform mat4 groveReflectionMatrix;uniform float groveWaterScroll;varying vec4 groveReflect;varying vec2 groveWaterUV;\n'+m.vertexShader.replace('gl_Position=projectionMatrix',`
      groveReflect=groveReflectionMatrix*vec4(flatWorld.xy,0.,1.);
      groveWaterUV=vec2(uv.x,flatWorld.y/${height}+groveWaterScroll+.5);
      gl_Position=projectionMatrix`);
    m.fragmentShader=`uniform sampler2D groveReflection;uniform float groveWaterClock,groveReflectionGain,artwork;varying vec4 groveReflect;varying vec2 groveWaterUV;${basinMaskGLSL}\n`+m.fragmentShader.replace('gl_FragColor=vec4(lit+',`
      float wet=0.;
      if(groveWaterUV.y>${BASIN_START}&&groveWaterUV.y<${BASIN_END}&&groveReflectionGain>0.){
        vec2 maskTexel=texelSize*3.;
        vec3 maskColor=surface.rgb*.4+(texture2D(map,vUv+vec2(maskTexel.x,0.)).rgb+texture2D(map,vUv-vec2(maskTexel.x,0.)).rgb+texture2D(map,vUv+vec2(0.,maskTexel.y)).rgb+texture2D(map,vUv-vec2(0.,maskTexel.y)).rgb)*.15;
        wet=groveWetness(maskColor,groveWaterUV,artwork)*groveReflectionGain;
      }
      if(wet>.001){
        vec2 p=groveWaterUV*vec2(9.,16.);float t=groveWaterClock;
        vec2 ripple=vec2(sin(dot(p,vec2(2.3,.8))+t*.65)+.45*sin(dot(p,vec2(-3.7,1.4))-t*.93),sin(dot(p,vec2(.9,3.1))-t*.5)+.4*sin(dot(p,vec2(2.1,-2.2))+t*.77));
        vec2 uv=clamp(groveReflect.xy/groveReflect.w+ripple*vec2(.004,.0025),vec2(.002),vec2(.998));
        vec3 reflected=texture2D(groveReflection,uv).rgb;
        reflected=(reflected.r>=0.&&reflected.g>=0.&&reflected.b>=0.)?min(reflected,vec3(16.)):vec3(0.);
        float fresnel=.38+.16*pow(1.-abs(dot(N,V)),3.);
        lit=mix(lit,lit*.55+reflected*fresnel,wet);
      }
      gl_FragColor=vec4(lit+`);
  }
  const viewport=new T.Vector4(),scissor=new T.Vector4(),offset=new T.Matrix4().makeTranslation(0,0,GROVE_GROUND_Z),renderGroup=new T.Group();
  let active=false,priming=false,disposed=false;
  function update(time:number,animationTime:number){
    uniforms.groveWaterScroll.value=groveScroll(time);uniforms.groveWaterClock.value=animationTime;active=basinVisible(time);
    for(let i=0;i<POD_SITES.length;i++){
      const[at,x,z,size]=POD_SITES[i],m=pods.meshes[i];m.scale.setScalar(size);m.position.set(x,(at-.5-groveScroll(time))*height+.49*size,z);m.rotation.z=.05*Math.sin(animationTime*.5+i);
    }
  }
  update(0,0);
  return{root,pods,stars,moon,reflector,uniforms,setPods:pods.setArt,update,prime(value:boolean){priming=value;},
    capture(renderer:T.WebGLRenderer,camera:T.Camera){
      if(disposed||!priming&&!active)return;
      const target=renderer.getRenderTarget(),test=renderer.getScissorTest(),tone=renderer.toneMapping,xr=renderer.xr.enabled,shadow=renderer.shadowMap.autoUpdate;
      renderer.getViewport(viewport);renderer.getScissor(scissor);
      const visible=plates.layers[0].map(s=>s.mesh.visible);
      try{
        scene.updateMatrixWorld();camera.updateMatrixWorld();
        for(const s of plates.layers[0])s.mesh.visible=false;
        reflector.matrixWorld.copy(plane.matrixWorld).multiply(offset);renderer.toneMapping=T.NoToneMapping;renderer.setScissorTest(false);
        reflector.onBeforeRender(renderer,scene,camera,reflector.geometry,reflector.material as T.Material,renderGroup);
      }finally{
        plates.layers[0].forEach((s,i)=>{s.mesh.visible=visible[i];});reflector.visible=false;
        renderer.toneMapping=tone;renderer.xr.enabled=xr;renderer.shadowMap.autoUpdate=shadow;
        renderer.setRenderTarget(target);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(test);
      }
    },
    dispose(){if(disposed)return;disposed=true;uniforms.groveReflection.value=null;pods.release();reflector.dispose();reflector.geometry.dispose();},
  };
}
