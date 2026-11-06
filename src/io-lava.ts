import * as T from 'three';
import {ioNoise} from './io-layout';

// Mip-filtered advected thermal detail: no screen-space sine/checker pattern.
export function createIoLava(){
  const n=128,pixels=new Uint8Array(n*n*4);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    // Periodic domain keeps filtered repeats continuous.
    const a=x/n*Math.PI*2,b=y/n*Math.PI*2;
    const u=12+Math.cos(a)*3+Math.sin(b)*2,v=12+Math.sin(a)*3+Math.cos(b)*2;
    const value=ioNoise(u,v)*.65+ioNoise(u*3,v*3)*.35;
    pixels.set([value*255,value*255,value*255,255],(y*n+x)*4);
  }
  const map=new T.DataTexture(pixels,n,n);map.wrapS=map.wrapT=T.RepeatWrapping;map.generateMipmaps=true;map.minFilter=T.LinearMipmapLinearFilter;map.magFilter=T.LinearFilter;map.needsUpdate=true;
  const material=new T.ShaderMaterial({uniforms:{clock:{value:0},thermal:{value:map}},
    vertexShader:`varying vec2 ground;void main(){ground=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 ground;uniform sampler2D thermal;uniform float clock;
      void main(){vec2 uv=ground*.16;vec2 flow=vec2(clock*.023,-clock*.017);
      float warp=texture2D(thermal,uv*.48+flow*.3).r;
      float a=texture2D(thermal,uv+flow+vec2(warp*.3)).r;
      float b=texture2D(thermal,uv*2.6-flow*.6).r;
      float heat=smoothstep(.25,.78,a*.72+b*.28);
      float vein=1.-smoothstep(.015,.075,abs(a-.51));
      vec3 c=mix(vec3(.35,.012,.001),vec3(3.6,1.1,.025),heat)+vec3(1.6,.45,.02)*vein;
      gl_FragColor=vec4(c,1.);
      #include <colorspace_fragment>
      }`});
  return{material,update(time:number){material.uniforms.clock.value=time;}};
}
