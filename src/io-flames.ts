import * as T from 'three';
import {ioNoise} from './io-layout';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Two perpendicular world-space sheets and a horizontal base remain visible
// through side, overhead and boss views without rotating with the camera.
export function createIoBurnerFlames(burners:T.Vector3[]){
  const root=new T.Group(),n=128,data=new Uint8Array(n*n*4),clock={value:0};root.name='io-burner-flames';
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const a=x/n*Math.PI*2,b=y/n*Math.PI*2;
    const value=ioNoise(12+Math.cos(a)*3+Math.sin(b)*2,12+Math.sin(a)*3+Math.cos(b)*2);
    data.set([value*255,value*255,value*255,255],(y*n+x)*4);
  }
  const noise=new T.DataTexture(data,n,n);noise.wrapS=noise.wrapT=T.RepeatWrapping;noise.generateMipmaps=true;
  noise.minFilter=T.LinearMipmapLinearFilter;noise.magFilter=T.LinearFilter;noise.needsUpdate=true;
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{clock,turbulence:{value:noise}},
    vertexShader:`uniform float clock;attribute float sheet;varying vec2 vUv;varying float phase;
      void main(){vUv=uv;phase=instanceMatrix[3].x*3.1+instanceMatrix[3].y*.7+sheet*.6;
      float h=uv.y;float pulse=.92+.06*sin(clock*9.+phase)+.03*sin(clock*17.+phase*2.);
      float bend=h*h*(sin(clock*8.-h*8.+phase)*.14+sin(clock*13.-h*15.+phase)*.055);
      vec3 p=position;p.xy*=.78*(1.-h*.78)*pulse;p.z=h*2.1*pulse;
      p.xy+=vec2(bend,sin(clock*7.-h*9.+phase)*h*h*.09);
      gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(p,1.);}`,
    fragmentShader:`uniform sampler2D turbulence;uniform float clock;varying vec2 vUv;varying float phase;
      void main(){float h=vUv.y;float n=texture2D(turbulence,vec2(vUv.x*.85+phase,h*1.3-clock*.85)).r;
      float edge=abs(vUv.x-.5)*2.;float body=1.-smoothstep(.30+n*.25,.98,edge);
      float alpha=body*smoothstep(0.,.04,h)*(1.-smoothstep(.60+n*.12,1.,h))*.9;
      float hot=clamp(1.-h*.9-edge*.35+(n-.5)*.3,0.,1.);
      vec3 c=mix(vec3(1.8,.16,.008),vec3(3.8,2.1,.8),smoothstep(.1,.9,hot));
      gl_FragColor=vec4(c,alpha);
      #include <colorspace_fragment>
      }`});
  const sheets=[0,1].map(i=>{const g=new T.PlaneGeometry(1,1,1,12).translate(0,.5,0).rotateX(Math.PI/2).rotateZ(i*Math.PI/2);g.setAttribute('sheet',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(i),1));return g;});
  const cross=mergeGeometries(sheets);sheets.forEach(g=>g.dispose());
  const jets=new T.InstancedMesh(cross,material,burners.length);jets.name='io-burner-jets';jets.frustumCulled=false;root.add(jets);
  const glowMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,uniforms:{clock},
    vertexShader:`uniform float clock;varying vec2 vUv;varying float pulse;
      void main(){vUv=uv;float phase=instanceMatrix[3].x*3.1+instanceMatrix[3].y*.7;pulse=.9+.1*sin(clock*9.+phase);
      gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position.xy*.8*pulse,.1,1.);}`,
    fragmentShader:`varying vec2 vUv;varying float pulse;void main(){float a=pow(max(0.,1.-length(vUv*2.-1.)),2.)*.65;
      gl_FragColor=vec4(vec3(3.4,1.4,.08)*pulse,a);
      #include <colorspace_fragment>
      }`});
  const cores=new T.InstancedMesh(new T.PlaneGeometry(1,1),glowMaterial,burners.length);cores.name='io-burner-cores';cores.frustumCulled=false;root.add(cores);
  const matrix=new T.Matrix4();burners.forEach((p,i)=>{matrix.makeTranslation(p.x,p.y,p.z);jets.setMatrixAt(i,matrix);cores.setMatrixAt(i,matrix);});
  return{root,update(time:number){clock.value=time;}};
}
