import * as T from 'three';
import { cicadaWingGeometry, mountCicadaWing } from './titan-wings';
import { addTitanSetae, cicadaAbdomen, cicadaEye, titanChitin } from './titan-insect-surfaces';
import { CICADA_VENT_X, CICADA_VENT_Z } from './cicada';

export function createCicada(makeChitin = titanChitin) {
  const root=new T.Group();root.name='titan-cicada';
  const orb=new T.SphereGeometry(1,32,24);
  const chitin=makeChitin(0xe2c49a,.78);
  const rim=makeChitin(0xaf8e64,.75);
  const dark=new T.MeshStandardMaterial({color:0x302530,roughness:.8});
  const eye=cicadaEye(0x553326,.012);
  function volume(parent:T.Object3D,material:T.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number,geometry:T.BufferGeometry=orb){
    const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);parent.add(mesh);return mesh;
  }
  function link(a:T.Vector3,b:T.Vector3,r:number,material:T.Material,parent:T.Object3D){
    const mesh=new T.Mesh(new T.CylinderGeometry(r*.63,r,a.distanceTo(b),8),material);
    mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());parent.add(mesh);return mesh;
  }
  volume(root,chitin,0,-.2,0,1.3,1.65,.9);
  const abdomen = volume(root,rim,0,-.93,-.13,1,1,1,cicadaAbdomen(3.02,1.12,.63,7));
  abdomen.name = 'lapped-abdomen';
  // A thick coat on the torso and abdomen; eyes, ribbed face and vents stay clear.
  for (const y of [.4,-.4,-1.1]) for (const x of [-.7,0,.7])
    addTitanSetae(root,x,y,.98,1.35,1.3,x===0?1:2);
  for (let i=0;i<7;i++) {
    const taper=Math.sin((1-(i+.5)/7)*Math.PI*.48)**.65;
    addTitanSetae(root,0,-.93-(i+.5)*3.02/7,-.13+.56*taper,2.38*taper,.72,i%2+1);
  }
  const head=new T.Group();root.add(head);head.position.set(0,1.2,.65);
  const faceCuticle=makeChitin(0x4c3941,.77);
  const paleFace=makeChitin(0xeee0c3,.8);
  paleFace.onBeforeCompile=shader=>{shader.vertexShader='varying float faceY;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfaceY=position.y;');shader.fragmentShader='varying float faceY;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    diffuseColor.rgb*=mix(vec3(1),vec3(.18,.16,.12),smoothstep(-.7,-.2,faceY));`);};
  volume(head,faceCuticle,0,0,0,1.7,.72,.8);
  for(const side of [-1,1]){
    volume(head,chitin,side*1.35,.12,.45,.37,.29,.43);
    const compound=volume(head,eye,side*1.49,.17,.64,.49,.35,.35);
    compound.rotation.z=side*.30;
    compound.rotation.y=side*.35;
    compound.name='compound-eye';
    link(new T.Vector3(side*1.02,-.23,.6),new T.Vector3(side*1.5,-.65,.7),.045,faceCuticle,head);
    link(new T.Vector3(side*1.5,-.65,.7),new T.Vector3(side*2.1,-1.3,.5),.022,faceCuticle,head);
  }
  // Pear-shaped clypeus and swept ribs follow the supplied face reference.
  // All grooves/ridges sit on this same closed surface, not floating teeth.
  const width=(u:number)=>.82*(.62+.38*T.MathUtils.smoothstep(u,-1,.15));
  const front=(x:number,y:number)=>{const u=(y+.75)/.72;return .78+.32*Math.sqrt(Math.max(0,1-u*u-(x/width(u))**2));};
  const faceGeometry=new T.SphereGeometry(1,48,32),vertices=faceGeometry.attributes.position;
  for(let i=0;i<vertices.count;i++){const x=vertices.getX(i),y=vertices.getY(i),z=vertices.getZ(i);vertices.setXYZ(i,x*width(y),-.75+y*.72,.78+z*.32);}
  faceGeometry.computeVertexNormals();const clypeus=new T.Mesh(faceGeometry,paleFace);clypeus.name='clypeus';head.add(clypeus);
  for(const side of [-1,1])for(let j=0;j<8;j++){
    const y=-.30-j*.13,outerY=y+.1,u=(outerY+.75)/.72,outerX=.89*width(u)*Math.sqrt(Math.max(0,1-u*u));
    const points=Array.from({length:13},(_,k)=>{const t=k/12,x=side*(.065+(outerX-.065)*t),py=y+.1*t*t;return new T.Vector3(x,py,front(x,py)+.004);});
    const rib=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),20,.017,6,false),faceCuticle);rib.name='clypeal-rib';head.add(rib);
  }
  const seam=Array.from({length:17},(_,i)=>{const y=-.13-i/16*1.24;return new T.Vector3(0,y,front(0,y)+.009);});
  const groove=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(seam),24,.018,5,false),faceCuticle);groove.name='clypeal-seam';head.add(groove);
  for(const [x,y] of [[-.27,.5],[.27,.5],[0,.25]]){const z=.8*Math.sqrt(1-(x/1.7)**2-(y/.72)**2);const ocellus=volume(head,eye,x,y,z+.06,.10,.10,.085);ocellus.name='ocellus';}
  const browGuide=new T.CatmullRomCurve3([new T.Vector3(-1.3,.25,.7),new T.Vector3(-.8,.52,.85),new T.Vector3(0,.7,.66),new T.Vector3(.8,.52,.85),new T.Vector3(1.3,.25,.7)]);
  const brow=new T.CatmullRomCurve3(Array.from({length:41},(_,i)=>{const p=browGuide.getPoint(i/40),core=1-(p.x/1.7)**2-(p.y/.72)**2;p.z=(core>0?.8*Math.sqrt(core):0)+.028;return p;}));
  head.add(new T.Mesh(new T.TubeGeometry(brow,48,.042,8,false),rim));
  const hairs:number[]=[];
  for(let i=0;i<220;i++){const t=i/219,base=brow.getPoint(t),angle=i*2.39996;hairs.push(base.x,base.y,base.z,base.x+Math.cos(angle)*.035,base.y+.025+Math.sin(angle)*.025,base.z+.045+(i%5)*.007);}
  const fuzzGeometry=new T.BufferGeometry();fuzzGeometry.setAttribute('position',new T.Float32BufferAttribute(hairs,3));head.add(new T.LineSegments(fuzzGeometry,new T.LineBasicMaterial({color:0xc3b28e,transparent:true,opacity:.8,depthWrite:false})));
  for (const side of [-1,1]) {
    addTitanSetae(head,side*1.06,-.12,.79,.78,.85);
    addTitanSetae(head,side*.91,-.68,.89,.66,1.0,2);
    addTitanSetae(head,side*.57,-1.17,.91,.65,.56);
    addTitanSetae(head,side*1.37,.12,.55,.61,.52);
  }

  const rostrum=volume(head,faceCuticle,0,-1.38,.82,.11,.24,.10,new T.ConeGeometry(1,2,14));rostrum.rotation.z=Math.PI;rostrum.name='rostrum';
  const vents:T.Mesh[]=[];
  for(const side of [-1,1]){
    volume(root,chitin,side*1.45,-.1,0,.8,.95,.58);
    volume(root,dark,side*2.15,0,.25,.55,.8,.38);
    const vent=volume(root,new T.MeshStandardMaterial({color:0x18403b,emissive:0x69e7cc,emissiveIntensity:.3,roughness:.3}),side*2.4,0,.67,.27,.59,.13);vents.push(vent);
    for(let j=-1;j<=1;j++)volume(root,chitin,side*2.4,j*.3,.8,.26,.044,.055);
    const anchor=new T.Object3D();anchor.name=side<0?'laser_contact_L':'laser_contact_R';anchor.position.set(side*CICADA_VENT_X,0,CICADA_VENT_Z);root.add(anchor);
  }
  const wings: { pivot: T.Group; side: number; rear: boolean; flex: (amount: number) => void }[] = [];
  const membrane = new T.MeshPhysicalMaterial({ color: 0xd3ab67, emissive: 0xffb375, emissiveIntensity: 0,
    transparent: true, opacity: .38, roughness: .28, metalness: .12, clearcoat: .8,
    side: T.DoubleSide, depthWrite: false, iridescence: .15 });
  const veins = new T.LineBasicMaterial({ color: 0xa2774c, transparent: true, opacity: .8, depthWrite: false });
  const wingGeometry = cicadaWingGeometry(5.6, 2.55, 1.94, .24, .79);
  for (const side of [-1, 1]) for (const rear of [false, true]) {
    const pivot = new T.Group();
    pivot.name = `${rear ? 'hind' : 'fore'}wing-${side}`;
    pivot.position.set(side * .9, rear ? -.45 : .5, -.3);
    const { blade, flex } = mountCicadaWing(wingGeometry, membrane, veins);
    blade.scale.set(side * (rear ? .84 : 1), rear ? .73 : 1, 1);
    blade.rotation.z = rear ? -side * .42 : side * .08;
    pivot.add(blade);
    root.add(pivot);
    wings.push({ pivot, side, rear, flex });
  }
  const legs: { root: T.Group; tibia: T.Group; foot: T.Group; side: number; index: number }[]=[];
  for(const side of [-1,1])for(let i=0;i<3;i++){
    const leg=new T.Group();leg.name=`leg-${side}-${i}`;leg.position.set(side*.85,.3-i*.65,.3);root.add(leg);
    const a=new T.Vector3(),b=new T.Vector3(side*(1.5+i*.12),-.8-i*.13,.65),c=new T.Vector3(side*(1.4+i*.24),-1.9-i*.25,1.1),d=new T.Vector3(side*(1.15+i*.27),-2.35-i*.3,1.15);
    const tibia = new T.Group(), foot = new T.Group();
    tibia.name = 'tibia'; tibia.position.copy(b); leg.add(tibia);
    foot.name = 'tarsus'; foot.position.copy(c).sub(b); tibia.add(foot);
    const shin = c.clone().sub(b);
    link(a,b,.23,chitin,leg);
    link(a,shin,.16,rim,tibia);
    link(a,d.clone().sub(c),.075,dark,foot);
    volume(foot,faceCuticle,0,0,0,.10,.11,.10);
    legs.push({ root: leg, tibia, foot, side, index: i });
    for(let j=0;j<5;j++){
      const base=shin.clone().multiplyScalar((j+.8)/6),tip=base.clone().add(new T.Vector3(side*(.2+j*.025),-.13,.1));
      const spine=link(base,tip,.065,dark,tibia);spine.geometry.dispose();spine.geometry=new T.ConeGeometry(.085,base.distanceTo(tip),8);spine.name='tibial-spine';
    }
    volume(leg,chitin,b.x,b.y,b.z,.2,.2,.2);
    addTitanSetae(leg,b.x*.48,b.y*.48,b.z*.48+.17,.75,.70,2);
  }
  return {root,pose(_reveal:number,charge:number,exposed:number,_fired:number,recoil:number,time=0,wingSpread=1,backlight=0){
    head.rotation.y=Math.sin(time*.75)*.09;head.rotation.z=Math.sin(time*.47)*.035;
    head.position.z=.65-recoil*.13;
    for (const { pivot, side, rear, flex } of wings) {
      const beat = time * 32 + 1.65 * Math.sin(time * 1.46) + (rear ? .65 : 0) + side * .13;
      const stroke = .22 + .035 * Math.sin(time * 2.34 + side * .6);
      pivot.rotation.y = side * (.16 + 1.02 * (1 - wingSpread) + Math.sin(beat) * stroke * wingSpread);
      pivot.rotation.z = side * .04 * Math.sin(beat - .35) * wingSpread;
      flex((.5 + .5 * Math.sin(beat - .9)) * wingSpread);
    }
    membrane.emissiveIntensity=backlight;
    for (const { root, tibia, foot, side, index } of legs) {
      const reach = Math.sin(time * 1.8 - index * .61 + side * .28);
      root.rotation.x = .09 * reach - .23 * charge;
      root.rotation.z = side * (.11 * reach + .08 * charge);
      tibia.rotation.x = -.14 + reach * .21 + .42 * charge;
      foot.rotation.x = .08 - reach * .21 - .28 * charge;
    }
    vents.forEach((vent,i)=>{const live=(i===0?exposed<0:exposed>0);(vent.material as T.MeshStandardMaterial).emissiveIntensity=live?.9+charge*2.6:.1;});
  }};
}
