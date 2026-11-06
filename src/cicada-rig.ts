import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function createCicada() {
  const root=new T.Group();root.name='titan-cicada';
  const orb=new T.SphereGeometry(1,32,24);
  const chitin=new T.MeshStandardMaterial({color:0x806342,roughness:.67,metalness:.13});
  chitin.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 shellPoint;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nshellPoint=position;');
    shader.fragmentShader='varying vec3 shellPoint;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float grain=sin(shellPoint.x*110.0)*sin(shellPoint.y*93.0+shellPoint.z*67.0);
      float mottling=sin(shellPoint.x*17.0+sin(shellPoint.y*23.0))*sin(shellPoint.z*31.0);
      diffuseColor.rgb*=.86+grain*.055+mottling*.18;`);
  };
  const rim=new T.MeshStandardMaterial({color:0xb29a70,roughness:.72});
  const dark=new T.MeshStandardMaterial({color:0x2a211b,roughness:.8});
  const eye=new T.MeshPhysicalMaterial({color:0x722b16,roughness:.25,metalness:.28,clearcoat:.8});
  eye.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    vec2 p=vViewPosition.xy*24.0;float row=floor(p.y);p.x+=mod(row,2.0)*.5;
    float facet=smoothstep(.34,.49,length(fract(p)-.5));diffuseColor.rgb*=1.0-facet*.4;`);};
  function volume(parent:T.Object3D,material:T.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number,geometry:T.BufferGeometry=orb){
    const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);parent.add(mesh);return mesh;
  }
  function link(a:T.Vector3,b:T.Vector3,r:number,material:T.Material,parent:T.Object3D){
    const mesh=new T.Mesh(new T.CylinderGeometry(r*.63,r,a.distanceTo(b),8),material);
    mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());parent.add(mesh);return mesh;
  }
  volume(root,chitin,0,-.2,0,1.3,1.65,.9);
  for(let i=0;i<7;i++){
    const w=1.05*(1-i*.115);volume(root,i%2?rim:chitin,0,-1.3-i*.38,-.35-i*.09,w,.4,.57*(1-i*.08));
  }
  const head=new T.Group();root.add(head);head.position.set(0,1.2,.65);
  volume(head,chitin,0,0,0,1.7,.98,.8);
  for(const side of [-1,1]){
    volume(head,chitin,side*1.4,.4,.43,.42,.4,.53);
    const compound=volume(head,eye,side*1.65,.58,.83,.50,.56,.42,new T.IcosahedronGeometry(1,3));compound.name='compound-eye';
    link(new T.Vector3(side*.48,.6,.6),new T.Vector3(side*.75,1.45,.55),.055,rim,head);
    link(new T.Vector3(side*.75,1.45,.55),new T.Vector3(side*1.3,1.75,.48),.029,chitin,head);
  }
  // Paired vertical rows of clypeal ribs; these are cuticular ridges, not jaws.
  volume(head,rim,0,-.15,.76,.55,.6,.27);
  for(const side of [-1,1])for(let j=0;j<7;j++){const rib=volume(head,rim,side*(.23+Math.sin(j/6*Math.PI)*.11),.29-j*.125,1.01,.15,.052,.105);rib.rotation.z=side*(.28+j*.025);rib.name='clypeal-rib';}
  volume(head,chitin,0,.68,.55,.57,.43,.37);
  for(const [x,y] of [[0,.95],[-.29,.65],[.29,.65]]){const ocellus=volume(head,eye,x,y,.98,.12,.12,.09);ocellus.name='ocellus';}
  const rostrum=volume(head,rim,0,-.65,.87,.13,.30,.12,new T.ConeGeometry(1,2,14));rostrum.rotation.z=Math.PI;rostrum.name='rostrum';
  const vents:T.Mesh[]=[];
  for(const side of [-1,1]){
    volume(root,chitin,side*1.45,-.1,0,.8,.95,.58);
    volume(root,dark,side*2.15,0,.25,.55,.8,.38);
    const vent=volume(root,new T.MeshStandardMaterial({color:0x18403b,emissive:0x69e7cc,emissiveIntensity:.3,roughness:.3}),side*2.4,0,.67,.27,.59,.13);vents.push(vent);
    for(let j=-1;j<=1;j++)volume(root,chitin,side*2.4,j*.3,.8,.26,.044,.055);
    const anchor=new T.Object3D();anchor.name=side<0?'laser_contact_L':'laser_contact_R';anchor.position.set(side*2.4,0,.88);root.add(anchor);
  }
  const wings:T.Group[]=[];
  const membrane=new T.MeshPhysicalMaterial({color:0xd3ab67,transparent:true,opacity:.32,roughness:.25,metalness:.12,clearcoat:.8,side:T.DoubleSide,depthWrite:false,iridescence:.15});
  for(const side of [-1,1])for(const rear of [false,true]){
    const wing=new T.Group();wing.name=`${rear?'hind':'fore'}wing-${side}`;wing.position.set(side*.9,rear?-.45:.5,-.3);root.add(wing);wings.push(wing);
    const shape=new T.Shape();shape.moveTo(0,0);shape.bezierCurveTo(1.5,1.8,4.3,3.2,5.6,2.7);shape.bezierCurveTo(5.8,1.8,3.2,-.8,0,0);
    const geometry=new T.ShapeGeometry(shape,28);geometry.scale(side*(rear?.84:1),rear?.66:1,1);if(rear)geometry.rotateZ(-side*.48);
    const mesh=new T.Mesh(geometry,membrane);wing.add(mesh);
    const lines:T.BufferGeometry[]=[];
    function vein(points:T.Vector3[],radius:number){lines.push(new T.TubeGeometry(new T.CatmullRomCurve3(points),12,radius,5,false));}
    for(let i=0;i<6;i++){
      const t=i/5,end=new T.Vector3(side*(2.8+t*2.6)*(rear?.84:1),(.0+t*2.7)*(rear?.66:1),.025);
      if(rear)end.applyAxisAngle(new T.Vector3(0,0,1),-side*.48);
      const middle=end.clone().multiplyScalar(.47);middle.y+=.28;
      vein([new T.Vector3(),middle,end],.022);
      for(let j=1;j<=3;j++){
        const a=middle.clone().lerp(end,j/4),b=a.clone().add(new T.Vector3(side*.22,-.13,.004));vein([a,b],.011);
      }
    }
    // Clip whole vein triangles against the actual membrane outline, including
    // the tube radius and mirrored/rotated hindwing transforms.
    const veins=mergeGeometries(lines),positions=veins.attributes.position,triangles:T.Triangle[]=[],q=new T.Vector3();
    const surface=geometry.attributes.position,faces=geometry.index!;
    for(let i=0;i<faces.count;i+=3)triangles.push(new T.Triangle(new T.Vector3().fromBufferAttribute(surface,faces.getX(i)),new T.Vector3().fromBufferAttribute(surface,faces.getX(i+1)),new T.Vector3().fromBufferAttribute(surface,faces.getX(i+2))));
    const covered=Array.from({length:positions.count},(_,i)=>{q.fromBufferAttribute(positions,i).setZ(0);return triangles.some(t=>t.containsPoint(q));});
    const ix=veins.index!,kept:number[]=[];for(let i=0;i<ix.count;i+=3){const a=ix.getX(i),b=ix.getX(i+1),c=ix.getX(i+2);if(covered[a]&&covered[b]&&covered[c])kept.push(a,b,c);}
    veins.setIndex(kept);veins.name='clipped-wing-veins';wing.add(new T.Mesh(veins,rim));for(const g of lines)g.dispose();
  }
  const legs:T.Group[]=[];
  for(const side of [-1,1])for(let i=0;i<3;i++){
    const leg=new T.Group();leg.name=`leg-${side}-${i}`;leg.position.set(side*.85,.3-i*.65,.3);root.add(leg);legs.push(leg);
    const a=new T.Vector3(),b=new T.Vector3(side*(1.5+i*.12),-.8-i*.13,.65),c=new T.Vector3(side*(1.4+i*.24),-1.9-i*.25,1.1),d=new T.Vector3(side*(1.15+i*.27),-2.35-i*.3,1.15);
    link(a,b,.23,chitin,leg);link(b,c,.16,rim,leg);link(c,d,.075,dark,leg);
    for(let j=0;j<5;j++){
      const base=b.clone().lerp(c,(j+.8)/6),tip=base.clone().add(new T.Vector3(side*(.2+j*.025),-.13,.1));
      const spine=link(base,tip,.065,dark,leg);spine.geometry.dispose();spine.geometry=new T.ConeGeometry(.085,base.distanceTo(tip),8);spine.name='tibial-spine';
    }
    volume(leg,chitin,b.x,b.y,b.z,.2,.2,.2);
  }
  return {root,pose(_reveal:number,charge:number,exposed:number,_fired:number,recoil:number,time=0){
    head.rotation.y=Math.sin(time*.75)*.09;head.rotation.z=Math.sin(time*.47)*.035;
    head.position.z=.65-recoil*.13;
    for(let i=0;i<wings.length;i++){const side=i<2?-1:1;wings[i].rotation.y=side*(.16+Math.sin(time*32+i%2*.65)*.22);wings[i].rotation.z=Math.sin(time*2+i)*.025;}
    legs.forEach((leg,i)=>{leg.rotation.x=Math.sin(time*1.8+i)*.13;leg.rotation.z=Math.sin(time*1.3+i)*.06;});
    vents.forEach((vent,i)=>{const live=(i===0?exposed<0:exposed>0);(vent.material as T.MeshStandardMaterial).emissiveIntensity=live?.9+charge*2.6:.1;});
  }};
}
