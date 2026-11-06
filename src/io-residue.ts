import * as T from 'three';
import {ioGroundHeight,ioNoise} from './io-layout';
import {ioRandom,ioSulfur} from './io-materials';
import {ioSites} from './io-industry';
import {ioSiteX} from './io-placement';

type Transfer={source:T.Group;sink:T.Group};
export function createIoResidue(transfers:readonly Transfer[]){
  const root=new T.Group();root.name='io-settled-residue';
  const rng=ioRandom(91835),n=128,pixels=new Uint8Array(n*n*4);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const u=x/n*2-1,v=y/n*2-1,noise=ioNoise(x/15+10,y/15+20),r=Math.hypot(u,v)+(noise-.5)*.25;
    pixels.set([255,255,255,Math.max(0,1-r)**1.3*(.55+noise*.45)*255],(y*n+x)*4);
  }
  const map=new T.DataTexture(pixels,n,n);map.generateMipmaps=true;map.minFilter=T.LinearMipmapLinearFilter;map.magFilter=T.LinearFilter;map.needsUpdate=true;
  const vertices:number[]=[],uv:number[]=[],colors:number[]=[],indices:number[]=[],stamps:{x:number;y:number;kind:string}[]=[];
  const tint=new T.Color();
  function patch(x:number,y:number,rx:number,ry:number,angle:number,color:number,opacity:number,kind:string){
    if(ioGroundHeight(x,y)<-5.5)return;
    const start=vertices.length/3,steps=12,c=Math.cos(angle),s=Math.sin(angle);tint.setHex(color);stamps.push({x,y,kind});
    for(let j=0;j<=steps;j++)for(let i=0;i<=steps;i++){
      const u=i/steps,v=j/steps,dx=(u-.5)*rx*2,dy=(v-.5)*ry*2;
      const px=x+c*dx-s*dy,py=y+s*dx+c*dy;
      vertices.push(px,py,ioGroundHeight(px,py)+.022);uv.push(u,v);colors.push(tint.r,tint.g,tint.b,opacity);
    }
    for(let j=0;j<steps;j++)for(let i=0;i<steps;i++){const a=start+j*(steps+1)+i,b=a+steps+1;indices.push(a,a+1,b,a+1,b+1,b);}
  }
  for(const[sx,y,kind]of ioSites){
    const x=ioSiteX(sx,y,kind),side=Math.sign(sx);
    patch(x,y,2.0,2.9,rng()*.8,0x8e7742,.38,'settled-dust');
    patch(x-side*.8,y-1.5,.9,1.4,rng(),0x3c3025,.43,'service-grime');
    if(kind==='refinery'||kind==='ruin')patch(x-side*.8,y+1.8,1.15,1.8,-.4,0x29231e,.57,'soot-fallout');
  }
  const grains:T.Vector3[]=[],p=new T.Vector3();
  for(const transfer of transfers)for(const[kind,terminal]of [['source',transfer.source],['sink',transfer.sink]] as const){
    const angle=terminal.rotation.z;
    p.set(kind==='source'?.65:.85,kind==='source'?-.8:.7,0).applyQuaternion(terminal.quaternion).add(terminal.position);
    patch(p.x,p.y,.95,1.65,angle,0xba9a35,.65,'sulfur-spill');
    patch(p.x+.45,p.y-.3,1.0,2.0,angle-.3,0x9c854e,.24,'windblown-powder');
    for(let i=0;i<14;i++){
      const a=rng()*Math.PI*2,r=.25+rng()*.85,x=p.x+Math.cos(a)*r,y=p.y+Math.sin(a)*r;
      const z=ioGroundHeight(x,y);if(z>-5.5)grains.push(new T.Vector3(x,y,z));
    }
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,4));geometry.setIndex(indices);geometry.computeVertexNormals();
  const material=new T.MeshStandardMaterial({map,vertexColors:true,transparent:true,depthWrite:false,roughness:1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  const deposits=new T.Mesh(geometry,material);deposits.name='terrain-deposit-stamps';deposits.receiveShadow=true;deposits.renderOrder=-2;root.add(deposits);
  const grit=new T.InstancedMesh(new T.DodecahedronGeometry(1,0),ioSulfur,grains.length),matrix=new T.Matrix4(),q=new T.Quaternion(),axis=new T.Vector3(0,0,1),scale=new T.Vector3();
  for(let i=0;i<grains.length;i++){
    const size=.035+rng()*.095;scale.set(size*(1+rng()),size,size*.65);p.copy(grains[i]);p.z+=size*.25;q.setFromAxisAngle(axis,rng()*Math.PI*2);matrix.compose(p,q,scale);grit.setMatrixAt(i,matrix);
  }
  grit.name='spilled-sulfur-grit';grit.castShadow=grit.receiveShadow=true;root.add(grit);
  return{root,stamps};
}
