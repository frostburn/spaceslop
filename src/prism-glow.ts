import * as T from 'three';
import { prismSafe } from './prism-safe';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

// Cave-only linear HDR rendering, two quarter-resolution bloom blurs, then
// highlight roll-off. Fixed pass count and capped targets bound phone fill cost.
export function createPrismGlow(renderer:T.WebGLRenderer) {
  const target=()=>new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:false});
  const sceneTarget=target();sceneTarget.depthBuffer=true;sceneTarget.samples=0; // Avoid driver-dependent half-float MSAA resolves.
  const bright=target(),blurX=target(),blurY=target(),flareSource=target();
  const vertexShader='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0,1);}';
  const extract=new T.ShaderMaterial({uniforms:{source:{value:sceneTarget.texture}},depthTest:false,depthWrite:false,vertexShader,
    fragmentShader:`${prismSafe}
      uniform sampler2D source;varying vec2 vUv;
      void main(){vec3 c=safeHDR(texture2D(source,vUv).rgb);float peak=max(c.r,max(c.g,c.b));
        gl_FragColor=vec4(c*smoothstep(.9,2.0,peak),1.0);}`});
  const blur=new T.ShaderMaterial({uniforms:{source:{value:bright.texture},stepSize:{value:new T.Vector2()}},depthTest:false,depthWrite:false,vertexShader,
    fragmentShader:`${prismSafe}
      uniform sampler2D source;uniform vec2 stepSize;varying vec2 vUv;
      void main(){vec3 c=safeHDR(texture2D(source,vUv).rgb)*.227027;
        c+=(safeHDR(texture2D(source,vUv+stepSize*1.384615).rgb)+safeHDR(texture2D(source,vUv-stepSize*1.384615).rgb))*.316216;
        c+=(safeHDR(texture2D(source,vUv+stepSize*3.230769).rgb)+safeHDR(texture2D(source,vUv-stepSize*3.230769).rgb))*.070270;
        gl_FragColor=vec4(safeHDR(c),1.0);}`});
  // A single-pixel reduction locates the brightest visible source without a
  // synchronous GPU readback or an additional scene render.
  const locate=new T.ShaderMaterial({uniforms:{source:{value:blurY.texture}},depthTest:false,depthWrite:false,vertexShader,
    fragmentShader:`${prismSafe}uniform sampler2D source;varying vec2 vUv;
      void main(){vec2 best=vec2(.5);float peak=0.0;
        for(int y=0;y<32;y++)for(int x=0;x<24;x++){
          vec2 uv=(vec2(float(x),float(y))+.5)/vec2(24.0,32.0);
          vec3 c=safeHDR(texture2D(source,uv).rgb);float light=dot(c,vec3(.2126,.7152,.0722));
          if(light>peak){peak=light;best=uv;}
        }
        gl_FragColor=vec4(best,clamp((peak-.25)*.45,0.0,1.0),1.0);
      }`});
  const composite=new T.ShaderMaterial({uniforms:{source:{value:sceneTarget.texture},glow:{value:blurY.texture},flareSource:{value:flareSource.texture},aspect:{value:1}},depthTest:false,depthWrite:false,vertexShader,
    fragmentShader:`${prismSafe}
      uniform sampler2D source,glow,flareSource;uniform float aspect;varying vec2 vUv;
      void main(){vec3 c=safeHDR(texture2D(source,vUv).rgb)+safeHDR(texture2D(glow,vUv).rgb)*.42;
        vec3 light=texture2D(flareSource,vec2(.5)).rgb;
        vec2 axis=vec2(.5)-light.xy;vec3 ghosts=vec3(0.0);
        for(int i=0;i<7;i++){
          float k=float(i);vec2 center=light.xy+axis*(.35+k*.38);
          vec2 q=(vUv-center)*vec2(aspect,1.0);
          float radius=.016+.040*(.5+.5*sin(k*2.3));float r=length(q);
          float disk=1.0-smoothstep(radius*.55,radius,r);
          float ring=1.0-smoothstep(.0015,.0045,abs(r-radius));
          vec3 tint=vec3(.5)+.5*cos(vec3(.2,2.3,4.4)+k*1.7);
          ghosts+=tint*(disk*.065+ring*.21)*light.z;
        }
        c+=ghosts;
        // ACES-style shoulder retains detail in white crystal highlights.
        c=clamp((c*(2.51*c+.03))/(c*(2.43*c+.59)+.14),0.0,1.0);
        gl_FragColor=vec4(safeHDR(c),1.0);
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
    composite.uniforms.aspect.value=width/height;
    const previous=renderer.getRenderTarget(),scissor=renderer.getScissorTest();renderer.getViewport(viewport);
    try {
      renderer.setScissorTest(false);renderer.setRenderTarget(sceneTarget);renderer.render(scene,camera);
      quad.material=extract;renderer.setRenderTarget(bright);quad.render(renderer);
      quad.material=blur;blur.uniforms.source.value=bright.texture;blur.uniforms.stepSize.value.set(1.6/bright.width,0);
      renderer.setRenderTarget(blurX);quad.render(renderer);
      blur.uniforms.source.value=blurX.texture;blur.uniforms.stepSize.value.set(0,1.6/bright.height);
      renderer.setRenderTarget(blurY);quad.render(renderer);
      quad.material=locate;renderer.setRenderTarget(flareSource);quad.render(renderer);
      quad.material=composite;renderer.setViewport(viewport);renderer.setRenderTarget(previous);quad.render(renderer);
    } finally {renderer.setViewport(viewport);renderer.setRenderTarget(previous);renderer.setScissorTest(scissor);}
  }};
}
