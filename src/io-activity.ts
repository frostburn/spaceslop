import * as T from 'three';
import {ioRandom} from './io-materials';
import {ioGroundHeight,IO_CALDERA_Y} from './io-layout';
import type {IoVent} from './io-industry';

// A finite shared mask, not a high-frequency noise shader at game scale.
function dustMask(){
  const n=128,data=new Uint8Array(n*n*4),r=ioRandom(1193),grid=Array.from({length:256},r);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const u=x/n*15,v=y/n*15,ix=Math.floor(u),iy=Math.floor(v),a=u-ix,b=v-iy;
    const at=(dx:number,dy:number)=>grid[(iy+dy)*16+ix+dx];
    const noise=(at(0,0)*(1-a)+at(1,0)*a)*(1-b)+(at(0,1)*(1-a)+at(1,1)*a)*b;
    const radius=Math.hypot((x/n-.5)*2,(y/n-.5)*2),alpha=Math.max(0,1-radius)**.8*(.6+noise*.4);
    data.set([190+noise*45,190+noise*45,190+noise*45,alpha*255],(y*n+x)*4);
  }
  const map=new T.DataTexture(data,n,n);map.colorSpace=T.SRGBColorSpace;map.generateMipmaps=true;map.minFilter=T.LinearMipmapLinearFilter;map.magFilter=T.LinearFilter;map.needsUpdate=true;return map;
}
export function createIoActivity(exhaust:IoVent[]=[],burners:T.Vector3[]=[]){
  const sites:IoVent[]=[...exhaust,...[[-3.4,8],[3.5,36],[-3.7,82],[3.6,116],[-8,IO_CALDERA_Y+8],[9,IO_CALDERA_Y+6]].map(([x,y],i)=>({x,y,z:ioGroundHeight(x,y)+.3,height:i>=4?10:3.4,spread:i>=4?4:1.1,size:i>=4?1.4:.7,opacity:i>=4?.42:.30}))];
  const root=new T.Group(),count=sites.length*12,mask=dustMask();root.name='io-vent-dust';
  const geometry=new T.PlaneGeometry(1,1);const alpha=new T.InstancedBufferAttribute(new Float32Array(count),1);geometry.setAttribute('opacity',alpha);
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{map:{value:mask}},
    vertexShader:`attribute float opacity;varying vec2 vUv;varying float fade;
      void main(){vUv=uv;fade=opacity;vec4 p=modelViewMatrix*instanceMatrix*vec4(0,0,0,1);
      p.xy+=position.xy*vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));gl_Position=projectionMatrix*p;}`,
    fragmentShader:`uniform sampler2D map;varying vec2 vUv;varying float fade;
      void main(){vec4 c=texture2D(map,vUv);float sun=.7+.3*vUv.x;gl_FragColor=vec4(c.rgb*vec3(1.1,1.,.86)*sun,c.a*fade);
      #include <colorspace_fragment>
      }`});
  const smoke=new T.InstancedMesh(geometry,material,count);smoke.frustumCulled=false;smoke.name='ballistic-vent-plumes';root.add(smoke);
  const matrix=new T.Matrix4(),p=new T.Vector3(),q=new T.Quaternion(),scale=new T.Vector3();
  const flameMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{clock:{value:0}},
    vertexShader:`uniform float clock;varying float height;varying float flicker;
      void main(){height=position.z/1.6;float phase=instanceMatrix[3].x*13.+instanceMatrix[3].y;
      flicker=.78+.22*sin(clock*21.+phase);vec3 p=position;p.xy*=.85+.15*sin(clock*17.+height*13.+phase);p.z*=flicker;
      gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(p,1.);}`,
    fragmentShader:`varying float height;varying float flicker;void main(){float a=(1.-smoothstep(.15,1.,height))*.65;
      vec3 c=mix(vec3(3.5,1.9,.65),vec3(3.,.7,.04),smoothstep(.05,.45,height));gl_FragColor=vec4(c*flicker,a);
      #include <colorspace_fragment>
    }`});
  const jets=new T.InstancedMesh(new T.CylinderGeometry(.015,.23,1.6,10,6,true).rotateX(Math.PI/2).translate(0,0,.8),flameMaterial,burners.length);
  jets.name='io-burner-jets';jets.frustumCulled=false;root.add(jets);
  burners.forEach((position,i)=>{matrix.makeTranslation(position.x,position.y,position.z);jets.setMatrixAt(i,matrix);});
  function update(time:number){
    flameMaterial.uniforms.clock.value=time;
    for(let i=0;i<count;i++){
      const site=Math.floor(i/12),j=i%12,t=(time*.075+j/12+site*.31)%1;
      const vent=sites[site],{x,y,z}=vent;
      const angle=j*2.39996+site,spread=vent.spread*t;
      p.set(x+Math.cos(angle)*spread,y+Math.sin(angle)*spread,z+vent.height*4*t*(1-t));
      const size=vent.size*(1+t*1.6)*Math.sin(t*Math.PI);
      scale.set(size*1.25,size,1);matrix.compose(p,q,scale);smoke.setMatrixAt(i,matrix);alpha.setX(i,Math.sin(t*Math.PI)*vent.opacity);
    }
    smoke.instanceMatrix.needsUpdate=true;alpha.needsUpdate=true;
  }
  update(0);return{root,update};
}
