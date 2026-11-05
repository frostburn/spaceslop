import * as T from 'three';

// One bounded scene color/depth capture shared by every crystal. Crystals are
// hidden while writing it; sampling never reads the active framebuffer.
export function createPrismScene() {
  const target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,minFilter:T.LinearFilter,magFilter:T.LinearFilter,
    depthTexture:new T.DepthTexture(1,1,T.UnsignedIntType)});
  const uniforms={sceneColor:{value:target.texture},sceneDepth:{value:target.depthTexture!},sceneProjection:{value:new T.Matrix4()}};
  let actors:T.Object3D[]=[];
  const size=new T.Vector2(),viewport=new T.Vector4();
  return {uniforms,setActors(objects:T.Object3D[]){actors=objects;},
    capture(renderer:T.WebGLRenderer,camera:T.Camera,root:T.Group,field:T.Group,layer:{value:number}) {
      if(!root.visible||!root.parent)return;
      const parent=root.parent;let scene:T.Object3D=parent;while(scene.parent)scene=scene.parent;
      if(!(scene instanceof T.Scene))return;
      renderer.getDrawingBufferSize(size);const scale=Math.min(.75,768/size.y);
      const w=Math.max(1,Math.round(size.x*scale)),h=Math.max(1,Math.round(size.y*scale));
      if(target.width!==w||target.height!==h)target.setSize(w,h);
      uniforms.sceneProjection.value.copy((camera as T.PerspectiveCamera).projectionMatrix);
      const hidden=[...parent.children.filter(n=>n!==root && !(n instanceof T.Light) && !actors.includes(n)),
        ...field.children.filter(n=>n.name.startsWith('prism-crystals-')||n.name==='prism-facet-glints')];
      const states=hidden.map(n=>n.visible),previous=renderer.getRenderTarget(),scissor=renderer.getScissorTest(),oldLayer=layer.value;
      renderer.getViewport(viewport);hidden.forEach(n=>{n.visible=false;});layer.value=1;
      try{renderer.setScissorTest(false);renderer.setRenderTarget(target);renderer.render(scene,camera);}
      finally{hidden.forEach((n,i)=>{n.visible=states[i];});layer.value=oldLayer;renderer.setViewport(viewport);renderer.setRenderTarget(previous);renderer.setScissorTest(scissor);}
    }};
}

export const prismSceneSampling=`
 uniform sampler2D sceneColor,sceneDepth;uniform mat4 sceneProjection;
 // A hit must meet captured geometry, including foreground bullets for
 // reflections. Refraction only walks outward through the back of the facet.
 bool traceScene(vec3 origin,vec3 direction,out vec3 color){
   vec3 p=origin;float distance=0.0;
   for(int i=0;i<28;i++){
     float stride=.10+float(i)*.025;distance+=stride;p=origin+direction*distance;
     vec4 clip=sceneProjection*vec4(p,1.0);if(clip.w<=0.0)return false;
     vec2 uv=clip.xy/clip.w*.5+.5;
     if(any(lessThan(uv,vec2(.002)))||any(greaterThan(uv,vec2(.998))))return false;
     float depth=texture2D(sceneDepth,uv).r;if(depth>=.999999)continue;
     vec4 samplePoint=caveProjectionInverse*vec4(uv*2.0-1.0,depth*2.0-1.0,1.0);
     float gap=samplePoint.z/samplePoint.w-p.z;
     if(abs(gap)<.10+stride*.7){color=safeHDR(texture2D(sceneColor,uv).rgb);return true;}
   }
   return false;
 }
`;
