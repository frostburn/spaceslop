import {vectorMaterial} from './boulevard-vectors';
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
 const windows=new T.MeshStandardMaterial({color:0x86bdd0,roughness:.16,metalness:.28,envMap:env,envMapIntensity:1.5,transparent:true,opacity:.23,depthWrite:false});
 const interior=new T.MeshStandardMaterial({color:0x887987,roughness:.8,emissive:0x543628,emissiveIntensity:.24});
 const bark=new T.MeshStandardMaterial({color:0x695442,roughness:.93});
 const leaf=new T.MeshStandardMaterial({color:0x42815d,roughness:.75,side:T.DoubleSide});
 const pink=new T.MeshBasicMaterial({color:0xf743bd,toneMapped:false}),cyan=new T.MeshBasicMaterial({color:0x41d9f2,toneMapped:false}),amber=new T.MeshBasicMaterial({color:0xffba65,toneMapped:false});
 const streetLamp=new T.MeshBasicMaterial({color:new T.Color(0xf3e9ff).multiplyScalar(3.2),toneMapped:false});
 const backFaces=new T.MeshBasicMaterial({color:0x0d071d,side:T.BackSide});
 const wire=vectorMaterial();
 const roadData=new Uint8Array(128*128*4);for(let i=0;i<128*128;i++){const noise=105+random()*70;roadData.set([noise,noise,noise,255],i*4);}
 const roadMap=new T.DataTexture(roadData,128,128);roadMap.wrapS=roadMap.wrapT=T.RepeatWrapping;roadMap.generateMipmaps=true;roadMap.minFilter=T.LinearMipmapLinearFilter;roadMap.needsUpdate=true;
 return{chrome,shell,stone,glass,windows,interior,bark,leaf,pink,cyan,amber,wire,backFaces,streetLamp,roadMap};
}
export type BoulevardMaterials=ReturnType<typeof createBoulevardMaterials>;
