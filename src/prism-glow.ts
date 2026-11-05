import * as T from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

// Cave-only linear HDR rendering, two quarter-resolution bloom blurs, then
// highlight roll-off. Fixed pass count and capped targets bound phone fill cost.
export function createPrismGlow(renderer:T.WebGLRenderer) {
  const target=()=>new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:false});
  const sceneTarget=target();sceneTarget.depthBuffer=true;sceneTarget.samples=Math.min(4,renderer.capabilities.maxSamples);
  const bright=target(),blurX=target(),blurY=target();
  const vertexShader='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0,1);}';
  const extract=new T.ShaderMaterial({uniforms:{source:{value:sceneTarget.texture}},depthTest:false,depthWrite:false,vertexShader,
    fragmentShader:`uniform sampler2D source;varying vec2 vUv;
      void main(){vec3 c=texture2D(source,vUv).rgb;float peak=max(c.r,max(c.g,c.b));
        gl_FragColor=vec4(c*smoothstep(.9,2.0,peak),1.0);}`});
  const blur=new T.ShaderMaterial({uniforms:{source:{value:bright.texture},stepSize:{value:new T.Vector2()}},depthTest:false,depthWrite:false,vertexShader,
    fragmentShader:`uniform sampler2D source;uniform vec2 stepSize;varying vec2 vUv;
      void main(){vec3 c=texture2D(source,vUv).rgb*.227027;
        c+=(texture2D(source,vUv+stepSize*1.384615).rgb+texture2D(source,vUv-stepSize*1.384615).rgb)*.316216;
        c+=(texture2D(source,vUv+stepSize*3.230769).rgb+texture2D(source,vUv-stepSize*3.230769).rgb)*.070270;
        gl_FragColor=vec4(c,1.0);}`});
  const composite=new T.ShaderMaterial({uniforms:{source:{value:sceneTarget.texture},glow:{value:blurY.texture}},depthTest:false,depthWrite:false,vertexShader,
    fragmentShader:`uniform sampler2D source,glow;varying vec2 vUv;
      void main(){vec3 c=texture2D(source,vUv).rgb+texture2D(glow,vUv).rgb*.42;
        // ACES-style shoulder retains detail in white crystal highlights.
        c=clamp((c*(2.51*c+.03))/(c*(2.43*c+.59)+.14),0.0,1.0);
        gl_FragColor=vec4(c,1.0);
        #include <colorspace_fragment>
      }`});
  const quad=new FullScreenQuad(extract),size=new T.Vector2(),viewport=new T.Vector4();
  return {render(scene:T.Scene,camera:T.Camera) {
    renderer.getDrawingBufferSize(size);const scale=Math.min(1,1280/size.y);
    const width=Math.max(1,Math.round(size.x*scale)),height=Math.max(1,Math.round(size.y*scale));
    if(sceneTarget.width!==width||sceneTarget.height!==height){
      sceneTarget.setSize(width,height);
      for(const rt of [bright,blurX,blurY])rt.setSize(Math.max(1,Math.ceil(width/4)),Math.max(1,Math.ceil(height/4)));
    }
    const previous=renderer.getRenderTarget(),scissor=renderer.getScissorTest();renderer.getViewport(viewport);
    try {
      renderer.setScissorTest(false);renderer.setRenderTarget(sceneTarget);renderer.render(scene,camera);
      quad.material=extract;renderer.setRenderTarget(bright);quad.render(renderer);
      quad.material=blur;blur.uniforms.source.value=bright.texture;blur.uniforms.stepSize.value.set(1.6/bright.width,0);
      renderer.setRenderTarget(blurX);quad.render(renderer);
      blur.uniforms.source.value=blurX.texture;blur.uniforms.stepSize.value.set(0,1.6/bright.height);
      renderer.setRenderTarget(blurY);quad.render(renderer);
      quad.material=composite;renderer.setViewport(viewport);renderer.setRenderTarget(previous);quad.render(renderer);
    } finally {renderer.setViewport(viewport);renderer.setRenderTarget(previous);renderer.setScissorTest(scissor);}
  }};
}
