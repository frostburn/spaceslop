import * as T from 'three';
import {SUN_RADIUS} from './boulevard-sun';
// A sharp scene plus a weak, broad highlight diffusion. HUD remains outside the canvas.
export function createBoulevardGlow(){
 const beauty=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:true,samples:2});beauty.texture.name='boulevard-sharp-scene';beauty.depthTexture=new T.DepthTexture(1,1,T.UnsignedIntType);beauty.depthTexture.name='boulevard-scene-depth';
 const horizontal=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false}),vertical=horizontal.clone();horizontal.texture.name='boulevard-glow-horizontal';vertical.texture.name='boulevard-glow-vertical';
 const vertexShader='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
 // Reject invalid half-float samples before filtering. A single bad highlight
 // must not spread into the rectangular footprint of the separable blur.
 const finiteLight=`vec3 finiteLight(vec3 c){return vec3(c.r>=0.&&c.r<=65504.?min(c.r,64.):0.,c.g>=0.&&c.g<=65504.?min(c.g,64.):0.,c.b>=0.&&c.b<=65504.?min(c.b,64.):0.);}`;
 // A sigma-3 Gaussian combines adjacent taps into nine bilinear fetches.
 const filter=new T.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{source:{value:beauty.texture},step:{value:new T.Vector2()},extract:{value:1}},vertexShader,
  fragmentShader:`uniform sampler2D source;uniform vec2 step;uniform float extract;varying vec2 vUv;
  ${finiteLight}
  vec3 sampleLight(vec2 uv){vec3 c=finiteLight(texture2D(source,uv).rgb);return c*mix(1.,smoothstep(.55,1.20,max(c.r,max(c.g,c.b))),extract);}
  void main(){vec3 c=sampleLight(vUv)*0.13357122;c+=(sampleLight(vUv+step*1.45842952)+sampleLight(vUv-step*1.45842952))*0.23330843;c+=(sampleLight(vUv+step*3.40398481)+sampleLight(vUv-step*3.40398481))*0.13592781;c+=(sampleLight(vUv+step*5.35180578)+sampleLight(vUv-step*5.35180578))*0.05138318;c+=(sampleLight(vUv+step*7.30294072)+sampleLight(vUv-step*7.30294072))*0.01259497;gl_FragColor=vec4(c,1.);}`});
 const composite=new T.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{sharp:{value:beauty.texture},glow:{value:vertical.texture},depth:{value:beauty.depthTexture},strength:{value:.30},sun:{value:new T.Vector4()},heatClock:{value:0},heatDepth:{value:1},heatStrength:{value:0},texel:{value:new T.Vector2()}},vertexShader,
  fragmentShader:`uniform sampler2D sharp,glow,depth;uniform float strength,heatClock,heatDepth,heatStrength;uniform vec4 sun;uniform vec2 texel;varying vec2 vUv;
  ${finiteLight}
  void main(){vec2 uv=vUv;
   if(heatStrength>0.){
    vec2 p=(vUv-sun.xy)/max(sun.zw,vec2(.0001));float r=length(p);
    float envelope=smoothstep(.72,1.,r)*(1.-smoothstep(1.10,1.75,r))*mix(.45,1.,smoothstep(-.6,.8,p.y));
    vec2 directionA=vec2(cos(heatClock*.13),sin(heatClock*.13)),directionB=vec2(cos(1.9-heatClock*.09),sin(1.9-heatClock*.09));
    vec2 curl=vec2(-p.y,p.x)/max(r,.1);
    vec2 flow=.65*directionA*sin(dot(p,directionA)*13.-heatClock*.65+sin(p.y*4.+heatClock*.17));
    flow+=.50*directionB*sin(dot(p,directionB)*17.+heatClock*.43)+.30*curl*sin(r*18.+atan(p.y,p.x)*2.+heatClock*.35);
    vec2 bent=clamp(vUv+flow*envelope*2.8*texel,texel*.5,vec2(1.)-texel*.5);
    // Reject both ends of a bend at solid foreground geometry. This prevents
    // distant heat from dragging a hull or a building edge into the skyline.
    float farPixels=step(heatDepth,texture2D(depth,vUv).r)*step(heatDepth,texture2D(depth,bent).r);
    uv=mix(vUv,bent,farPixels*heatStrength);
   }
   vec3 c=finiteLight(texture2D(sharp,uv).rgb)+finiteLight(texture2D(glow,uv).rgb)*strength;gl_FragColor=vec4(c,1.);
  #include <colorspace_fragment>
  }`});
 const screen=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,0,1),quad=new T.Mesh(new T.PlaneGeometry(2,2),filter);quad.frustumCulled=false;screen.add(quad);
 const size=new T.Vector2(),viewport=new T.Vector4(),scissor=new T.Vector4(),center=new T.Vector3(),right=new T.Vector3(),top=new T.Vector3(),near=new T.Vector3();let width=0,height=0;
 let sun:T.Object3D|undefined,sunClock:{value:number}|undefined;const heat={enabled:true};
 function projectHeat(view:T.Camera){
  const uniforms=composite.uniforms;uniforms.heatStrength.value=0;
  if(!heat.enabled||!sun||!sunClock)return;for(let o:T.Object3D|null=sun;o;o=o.parent)if(!o.visible)return;
  sun.updateWorldMatrix(true,false);center.set(0,0,0).applyMatrix4(sun.matrixWorld);near.copy(center).applyMatrix4(view.matrixWorldInverse);if(near.z>=-1)return;
  center.project(view);right.set(SUN_RADIUS,0,0).applyMatrix4(sun.matrixWorld).project(view);top.set(0,SUN_RADIUS,0).applyMatrix4(sun.matrixWorld).project(view);
  const rx=Math.abs(right.x-center.x)*.5,ry=Math.abs(top.y-center.y)*.5;if(rx<.001||ry<.001||Math.abs(center.x)>1+rx*4||Math.abs(center.y)>1+ry*4)return;
  uniforms.sun.value.set(center.x*.5+.5,center.y*.5+.5,rx,ry);// The warm air column sits in front of the distant ridges, even though the sun is farther away.
  near.z=Math.max(near.z+8,-70);near.applyMatrix4(view.projectionMatrix);uniforms.heatDepth.value=near.z*.5+.5;uniforms.heatClock.value=sunClock.value;uniforms.heatStrength.value=1;uniforms.texel.value.set(1/width,1/height);
 }
 return{targets:[beauty,horizontal,vertical],heat,setSun(source:T.Object3D,time:{value:number}){sun=source;sunClock=time;},
  present(renderer:T.WebGLRenderer,scene:T.Scene,view:T.Camera){
   renderer.getDrawingBufferSize(size);const factor=Math.min(1,1280/size.y,800/size.x),w=Math.max(1,Math.round(size.x*factor)),h=Math.max(1,Math.round(size.y*factor));
   if(w!==width||h!==height){width=w;height=h;beauty.setSize(w,h);horizontal.setSize(Math.ceil(w/2),Math.ceil(h/2));vertical.setSize(horizontal.width,horizontal.height);}
   const oldTarget=renderer.getRenderTarget(),test=renderer.getScissorTest();renderer.getViewport(viewport);renderer.getScissor(scissor);
   try{
    renderer.setScissorTest(false);renderer.setRenderTarget(beauty);renderer.render(scene,view);projectHeat(view);
    quad.material=filter;filter.uniforms.extract.value=1;filter.uniforms.source.value=beauty.texture;filter.uniforms.step.value.set(1/horizontal.width,0);filter.uniformsNeedUpdate=true;
    renderer.setRenderTarget(horizontal);renderer.render(screen,camera);
    filter.uniforms.extract.value=0;filter.uniforms.source.value=horizontal.texture;filter.uniforms.step.value.set(0,.75/vertical.height);filter.uniformsNeedUpdate=true;
    renderer.setRenderTarget(vertical);renderer.render(screen,camera);
    quad.material=composite;renderer.setRenderTarget(oldTarget);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(test);renderer.render(screen,camera);
   }finally{renderer.setRenderTarget(oldTarget);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(test);}
  },dispose(){beauty.dispose();beauty.depthTexture?.dispose();horizontal.dispose();vertical.dispose();quad.geometry.dispose();filter.dispose();composite.dispose();}
 };
}
