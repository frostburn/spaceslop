import * as T from 'three';
// A sharp scene plus a weak, broad highlight diffusion. HUD remains outside the canvas.
export function createBoulevardGlow(){
 const beauty=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:true,samples:2});beauty.texture.name='boulevard-sharp-scene';
 const horizontal=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false}),vertical=horizontal.clone();horizontal.texture.name='boulevard-glow-horizontal';vertical.texture.name='boulevard-glow-vertical';
 const vertexShader='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
 // A sigma-3 Gaussian combines adjacent taps into nine bilinear fetches.
 const filter=new T.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{source:{value:beauty.texture},step:{value:new T.Vector2()},extract:{value:1}},vertexShader,
  fragmentShader:`uniform sampler2D source;uniform vec2 step;uniform float extract;varying vec2 vUv;
  vec3 sampleLight(vec2 uv){vec3 c=texture2D(source,uv).rgb;return c*mix(1.,smoothstep(.55,1.20,max(c.r,max(c.g,c.b))),extract);}
  void main(){vec3 c=sampleLight(vUv)*0.13357122;c+=(sampleLight(vUv+step*1.45842952)+sampleLight(vUv-step*1.45842952))*0.23330843;c+=(sampleLight(vUv+step*3.40398481)+sampleLight(vUv-step*3.40398481))*0.13592781;c+=(sampleLight(vUv+step*5.35180578)+sampleLight(vUv-step*5.35180578))*0.05138318;c+=(sampleLight(vUv+step*7.30294072)+sampleLight(vUv-step*7.30294072))*0.01259497;gl_FragColor=vec4(c,1.);}`});
 const composite=new T.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{sharp:{value:beauty.texture},glow:{value:vertical.texture},strength:{value:.30}},vertexShader,
  fragmentShader:`uniform sampler2D sharp,glow;uniform float strength;varying vec2 vUv;void main(){vec3 c=texture2D(sharp,vUv).rgb+texture2D(glow,vUv).rgb*strength;gl_FragColor=vec4(c,1.);
  #include <colorspace_fragment>
  }`});
 const screen=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,0,1),quad=new T.Mesh(new T.PlaneGeometry(2,2),filter);quad.frustumCulled=false;screen.add(quad);
 const size=new T.Vector2(),viewport=new T.Vector4(),scissor=new T.Vector4();let width=0,height=0;
 return{targets:[beauty,horizontal,vertical],
  present(renderer:T.WebGLRenderer,scene:T.Scene,view:T.Camera){
   renderer.getDrawingBufferSize(size);const factor=Math.min(1,1280/size.y,800/size.x),w=Math.max(1,Math.round(size.x*factor)),h=Math.max(1,Math.round(size.y*factor));
   if(w!==width||h!==height){width=w;height=h;beauty.setSize(w,h);horizontal.setSize(Math.ceil(w/2),Math.ceil(h/2));vertical.setSize(horizontal.width,horizontal.height);}
   const oldTarget=renderer.getRenderTarget(),test=renderer.getScissorTest();renderer.getViewport(viewport);renderer.getScissor(scissor);
   try{
    renderer.setScissorTest(false);renderer.setRenderTarget(beauty);renderer.render(scene,view);
    quad.material=filter;filter.uniforms.extract.value=1;filter.uniforms.source.value=beauty.texture;filter.uniforms.step.value.set(1/horizontal.width,0);filter.uniformsNeedUpdate=true;
    renderer.setRenderTarget(horizontal);renderer.render(screen,camera);
    filter.uniforms.extract.value=0;filter.uniforms.source.value=horizontal.texture;filter.uniforms.step.value.set(0,.75/vertical.height);filter.uniformsNeedUpdate=true;
    renderer.setRenderTarget(vertical);renderer.render(screen,camera);
    quad.material=composite;renderer.setRenderTarget(oldTarget);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(test);renderer.render(screen,camera);
   }finally{renderer.setRenderTarget(oldTarget);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(test);}
  },dispose(){beauty.dispose();horizontal.dispose();vertical.dispose();quad.geometry.dispose();filter.dispose();composite.dispose();}
 };
}
