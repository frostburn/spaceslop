import * as T from 'three';

/** A direction-locked panorama has rotation but no translational parallax. */
export function createHeliostatSky() {
  const material = new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false,
    uniforms: { artwork: { value: null }, useArt: { value: false } },
    vertexShader: `varying vec3 direction;
      void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `
      uniform sampler2D artwork;uniform bool useArt;varying vec3 direction;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){
        vec3 d=normalize(direction);
        vec2 uv=vec2(.43+atan(d.x,d.y)/1.6,(asin(clamp(d.z,-1.,1.))+1.5)/2.05);
        vec3 col=vec3(.0017,.004,.009);
        vec2 cell=floor(uv*vec2(540.,820.));
        float star=step(.996,hash(cell))*pow(max(0.,1.-length(fract(uv*vec2(540.,820.))-.5)*2.),3.);
        col+=vec3(.3,.55,.7)*star;
        vec2 q=(uv-vec2(1.13,.53))/vec2(.82,.94);float r=length(q);
        float disk=1.-smoothstep(.992,1.,r);
        float bands=.94+.06*sin(uv.y*95.+sin(uv.x*18.)*.5);
        vec3 planet=mix(vec3(.018,.072,.095),vec3(.19,.47,.5),sqrt(max(0.,1.-r*r)))*bands;
        col=mix(col,planet,disk);col+=vec3(.035,.13,.16)*exp(-abs(r-1.)*100.);
        if(useArt)col=texture2D(artwork,clamp(uv,0.,1.)).rgb;
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const root = new T.Mesh(new T.SphereGeometry(300, 48, 32), material);
  root.name = 'fixed-uranus-panorama'; root.frustumCulled = false;
  return { root, material };
}
