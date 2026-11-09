import * as T from 'three';

/** Uniform scale, fixed horizontal crop, vertical pan only. */
export function backdropCrop(viewAspect: number, imageAspect: number, progress: number) {
  const height=Math.min(2/3,imageAspect/viewAspect),width=height*viewAspect/imageAspect;
  return {width,height,x:(1-width)*.25,y:(1-height)*T.MathUtils.clamp(progress,0,1)};
}

export function createHeliostatBackdrop() {
  const scene=new T.Scene(),owned=new Set<T.Texture>();scene.background=new T.Color(0x020814);
  const material=new T.ShaderMaterial({
    depthTest:false,depthWrite:false,toneMapped:false,
    uniforms:{artwork:{value:null as T.Texture|null},useArt:{value:false},imageAspect:{value:1/3},
      cropSize:{value:new T.Vector2(1,1)},cropOffset:{value:new T.Vector2()},displayScale:{value:new T.Vector2(1,1)}},
    vertexShader:`uniform vec2 cropSize,cropOffset,displayScale;varying vec2 imageUV;
      void main(){imageUV=cropOffset+uv*cropSize;gl_Position=vec4(position.xy*displayScale,1.,1.);}`,
    fragmentShader:`uniform sampler2D artwork;uniform bool useArt;uniform float imageAspect;varying vec2 imageUV;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){
        vec2 uv=imageUV;vec3 col=vec3(.002,.007,.018);
        vec2 cells=uv*vec2(360.,1080.);float star=step(.995,hash(floor(cells)))*max(0.,1.-length(fract(cells)-.5)*2.);
        col+=vec3(.36,.52,.72)*star;
        vec2 q=(uv-vec2(1.05,.39))*vec2(imageAspect,1.)/.31;float r=length(q);
        float disk=1.-smoothstep(.993,1.,r),roundness=sqrt(max(0.,1.-r*r));
        float bands=.97+.03*sin(uv.y*140.+sin(uv.x*24.)*.4);
        vec3 planet=mix(vec3(.025,.25,.32),vec3(.28,.68,.7),.3+.7*roundness)*bands;
        col=mix(col,planet,disk);col+=vec3(.03,.15,.2)*exp(-abs(r-1.)*95.);
        if(useArt)col=texture2D(artwork,uv).rgb;
        gl_FragColor=vec4(col,1.);
        #include <colorspace_fragment>
      }`,
  });
  const root=new T.Mesh(new T.PlaneGeometry(2,2),material);root.frustumCulled=false;
  root.name='scrolling-uranus-backdrop';scene.add(root);
  return {scene,root,material,
    setTexture(texture:T.Texture|undefined,enabled:boolean){
      if(texture&&!owned.has(texture)){owned.add(texture);texture.wrapS=texture.wrapT=T.ClampToEdgeWrapping;texture.needsUpdate=true;}
      material.uniforms.artwork.value=texture??null;material.uniforms.useArt.value=!!texture&&enabled;
    },
    update(width:number,height:number,progress:number,inspect:boolean){
      const image=material.uniforms.useArt.value?material.uniforms.artwork.value?.image:undefined;
      const aspect=image?.width&&image?.height?image.width/image.height:1/3,viewAspect=width/height;
      material.uniforms.imageAspect.value=aspect;
      if(inspect){
        material.uniforms.cropSize.value.set(1,1);material.uniforms.cropOffset.value.set(0,0);
        material.uniforms.displayScale.value.set(Math.min(1,aspect/viewAspect),Math.min(1,viewAspect/aspect));
      }else{
        const crop=backdropCrop(viewAspect,aspect,progress);
        material.uniforms.cropSize.value.set(crop.width,crop.height);material.uniforms.cropOffset.value.set(crop.x,crop.y);
        material.uniforms.displayScale.value.set(1,1);
      }
    },
    releaseTextures(){material.uniforms.artwork.value=null;for(const texture of owned)texture.dispose();owned.clear();},
  };
}
