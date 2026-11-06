import * as T from 'three';
import {ioNoise} from './io-layout';

// A single view-aligned plane split at the chimney mouth: rounded lower half,
// upper half blending from a rising jet to the matching rounded cap.
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
  const vertexShader=`uniform float clock;uniform float lowerHalf;
    varying vec2 point;varying float phase;varying float weight;varying float jetHeight;
    void main(){
      phase=instanceMatrix[3].x*3.1+instanceMatrix[3].y*.7;
      mat4 transform=modelViewMatrix*instanceMatrix;
      vec3 axis=normalize(mat3(transform)*vec3(0.,0.,1.));
      vec3 eye=projectionMatrix[3][3]>.5?vec3(0.,0.,1.):normalize(-(transform*vec4(0.,0.,0.,1.)).xyz);
      weight=smoothstep(${sideFadeStart.toFixed(2)},${sideFadeEnd.toFixed(2)},abs(dot(axis,eye)));
      float pulse=.92+.06*sin(clock*9.+phase)+.03*sin(clock*17.+phase*2.);
      float radius=.39*pulse;
      jetHeight=max(length(axis.xy)*2.1*pulse,radius);
      vec2 up=length(axis.xy)>.001?normalize(axis.xy):vec2(0.,1.);
      vec2 right=vec2(up.y,-up.x);
      // Both halves meet at precisely the same diameter, width and depth.
      float y=lowerHalf>.5?(uv.y-1.)*radius:uv.y*jetHeight;
      float x=position.x*radius*2.;point=vec2(x,y)/radius;
      jetHeight/=radius;
      vec4 p=transform*vec4(0.,0.,.06,1.);
      // Bring the composite just in front of the mouth rim, along the eye ray,
      // so the lower semicircle stays visible without shifting its screen anchor.
      p.xyz+=eye*radius*.75;
      p.xy+=right*x+up*y;
      gl_Position=projectionMatrix*p;
    }`;
  const fragmentShader=`uniform sampler2D turbulence;uniform float clock;uniform float lowerHalf;
    varying vec2 point;varying float phase;varying float weight;varying float jetHeight;
    vec4 flame(vec2 p,float tip){
      float cycle=clock*1.8+phase;
      vec2 orbitA=vec2(cos(cycle),sin(cycle))*.19;
      vec2 orbitB=vec2(cos(-cycle+1.7),sin(-cycle+1.7))*.23;
      float n=texture2D(turbulence,p*.55+vec2(phase)+orbitA).r*.55
        +texture2D(turbulence,p.yx*.8-vec2(phase)+orbitB).r*.45;
      float radius=length(p)+(n-.5)*.35;
      float alpha=(1.-smoothstep(.35,.95,radius))*.88*tip;
      float hot=clamp(1.-radius+(n-.5)*.25,0.,1.);
      return vec4(mix(vec3(1.8,.16,.008),vec3(3.8,2.1,.8),smoothstep(.1,.9,hot)),alpha);
    }
    void main(){
      vec4 rounded=flame(point,1.);
      if(lowerHalf>.5){gl_FragColor=rounded;}
      else{
        float h=point.y/jetHeight;
        float bend=h*h*(sin(clock*8.-h*8.+phase)*.22+sin(clock*13.-h*15.+phase)*.08);
        vec4 side=flame(vec2((point.x-bend)/max(.2,1.-h*.75),h*.8),1.-smoothstep(.65,1.,h));
        // Premultiplied interpolation avoids a dark halo where the cap ends.
        float a=mix(side.a,rounded.a,weight);
        vec3 c=mix(side.rgb*side.a,rounded.rgb*rounded.a,weight)/max(a,.0001);
        gl_FragColor=vec4(c,a);
      }
      #include <colorspace_fragment>
    }`;
  const makeHalf=(lower:boolean)=>new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,
    uniforms:{clock,turbulence:{value:noise},lowerHalf:{value:lower?1:0}},vertexShader,fragmentShader});
  const jets=new T.InstancedMesh(new T.PlaneGeometry(1,1,1,12),makeHalf(false),burners.length);jets.name='io-burner-jets';jets.frustumCulled=false;root.add(jets);
  const cores=new T.InstancedMesh(new T.PlaneGeometry(1,1),makeHalf(true),burners.length);cores.name='io-burner-cores';cores.frustumCulled=false;root.add(cores);
  const matrix=new T.Matrix4();burners.forEach((p,i)=>{matrix.makeTranslation(p.x,p.y,p.z);jets.setMatrixAt(i,matrix);cores.setMatrixAt(i,matrix);});
  return{root,update(time:number){clock.value=time;}};
}
