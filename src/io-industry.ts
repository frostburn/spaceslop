import * as T from 'three';
import {IoDetail} from './io-detail';
import {ioSiloWall} from './io-silo';
import {createIoConveyorTerminal} from './io-conveyor';
import {ioGroundHeight,ioChannel,IO_BREACH_Y,IO_HEIGHT} from './io-layout';
import {ioSilo as ioCeramic,ioSiloBand as ioBand,ioSafety,ioSteel,ioChrome,ioDark,ioRust,ioHot,ioSulfur} from './io-materials';

export interface IoVent {x:number;y:number;z:number;height:number;spread:number;size:number;opacity:number}
export const ioSites=[
  [-4,3,'pump'],[4.2,17,'pump'],[-4.1,31,'quarry'],[4.2,43,'quarry'],
  [-4,54,'quarry'],[4.4,64,'yard'],[-3.9,75,'yard'],[4.1,85,'yard'],
  [-3.8,97,'refinery'],[4.0,99,'yard'],[4.3,108,'refinery'],[-4,109,'yard'],[-4,119,'refinery'],[4,120,'ruin'],
  [4.2,130,'ruin'],[-4.0,129,'refinery'],[-3.9,138,'refinery'],[4.1,140,'refinery'],[4.2,146,'ruin'],[-4.1,148,'ruin'],
  [-3.8,155,'winch'],[4,161,'winch'],
] as const;

function beltTexture(){
  const w=64,h=128,data=new Uint8Array(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const rib=y%16<3,edge=x<4||x>59,c=edge?74:rib?110:31+(x*7+y*11)%12;
    data.set([c,c,c,255],(y*w+x)*4);
  }
  const map=new T.DataTexture(data,w,h);map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;
  map.generateMipmaps=true;map.minFilter=T.LinearMipmapLinearFilter;map.magFilter=T.LinearFilter;map.needsUpdate=true;return map;
}

export function createIoIndustry(){
  const root=new T.Group();root.name='io-industrial-route';
  const vents:IoVent[]=[],burners:T.Vector3[]=[],belts:{a:T.Vector3;b:T.Vector3;q:T.Quaternion;up:T.Vector3;length:number;cycleLength:number;source:T.Group;sink:T.Group}[]=[];
  const beltMap=beltTexture(),beltMaterial=new T.MeshStandardMaterial({map:beltMap,bumpMap:beltMap,bumpScale:.035,roughness:.85});
  for(const [sx,y,kind]of ioSites){
    const side=Math.sign(sx),x=sx-side*.55+ioChannel(y),z=ioGroundHeight(x,y),assembly=new T.Group();
    assembly.position.set(x,y,z);assembly.name='io-site-'+kind;root.add(assembly);
    const d=new IoDetail();
    const box=(x:number,y:number,z:number,w:number,depth:number,h:number,m:T.Material)=>d.box(x,y,z,w,depth,h,m);
    function platform(cx:number,cy:number,w:number,depth:number,h=.45){
      box(cx,cy,h,w,depth,.15,ioSteel);
      for(let k=-w/2+.08;k<w/2;k+=.19)box(cx+k,cy,h+.09,.035,depth,.03,ioDark);
      for(const dx of [-w/2+.1,w/2-.1])for(const dy of [-depth/2+.1,depth/2-.1]){
        d.rod([cx+dx,cy+dy,ioGroundHeight(x+cx+dx,y+cy+dy)-z],[cx+dx,cy+dy,h],.065,ioSteel);
        d.rod([cx+dx,cy+dy,h],[cx+dx,cy+dy,h+.65],.028,ioSafety);
      }
      for(const dy of [-depth/2,depth/2])d.rod([cx-w/2,cy+dy,h+.65],[cx+w/2,cy+dy,h+.65],.025,ioSafety);
      d.rod([cx+side*w/2,cy-depth/2,h+.65],[cx+side*w/2,cy+depth/2,h+.65],.025,ioSafety);
    }
    function tank(cx:number,cy:number,r:number,h:number,base=.6,damaged=false){
      const phase=side>0?.3:Math.PI+.3,arc=damaged?4.8:Math.PI*2;
      for(const part of ioSiloWall(r,h,base,phase,arc))d.geometry(part.geometry.translate(cx,cy,0),part.band?ioBand:ioCeramic);
      d.geometry(new T.SphereGeometry(r,24,12,phase,arc,0,Math.PI/2).rotateX(Math.PI/2).scale(1,1,.65).translate(cx,cy,base+h),ioCeramic);
      for(const level of [base+.12,base+h*.78])d.geometry(new T.TorusGeometry(r+.04,.045,5,24).translate(cx,cy,level),ioChrome);
      for(let j=0;j<8;j++){
        const a=j/8*Math.PI*2,px=cx+Math.cos(a)*(r+.03),py=cy+Math.sin(a)*(r+.03);
        d.rod([px,py,base],[px,py,base+h],.022,ioRust);
      }
      const cap=base+h+r*.65;
      d.pipe([[cx,cy,cap],[cx,cy+.45,cap+.12],[cx-side*(r+.5),cy+.8,base+.4]],.085,ioSteel);
      if(damaged){
        d.geometry(new T.CylinderGeometry(r*.93,r*.93,h*.65,16).rotateX(Math.PI/2).translate(cx,cy,base+h*.325),ioDark);
        for(let j=0;j<4;j++){
          const a=phase+4.85+j*.31,px=cx-Math.cos(a)*r,py=cy-Math.sin(a)*r;
          d.rod([px,py,base],[px+side*.15,py,base+h+r*.35],.045,ioRust);
        }
        d.geometry(new T.BoxGeometry(r,.65,.045).rotateY(.45).rotateZ(side*.35).translate(cx-side*r*.6,cy+.4,cap-.12),ioCeramic);
        box(cx-side*r*.8,cy-.25,base+h*.7,r*.5,.65,.06,ioDark);
        for(let j=0;j<4;j++)box(cx-side*(r+.12),cy-.45+j*.2,base+h*.6,.08,.08,h*.9,ioRust);
      }
    }
    function hopper(){
      const vertices:number[]=[],uvs:number[]=[];
      const corner=[[-1,-1],[1,-1],[1,1],[-1,1]];
      for(let i=0;i<4;i++){
        const a=corner[i],b=corner[(i+1)%4],v=[[a[0],a[1],1.85],[b[0],b[1],1.85],[a[0]*.35,a[1]*.35,.7],[b[0]*.35,b[1]*.35,.7]];
        for(const j of [0,1,2,1,3,2]){vertices.push(...v[j]);uvs.push(j%2,Math.floor(j/2));}
        d.rod([a[0],a[1],1.9],[b[0],b[1],1.9],.06,ioRust);
      }
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.computeVertexNormals();d.geometry(g,ioCeramic);
      box(0,0,.68,.74,.74,.08,ioDark);
      for(let j=0;j<5;j++)d.geometry(new T.DodecahedronGeometry(.18,0).translate(Math.sin(j*4)*.2,Math.cos(j*2)*.2,.83),ioSulfur);
    }
    function stack(cx:number,cy:number,h:number){
      d.rod([cx,cy,.5],[cx,cy,h],.17,ioRust);
      for(let j=1;j<h;j+=.7)d.geometry(new T.TorusGeometry(.21,.035,5,12).translate(cx,cy,j),ioSteel);
      d.geometry(new T.CylinderGeometry(.23,.24,.15,12).rotateX(Math.PI/2).translate(cx,cy,h),ioDark);
      burners.push(new T.Vector3(x+cx,y+cy,z+h+.08));
      const exhaustZ=Math.min(z+h+1.65,IO_HEIGHT-1);
      vents.push({x:x+cx,y:y+cy,z:exhaustZ,height:Math.min(2.2,IO_HEIGHT-.3-exhaustZ),spread:.8,size:.75,opacity:.4});
    }
    function pipeBranch(cx:number,cy:number,h:number){
      const end=ioChannel(y+cy-2)+side*2.7-x;
      d.pipe([[cx,cy,h],[cx-side*.45,cy-.6,h],[end,cy-1.25,.35],[end,cy-4,.3]],.12,ioSteel);
      for(let j=0;j<4;j++)d.geometry(new T.TorusGeometry(.16,.035,5,12).rotateX(Math.PI/2).translate(end,cy-1.5-j*.7,.3),ioRust);
    }
    if(kind==='winch'){
      platform(0,0,2,3.0,.6);
      box(0,0,1.2,1.3,1.8,1.0,ioCeramic);box(0,0,1.5,1.32,1.82,.20,ioBand);
      d.rod([-.65,0,1.9],[.65,0,1.9],.44,ioSteel);
      for(let i=0;i<9;i++)d.geometry(new T.TorusGeometry(.46,.025,5,16).rotateY(Math.PI/2).translate(-.5+i*.125,0,1.9),ioChrome);
      d.pipe([[0,.2,2],[side*1.4,3,1.3],[side*2.1,8,1],[side*2.8,12,1]],.055,ioDark);
      for(const k of [-1,1])d.rod([k*.7,0,1.4],[k*.7,1.2,3.5],.10,ioSteel);
    }else{
      const large=kind==='refinery'||kind==='ruin',r=large?1.13:kind==='pump'?.56:.83,h=large?2.8:1.6;
      platform(0,0,r*2+1.0,large?4.1:3.0);
      if(kind==='quarry')hopper();else tank(0,0,r,h,.6,kind==='ruin');
      pipeBranch(-side*r,-.15,1.25);
      if(kind!=='pump'){
        platform(side*2.0,1.9,2.1,2.3,.7);tank(side*2,1.9,.65,1.8,.85);
        tank(side*.25,3.15,.48,1.2,.2);
        d.pipe([[side*r,.4,1.5],[side*1.4,.7,1.6],[side*2,1.9,2.8]],.12,ioSteel);
        for(let fin=0;fin<10;fin++)box(-side*(r+.25),.9-fin*.15,1.4,.25,.045,1.55,ioSteel);
      }
      if(large){
        platform(-side*.1,-1.9,2.3,1.0,1.3);
        box(-side*.4,-1.9,1.8,1.15,.30,.06,ioHot);
        for(let j=0;j<8;j++)box(-side*.4-.5+j*.145,-1.9,1.85,.045,.32,.035,ioDark);
        stack(-side*.85,1.1,4.4);stack(-side*.6,2.1,3.7);
        if(kind==='ruin'){
          for(let j=0;j<4;j++)d.rod([side*1.4,-1.8,.3],[side*(1.4+j*.12),-1.3,2.5+j*.2],.035,ioRust);
          box(-side*.65,-.5,2.8,.65,.85,.04,ioDark);
        }
      }else if(kind==='yard')stack(-side*.8,.9,3.5);
      const mast=-side*(r+.36);
      d.rod([mast,.8,.4],[mast,.8,3.7],.055,ioSteel);
      for(let j=0;j<7;j++)d.rod([mast-.13,.8,.7+j*.4],[mast+.13,.8,.7+j*.4],.018,ioSafety);
      box(mast,.8,3.8,.13,.13,.12,ioHot);
    }
    d.finish(assembly,'registered-industry');
  }

  // Belts are genuinely below the aircraft, including the long refinery crossing.
  const routes=[[-6,28,-2.6,35], [5.5,43,2.8,49], [-6.3,56,-2.8,62],
    [5.8,72,2.7,78], [-5.5,93,-2.6,100], [5.5,109,2.8,115], [-5.7,119,5.4,124]];
  const details=new IoDetail(),right=new T.Vector3(),forward=new T.Vector3(),normal=new T.Vector3(),basis=new T.Matrix4();
  for(const[x1,y1,x2,y2]of routes){
    const ax=x1+ioChannel(y1),bx=x2+ioChannel(y2);
    const a=new T.Vector3(ax,y1,ioGroundHeight(ax,y1)+1.2),b=new T.Vector3(bx,y2,ioGroundHeight(bx,y2)+1.2);
    forward.copy(b).sub(a).normalize();right.copy(forward).cross(new T.Vector3(0,0,1)).normalize();normal.copy(right).cross(forward);
    const q=new T.Quaternion().setFromRotationMatrix(basis.makeBasis(right,forward,normal)),length=a.distanceTo(b);
    const g=new T.PlaneGeometry(.66,length);g.translate(0,length/2,0);g.applyQuaternion(q);g.translate(a.x,a.y,a.z);
    const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setY(i,uv.getY(i)*length*.32);
    const mesh=new T.Mesh(g,beltMaterial);mesh.name='moving-conveyor-belt';mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
    for(const s of [-1,1]){
      const aa=a.clone().addScaledVector(right,s*.43),bb=b.clone().addScaledVector(right,s*.43);
      details.rod(aa.toArray(),bb.toArray(),.065,ioSteel);
      for(let j=0;j<=4;j++){
        const p=aa.clone().lerp(bb,j/4),bottom=ioGroundHeight(p.x,p.y);
        details.rod([p.x,p.y,bottom],[p.x,p.y,p.z-.08],.055,ioSteel);
        details.rod([p.x,p.y,p.z],[p.x,p.y,p.z+.5],.018,ioSafety);
      }
      aa.z+=.5;bb.z+=.5;details.rod(aa.toArray(),bb.toArray(),.018,ioSafety);
    }
    const source=createIoConveyorTerminal('source',a,q),sink=createIoConveyorTerminal('sink',b,q);root.add(source,sink);
    belts.push({a,b,q,up:normal.clone(),length,cycleLength:length+.6,source,sink});
  }
  // Pipe gantry spanning the molten breach, with a missing maintenance deck.
  const bridgeY=IO_BREACH_Y;
  for(const side of [-1,1]){
    const x=side*3.8,z=ioGroundHeight(x,bridgeY+x*.48)+.3;
    details.rod([x,bridgeY+x*.48,z],[x,bridgeY+x*.48,1.0],.15,ioSteel);
    details.rod([x-.5,bridgeY+x*.48-.3,z],[x+.5,bridgeY+x*.48+.3,1.0],.05,ioRust);
  }
  for(const offset of [-.45,.45]){
    details.rod([-6,bridgeY-2.9+offset,1],[6,bridgeY+2.9+offset,1],.085,ioSteel);
    details.rod([-6,bridgeY-2.9+offset,.1],[6,bridgeY+2.9+offset,.1],.065,ioSteel);
  }
  for(let i=0;i<12;i++){
    const x=-5.5+i,y=bridgeY+x*.48;
    details.rod([x,y-.45,.1],[x+.7,y+.8,1],.035,ioRust);
    if(i<4||i>7)details.box(x,y,1.03,.85,.8,.06,ioSteel);
  }
  details.pipe([[-6,bridgeY-2.9,1.35],[-2,bridgeY-.95,1.35],[1,bridgeY+.48,1.2],[6,bridgeY+2.9,1.35]],.22,ioCeramic);
  details.pipe([[.4,bridgeY+.2,1],[.7,bridgeY-.3,-.5],[1.8,bridgeY+.5,-1.1],[2.1,bridgeY+1.1,1]],.045,ioDark);
  details.finish(root,'belt-gantry-frames');
  const chunks=new T.DodecahedronGeometry(.18,0),vertices=chunks.attributes.position;
  for(let i=0;i<vertices.count;i++){const x=vertices.getX(i),y=vertices.getY(i),z=vertices.getZ(i),s=.85+.22*Math.sin(x*31+y*27+z*13);vertices.setXYZ(i,x*s,y*s,z*s);}
  chunks.computeVertexNormals();
  const ore=new T.InstancedMesh(chunks,ioSulfur,belts.length*6);ore.name='conveyor-ore';ore.castShadow=true;ore.frustumCulled=false;root.add(ore);
  const color=new T.Color();for(let i=0;i<ore.count;i++)ore.setColorAt(i,color.setHSL(.14+(i%5)*.004,.25,.84+(i%3)*.03));
  const matrix=new T.Matrix4(),p=new T.Vector3(),scale=new T.Vector3(.9,1.4,.65),q=new T.Quaternion(),spin=new T.Quaternion(),axis=new T.Vector3(0,0,1);
  function update(time:number){
    beltMap.offset.y=-time*.256;
    for(let i=0;i<belts.length;i++)for(let j=0;j<6;j++){
      const belt=belts[i],distance=(j/6*belt.cycleLength+time*.8)%belt.cycleLength;
      p.copy(belt.a).lerp(belt.b,Math.min(1,distance/belt.length)).addScaledVector(belt.up,.14);
      p.z-=Math.max(0,distance-belt.length)*1.5;
      q.copy(belt.q).multiply(spin.setFromAxisAngle(axis,j*1.7+i));
      matrix.compose(p,q,scale);ore.setMatrixAt(i*6+j,matrix);
    }
    ore.instanceMatrix.needsUpdate=true;
  }
  update(0);return{root,vents,burners,belts,update};
}
