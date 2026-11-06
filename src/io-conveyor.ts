import * as T from 'three';
import {IoDetail} from './io-detail';
import {ioGroundHeight} from './io-layout';
import {ioSilo,ioSiloBand,ioSteel,ioDark,ioRust,ioSulfur} from './io-materials';

export function createIoConveyorTerminal(kind:'source'|'sink',position:T.Vector3,rotation:T.Quaternion){
  const root=new T.Group();root.name='conveyor-'+kind;root.position.copy(position);
  const forward=new T.Vector3(0,1,0).applyQuaternion(rotation);
  root.quaternion.setFromAxisAngle(new T.Vector3(0,0,1),Math.atan2(-forward.x,forward.y));
  const inverse=root.quaternion.clone().invert();
  const d=new IoDetail();
  // Covered transfer chamber. The first/last sulfur positions are inside it,
  // so the transport loop and the receiving drop are hidden by real geometry.
  d.box(0,0,.67,1.14,1.5,.14,ioSteel);
  for(const side of [-1,1])d.box(side*.53,0,.31,.12,1.5,.62,ioSilo);
  d.box(0,kind==='source'?-.72:.72,.29,1.14,.12,.7,ioDark);
  d.box(0,0,-.4,1.14,1.5,.1,ioSteel);
  for(const side of [-1,1])d.box(side*.6,0,.45,.08,1.55,.12,ioRust);
  if(kind==='source'){
    // A full hopper feeds the enclosed discharge throat from behind the belt.
    const corners=[[-.8,-1.6],[.8,-1.6],[.8,-.1],[-.8,-.1]],p:number[]=[],uv:number[]=[];
    for(let i=0;i<4;i++){
      const a=corners[i],b=corners[(i+1)%4],v=[[a[0],a[1],1.6],[b[0],b[1],1.6],[a[0]*.35,-.8+(a[1]+.8)*.35,.75],[b[0]*.35,-.8+(b[1]+.8)*.35,.75]];
      for(const j of [0,1,2,1,3,2]){p.push(...v[j]);uv.push(j%2,Math.floor(j/2));}
      d.rod([a[0],a[1],1.63],[b[0],b[1],1.63],.05,ioRust);
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();d.geometry(g,ioSilo);
    for(let i=0;i<9;i++)d.geometry(new T.DodecahedronGeometry(.20+(i%3)*.03,0).translate(Math.sin(i*2.4)*.38,-.8+Math.cos(i*2.4)*.35,1.05+(i%3)*.08),ioSulfur);
  }else{
    // The covered intake drops into a crusher/bin, with a service door and pipe.
    d.box(0,.65,.98,1.5,.8,1.55,ioSilo);d.box(0,.65,1.14,1.52,.82,.18,ioSiloBand);
    d.box(0,.205,1.05,.82,.06,.58,ioDark);
    for(let i=0;i<5;i++)d.box(-.32+i*.16,.17,1.05,.045,.045,.52,ioSteel);
    d.pipe([[0,1,.3],[0,1.6,.3],[0,1.9,-.7]],.18,ioRust);
  }
  const p=new T.Vector3();
  for(const side of [-1,1])for(const end of [-.6,.6]){
    p.set(side*.5,end,0).applyQuaternion(root.quaternion).add(position);
    const foot=new T.Vector3(p.x,p.y,ioGroundHeight(p.x,p.y)).sub(position).applyQuaternion(inverse);
    d.rod(foot.toArray(),[side*.5,end,-.35],.065,ioSteel);
  }
  d.finish(root,'conveyor-'+kind+'-housing');
  const port=new T.Object3D();port.name=kind==='source'?'loading-port':'receiving-port';port.position.set(0,0,.14).applyQuaternion(rotation).applyQuaternion(inverse);root.add(port);
  return root;
}
