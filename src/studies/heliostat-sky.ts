import * as T from 'three';

/** A flat image fills at least 1.5 screens vertically, leaving room for a pan. */
export function heliostatBackdropCrop(viewportAspect: number, imageAspect: number, progress: number) {
  const height = Math.min(2 / 3, imageAspect / viewportAspect);
  const width = height * viewportAspect / imageAspect;
  return { width, height, x: (1 - width) * .25, y: (1 - height) * T.MathUtils.clamp(progress, 0, 1) };
}

/** Screen-space sampling keeps ordinary portrait artwork out of 3D projection. */
export function createHeliostatSky() {
  const material = new T.ShaderMaterial({
    depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: {
      artwork: { value: null }, useArt: { value: false }, imageAspect: { value: 2 / 3 },
      cropSize: { value: new T.Vector2(1, 1) }, cropOffset: { value: new T.Vector2() },
    },
    vertexShader: `varying vec2 imageUV;uniform vec2 cropSize,cropOffset;
      void main(){imageUV=cropOffset+uv*cropSize;gl_Position=vec4(position.xy,1.,1.);}`,
    fragmentShader: `
      uniform sampler2D artwork;uniform bool useArt;uniform float imageAspect;varying vec2 imageUV;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){
        vec2 uv=imageUV;
        vec3 col=vec3(.0017,.004,.009);
        vec2 cell=floor(uv*vec2(540.,820.));
        float star=step(.996,hash(cell))*pow(max(0.,1.-length(fract(uv*vec2(540.,820.))-.5)*2.),3.);
        col+=vec3(.3,.55,.7)*star;
        vec2 q=(uv-vec2(1.13,.53))*vec2(imageAspect,1.)/.64;float r=length(q);
        float disk=1.-smoothstep(.992,1.,r);
        float bands=.94+.06*sin(uv.y*95.+sin(uv.x*18.)*.5);
        vec3 planet=mix(vec3(.018,.072,.095),vec3(.19,.47,.5),sqrt(max(0.,1.-r*r)))*bands;
        col=mix(col,planet,disk);col+=vec3(.035,.13,.16)*exp(-abs(r-1.)*100.);
        if(useArt)col=texture2D(artwork,uv).rgb;
        gl_FragColor=vec4(col,1.);
        #include <colorspace_fragment>
      }`,
  });
  const root = new T.Mesh(new T.PlaneGeometry(2, 2), material);
  root.name = 'flat-uranus-backdrop'; root.frustumCulled = false; root.renderOrder = -1000;
  return {
    root, material,
    update(width: number, height: number, progress: number) {
      const image = material.uniforms.useArt.value ? material.uniforms.artwork.value?.image : undefined;
      const aspect = image?.width && image?.height ? image.width / image.height : 2 / 3;
      const crop = heliostatBackdropCrop(width / height, aspect, progress);
      material.uniforms.imageAspect.value = aspect;
      material.uniforms.cropSize.value.set(crop.width, crop.height);
      material.uniforms.cropOffset.value.set(crop.x, crop.y);
    },
  };
}
