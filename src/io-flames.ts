import * as T from 'three';
import {ioNoise} from './io-layout';

// Keep the axial flame until nearly overhead; the mouth flame stays visible.
// Both use the same root, clock and turbulence field; there is no crossed sheet.
const sideFadeStart=.90,sideFadeEnd=.99;
export function ioFlameTopWeight(cosElevation:number){const t=Math.max(0,Math.min(1,(Math.abs(cosElevation)-sideFadeStart)/(sideFadeEnd-sideFadeStart)));return t*t*(3-2*t);}
export function createIoBurnerFlames(burners:T.Vector3[]){
  const root=new T.Group(),n=128,data=new Uint8Array(n*n*4),clock={value:0};root.name='io-burner-flames';
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const a=x/n*Math.PI*2,b=y/n*Math.PI*2;
    const value=ioNoise(12+Math.cos(a)*3+Math.sin(b)*2,12+Math.sin(a)*3+Math.cos(b)*2);
    data.set([value*255,value*255,value*255,255],(y*n+x)*4);
  }
  const noise=new T.DataTexture(data,n,n);noise.wrapS=noise.wrapT=T.RepeatWrapping;noise.generateMipmaps=true;
  noise.minFilter=T.LinearMipmapLinearFilter;noise.magFilter=T.LinearFilter;noise.needsUpdate=true;
  const elevation=`float topView(mat4 transform){vec3 axis=normalize(mat3(transform)*vec3(0.,0.,1.));
    vec3 eye=projectionMatrix[3][3]>.5?vec3(0.,0.,1.):normalize(-(transform*vec4(0.,0.,0.,1.)).xyz);
    return smoothstep(${sideFadeStart.toFixed(2)},${sideFadeEnd.toFixed(2)},abs(dot(axis,eye)));}`;
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{clock,turbulence:{value:noise}},
    vertexShader:`uniform float clock;varying vec2 vUv;varying float phase;varying float fade;
      ${elevation}
      void main(){vUv=uv;phase=instanceMatrix[3].x*3.1+instanceMatrix[3].y*.7;
      mat4 transform=modelViewMatrix*instanceMatrix;fade=1.-topView(transform);
      float h=uv.y;float pulse=.92+.06*sin(clock*9.+phase)+.03*sin(clock*17.+phase*2.);
      vec4 p=transform*vec4(0.,0.,h*2.1*pulse,1.);
      vec3 axis=mat3(transform)*vec3(0.,0.,1.);vec2 side=length(axis.xy)>.05?normalize(vec2(axis.y,-axis.x)):vec2(1.,0.);
      float bend=h*h*(sin(clock*8.-h*8.+phase)*.14+sin(clock*13.-h*15.+phase)*.055);
      p.xy+=side*(position.x*.78*(1.-h*.78)*pulse+bend);
      gl_Position=projectionMatrix*p;}`,
    fragmentShader:`uniform sampler2D turbulence;uniform float clock;varying vec2 vUv;varying float phase;varying float fade;
      void main(){float h=vUv.y;float n=texture2D(turbulence,vec2(vUv.x*.85+phase,h*1.3-clock*.85)).r;
      float edge=abs(vUv.x-.5)*2.;float body=1.-smoothstep(.30+n*.25,.98,edge);
      float alpha=body*smoothstep(0.,.04,h)*(1.-smoothstep(.60+n*.12,1.,h))*.9;
      float hot=clamp(1.-h*.9-edge*.35+(n-.5)*.3,0.,1.);
      vec3 c=mix(vec3(1.8,.16,.008),vec3(3.8,2.1,.8),smoothstep(.1,.9,hot));
      gl_FragColor=vec4(c,alpha*fade);
      #include <colorspace_fragment>
      }`});
  const jets=new T.InstancedMesh(new T.PlaneGeometry(1,1,1,12),material,burners.length);jets.name='io-burner-jets';jets.frustumCulled=false;root.add(jets);
  const topMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{clock,turbulence:{value:noise}},
    vertexShader:`uniform float clock;varying vec2 vUv;varying float phase;varying float fade;
      ${elevation}
      void main(){vUv=uv;phase=instanceMatrix[3].x*3.1+instanceMatrix[3].y*.7;mat4 transform=modelViewMatrix*instanceMatrix;fade=.9+.1*topView(transform);
      float pulse=.92+.06*sin(clock*9.+phase)+.03*sin(clock*17.+phase*2.);
      gl_Position=projectionMatrix*transform*vec4(position.xy*.9*pulse,.06,1.);}`,
    fragmentShader:`uniform sampler2D turbulence;uniform float clock;varying vec2 vUv;varying float phase;varying float fade;
      void main(){vec2 p=vUv*2.-1.;
      // Two closed orbits stir the noise without a persistent scrolling direction.
      float cycle=clock*1.8+phase;
      vec2 orbitA=vec2(cos(cycle),sin(cycle))*.19;
      vec2 orbitB=vec2(cos(-cycle+1.7),sin(-cycle+1.7))*.23;
      float n=texture2D(turbulence,p*.55+vec2(phase)+orbitA).r*.55
        +texture2D(turbulence,p.yx*.8-vec2(phase)+orbitB).r*.45;
      float radius=length(p)+(n-.5)*.35;float a=(1.-smoothstep(.35,.95,radius))*.88*fade;
      float hot=clamp(1.-radius+(n-.5)*.25,0.,1.);
      vec3 c=mix(vec3(1.8,.16,.008),vec3(3.8,2.1,.8),smoothstep(.1,.9,hot));gl_FragColor=vec4(c,a);
      #include <colorspace_fragment>
      }`});
  const cores=new T.InstancedMesh(new T.PlaneGeometry(1,1),topMaterial,burners.length);cores.name='io-burner-cores';cores.frustumCulled=false;root.add(cores);
  const matrix=new T.Matrix4();burners.forEach((p,i)=>{matrix.makeTranslation(p.x,p.y,p.z);jets.setMatrixAt(i,matrix);cores.setMatrixAt(i,matrix);});
  return{root,update(time:number){clock.value=time;}};
}
