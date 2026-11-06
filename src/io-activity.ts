import * as T from 'three';
import {ioRandom} from './io-materials';
import {ioGroundHeight} from './io-layout';

// A finite shared mask, not a high-frequency noise shader at game scale.
function dustMask(){
  const n=128,data=new Uint8Array(n*n*4),r=ioRandom(1193),grid=Array.from({length:256},r);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const u=x/n*15,v=y/n*15,ix=Math.floor(u),iy=Math.floor(v),a=u-ix,b=v-iy;
    const at=(dx:number,dy:number)=>grid[(iy+dy)*16+ix+dx];
    const noise=(at(0,0)*(1-a)+at(1,0)*a)*(1-b)+(at(0,1)*(1-a)+at(1,1)*a)*b;
    const radius=Math.hypot((x/n-.5)*2,(y/n-.5)*2),alpha=Math.max(0,1-radius)**1.5*(.35+noise*.65);
    data.set([190+noise*45,190+noise*45,190+noise*45,alpha*255],(y*n+x)*4);
  }
  const map=new T.DataTexture(data,n,n);map.colorSpace=T.SRGBColorSpace;map.generateMipmaps=true;map.minFilter=T.LinearMipmapLinearFilter;map.needsUpdate=true;return map;
}
export function createIoActivity(){
  const root=new T.Group(),count=48,mask=dustMask();root.name='io-vent-dust';
  const geometry=new T.PlaneGeometry(1,1);const alpha=new T.InstancedBufferAttribute(new Float32Array(count),1);geometry.setAttribute('opacity',alpha);
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{map:{value:mask}},
    vertexShader:`attribute float opacity;varying vec2 vUv;varying float fade;
      void main(){vUv=uv;fade=opacity;vec4 p=modelViewMatrix*instanceMatrix*vec4(0,0,0,1);
      p.xy+=position.xy*vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));gl_Position=projectionMatrix*p;}`,
    fragmentShader:`uniform sampler2D map;varying vec2 vUv;varying float fade;
      void main(){vec4 c=texture2D(map,vUv);float sun=.6+.4*vUv.x;gl_FragColor=vec4(c.rgb*vec3(.65,.60,.51)*sun,c.a*fade);
      #include <colorspace_fragment>
      }`});
  const smoke=new T.InstancedMesh(geometry,material,count);smoke.frustumCulled=false;smoke.name='ballistic-vent-plumes';root.add(smoke);
  const matrix=new T.Matrix4(),p=new T.Vector3(),q=new T.Quaternion(),scale=new T.Vector3();
  const sites=[[-3.4,4],[3.5,26],[-7.5,64],[9,62]].map(([x,y],i)=>({x,y,z:ioGroundHeight(x,y)+.3,large:i>=2}));
  function update(time:number){
    for(let i=0;i<count;i++){
      const site=Math.floor(i/12),j=i%12,t=(time*.075+j/12+site*.31)%1;
      const {x,y,z,large}=sites[site];
      const angle=j*2.39996+site,spread=(large?4.4:1.1)*t;
      p.set(x+Math.cos(angle)*spread,y+Math.sin(angle)*spread,z+(large?13:3.4)*4*t*(1-t));
      const size=(large?1.4:.7)*(1+t*1.6)*Math.sin(t*Math.PI);
      scale.set(size*1.25,size,1);matrix.compose(p,q,scale);smoke.setMatrixAt(i,matrix);alpha.setX(i,Math.sin(t*Math.PI)*(large?.26:.17));
    }
    smoke.instanceMatrix.needsUpdate=true;alpha.needsUpdate=true;
  }
  update(0);return{root,update};
}
