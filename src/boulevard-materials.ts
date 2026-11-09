import {texturedSurface} from './encounter-surfaces';
import * as T from 'three';
import {boulevardRandom} from './boulevard-geometry';
export function createBoulevardMaterials(){
 const random=boulevardRandom(661),data=new Uint8Array(128*64*4);
 for(let y=0;y<64;y++)for(let x=0;x<128;x++){
  const v=y/63,h=x/128,band=Math.exp(-(((v-.52)/.12)**2)),pink=Math.exp(-(((h-.23)/.07)**2)),blue=Math.exp(-(((h-.76)/.06)**2));
  const i=(y*128+x)*4;data.set([12+130*band+pink*85,9+70*band+blue*85,28+120*band+blue*110+pink*35,255],i);
 }
 const env=new T.DataTexture(data,128,64);env.mapping=T.EquirectangularReflectionMapping;env.colorSpace=T.SRGBColorSpace;env.needsUpdate=true;
 const chrome=texturedSurface(new T.MeshStandardMaterial({color:0xd8c9dd,roughness:.22,metalness:.56,envMap:env,envMapIntensity:2.6,bumpScale:.02}),.37,4);chrome.userData.shipAlloy=true;
 const shell=new T.MeshStandardMaterial({color:0x575268,roughness:.28,metalness:.45,envMap:env,envMapIntensity:1.8});
 const stone=new T.MeshStandardMaterial({color:0x7d697f,roughness:.77});
 const glass=new T.MeshStandardMaterial({color:0x1a2337,roughness:.12,metalness:.75,envMap:env,envMapIntensity:1.7});
 const bark=new T.MeshStandardMaterial({color:0x695442,roughness:.93});
 const leaf=new T.MeshStandardMaterial({color:0x42815d,roughness:.75,side:T.DoubleSide});
 const pink=new T.MeshBasicMaterial({color:0xf743bd,toneMapped:false}),cyan=new T.MeshBasicMaterial({color:0x41d9f2,toneMapped:false}),amber=new T.MeshBasicMaterial({color:0xffba65,toneMapped:false});
 const wire=new T.ShaderMaterial({name:'boulevard-neon-lattice',side:T.DoubleSide,transparent:true,depthWrite:false,toneMapped:false,uniforms:{tint:{value:new T.Color(0x86ddf4)}},
 vertexShader:`attribute vec3 barycentric;varying vec3 vBary;varying vec3 vTint;uniform vec3 tint;
 void main(){vBary=barycentric;vTint=tint;vec4 p=vec4(position,1.);
 #ifdef USE_INSTANCING
 p=instanceMatrix*p;
 #endif
 #ifdef USE_INSTANCING_COLOR
 vTint*=instanceColor;
 #endif
 gl_Position=projectionMatrix*modelViewMatrix*p;}`,
 fragmentShader:`varying vec3 vBary;varying vec3 vTint;
 void main(){vec3 d=max(fwidth(vBary),vec3(.0001));vec3 a=smoothstep(vec3(0.),d*1.25,vBary),b=smoothstep(vec3(0.),d*5.,vBary);
 float line=1.-min(a.x,min(a.y,a.z)),halo=1.-min(b.x,min(b.y,b.z));
 gl_FragColor=vec4(vTint*(line*1.45+halo*.24)+vec3(.008,.006,.025),.12+line*.87+halo*.17);
 #include <colorspace_fragment>
 }`});
 const roadData=new Uint8Array(128*128*4);for(let i=0;i<128*128;i++){const noise=105+random()*70;roadData.set([noise,noise,noise,255],i*4);}
 const roadMap=new T.DataTexture(roadData,128,128);roadMap.wrapS=roadMap.wrapT=T.RepeatWrapping;roadMap.generateMipmaps=true;roadMap.minFilter=T.LinearMipmapLinearFilter;roadMap.needsUpdate=true;
 return{chrome,shell,stone,glass,bark,leaf,pink,cyan,amber,wire,roadMap};
}
export type BoulevardMaterials=ReturnType<typeof createBoulevardMaterials>;
