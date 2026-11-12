import * as T from 'three';
import {VENT_CRAB_SCALE} from './vent-layout';
import {BOSS_MUZZLE_Z} from './encounters';
import {crabFeet,CRAB_LEGS} from './vent-crab';

type AtlasBounds = readonly [left: number, bottom: number, right: number, top: number];
type Point3 = { x: number; y: number; z: number };

// The source parts include open sockets at their ends. Sample the armor up
// to each socket lip, then bury that edge in the adjoining posed part.
const socketCrops: Partial<Record<number, AtlasBounds>> = {
 3: [0, .21, 1, .78], // upper leg, both ends
 4: [0, 0, 1, .77],   // lower leg
 5: [0, 0, 1, .72],   // hooked toe
 6: [0, .21, 1, .78], // claw arm, both ends
 8: [0, .18, 1, 1],   // moving finger
 9: [0, .19, 1, 1],   // eye stalk
 11: [0, .16, 1, 1],  // exposed claw organ
};

function atlasGeometry(geometry: T.BufferGeometry, cell: number, [left, bottom, right, top]: AtlasBounds = [0, 0, 1, 1]) {
 const uv = geometry.attributes.uv, pad = .012;
 for (let i = 0; i < uv.count; i++) {
  const u = T.MathUtils.lerp(left, right, uv.getX(i));
  const v = T.MathUtils.lerp(bottom, top, uv.getY(i));
  uv.setXY(i, (cell % 4 + pad + u * (1 - 2 * pad)) / 4, 1 - (Math.floor(cell / 4) + 1 - pad - v * (1 - 2 * pad)) / 3);
 }
 return geometry;
}

function clawPalmGeometry() {
 const geometry = new T.PlaneGeometry(1, 1, 16);
 const { position, uv } = geometry.attributes;
 for (let i = 0; i < uv.count; i++) {
  if (uv.getY(i) !== 0) continue;
  const across = Math.abs(uv.getX(i) - .51);
  // Trim up around the central mounting socket and keep the scalloped sides.
  const bottom = .08 + .14 * (1 - T.MathUtils.smoothstep(across, .10, .33));
  position.setY(i, bottom - .5);
  uv.setY(i, bottom);
 }
 return atlasGeometry(geometry, 7);
}

// Source-drawn parts keep the full rig playable without uploaded media.
function fallbackAtlas(){
 const n=128,w=n*4,h=n*3,data=new Uint8Array(w*h*4);
 for(let cell=0;cell<12;cell++)for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const u=(x+.5)/n*2-1,v=(y+.5)/n*2-1,thin=[3,4,5,6,8,9].includes(cell),rx=thin?.42:.88,ry=cell<2?.66:.88;
  if(Math.hypot(u/rx,v/ry)>1)continue;
  const noise=((x*17+y*37+cell*23)%19)/19,light=.55+.45*Math.max(0,1-Math.hypot(u+.25,v+.3));
  let r=51*light+noise*19,g=70*light+noise*16,b=77*light+noise*12;
  if(cell===2||cell===11){const ring=Math.hypot(u,v);r=20;g=ring<.55?100+70*Math.sin(Math.atan2(v,u)*16)**2:52;b=ring<.55?85:53;if(ring<.2){r=5;g=20;b=21;}}
  else if(cell===9&&v<-.1){r=8;g=17;b=20;}
  else if(cell===10){const ring=Math.hypot(((u+.9)*3)%1-.5,((v+.9)*3)%1-.5);r=ring<.24?35:160;g=ring<.24?42:151;b=ring<.24?43:121;}
  else {const bx=((x+cell*17)%37-18)/15,by=((y+cell*13)%43-21)/16,ring=Math.hypot(bx,by);if(ring<.48){r=ring<.25?22:155;g=ring<.25?31:146;b=ring<.25?33:116;}}
  const at=((Math.floor(cell/4)*n+y)*w+cell%4*n+x)*4;data.set([r,g,b,255],at);
 }
 const texture=new T.DataTexture(data,w,h);texture.flipY=true;texture.colorSpace=T.SRGBColorSpace;texture.generateMipmaps=true;texture.minFilter=T.LinearMipmapLinearFilter;texture.anisotropy=4;texture.needsUpdate=true;return texture;
}
export function createVentBoss(fallback?:T.Texture){
 const root=new T.Group();root.name='barnacled-rim-crab';root.scale.setScalar(VENT_CRAB_SCALE);
 let map=fallback??fallbackAtlas();const materials=new Map<string,T.MeshBasicMaterial>();
 function material(layer:number,color=0xffffff){const key=layer+':'+color;let m=materials.get(key);if(!m){m=new T.MeshBasicMaterial({map,alphaTest:.45,side:T.DoubleSide,color,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-layer*2});materials.set(key,m);}return m;}
 const geometries = Array.from({length:12}, (_, cell) => {
  if (cell === 7) return clawPalmGeometry();
  const crop = socketCrops[cell];
  return atlasGeometry(crop ? new T.PlaneGeometry() : new T.CircleGeometry(.5, 28), cell, crop);
 });
 function part(parent:T.Object3D,cell:number,x:number,y:number,z:number,w:number,h:number,layer:number,color=0xffffff){const m=new T.Mesh(geometries[cell],material(layer,color));m.position.set(x,y,z);m.scale.set(w,h,1);parent.add(m);return m;}
 function barnacle(parent:T.Object3D,x:number,y:number,z:number,size:number,angle:number,layer:number){const p=part(parent,10,x,y,z,size,size,layer);p.rotation.z=angle;p.name='crab-barnacle-colony';return p;}
 const a=new T.Vector3(),b=new T.Vector3(),direction=new T.Vector3(),unit=new T.Vector3(),right=new T.Vector3(),normal=new T.Vector3(),basis=new T.Matrix4();
 function span(mesh: T.Mesh, from: Point3, to: Point3, width: number, overlap = .38) {
  a.set(from.x, from.y, from.z);
  b.set(to.x, to.y, to.z);
  direction.copy(a).sub(b);
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  unit.copy(direction).normalize();
  right.set(unit.y, -unit.x, 0);
  if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
  right.normalize();
  normal.crossVectors(right, unit).normalize();
  basis.makeBasis(right, unit, normal);
  mesh.quaternion.setFromRotationMatrix(basis);
  mesh.scale.set(width, direction.length() + overlap, 1);
 }
 const kneeArmor = atlasGeometry(new T.CircleGeometry(.5, 16), 6, [.32, .36, .68, .64]);
 const legs=Array.from({length:CRAB_LEGS},(_,i)=>{
  const upper=part(root,3,0,0,0,.8,1,2+i*2),lower=part(root,4,0,0,0,.55,1,3+i*2),toe=part(root,5,0,0,0,.95,1.1,4+i*2);
  upper.name='crab-leg-upper-'+i;lower.name='crab-leg-lower-'+i;toe.name='crab-foot-'+i;
  const knee = new T.Mesh(kneeArmor, material(5 + i * 2, 0xc9c7bd));
  knee.name = 'crab-knee-' + i;
  knee.scale.set(.55, .43, 1);
  root.add(knee);
  barnacle(upper,0,.15,.05,.55,.4,5+i*2);
  return {upper, lower, toe, knee};
 });
 part(root,0,0,.3,.1,5.4,3.1,25).name='crab-carapace';
 for(const[x,y,size,angle]of[[-1.9,.45,.6,-.4],[-1.3,1,.7,.2],[-.5,1.05,.5,-.2],[.5,1,.65,.1],[1.4,.8,.75,-.5],[2,.1,.5,.5],[-1.8,-.3,.5,.7]])barnacle(root,x,y,.23,size,angle,27);
 const eyes=[-1,1].map(side=>{const pivot=new T.Group();pivot.position.set(side*.85,.75,.35);root.add(pivot);part(pivot,9,0,.28,0,.40,.69,35).name='crab-eye-'+side;return{pivot,side};});
 const core=part(root,2,0,-.05,.76,1.85,1.7,41);core.name='crab-gill-chamber';
 const center=new T.Object3D();center.name='laser_contact_C';center.position.set(0,0,BOSS_MUZZLE_Z+.015);root.add(center);
 const plates=[-1,1].map((side,i)=>{
  const hinge=new T.Group();hinge.name='crab-apron-'+side;hinge.position.set(side*1.35,-.35,.92);root.add(hinge);
  const mesh=new T.Mesh(atlasGeometry(new T.PlaneGeometry(.5,1),1,[i/2,0,(i+1)/2,1]),material(44+i));mesh.position.x=-side*.7;mesh.scale.set(2.8,1.6,1);hinge.add(mesh);return{side,hinge};
 });
 const glowGeometry=new T.RingGeometry(.24,.33,24);
 const coreGlow=new T.Mesh(glowGeometry,new T.MeshBasicMaterial({color:0x70ffd3,transparent:true,opacity:.15,blending:T.AdditiveBlending,depthWrite:false}));coreGlow.position.set(0,0,.84);coreGlow.scale.setScalar(2);root.add(coreGlow);
 const claws=[-1,1].map((side,index)=>{
  const shoulder = {x:side*1.55,y:.08,z:.24};
  const upper=part(root,6,0,0,0,.85,1,31);upper.name='crab-claw-arm-'+index;
  const hinge=new T.Group();hinge.name=side<0?'crab-crusher':'crab-cutter';hinge.position.set(side*2.4,0,.45);root.add(hinge);
  const fore=part(hinge,6,0,0,0,.78,1,33);
  span(fore, {x:0,y:0,z:0}, {x:side*.88,y:.36,z:.13}, .82, .32);
  part(hinge,7,side*.85,.85,.13,2.15*side,2.55,35).name='crab-palm-'+index;
  const finger=new T.Group();finger.name='crab-finger-'+index;finger.position.set(side*1.28,1.41,.22);hinge.add(finger);
  part(finger,8,0,.49,0,.80*side,1.11,37).name='crab-finger-blade-'+index;
  for(const[x,y,size]of[[.75,.8,.55],[1.25,.45,.45],[.55,1.3,.4]])barnacle(hinge,side*x,y,.25,size,side*.4,39);
  const joint=part(root,11,side*2.4,.07,.78,.95,.80,40);joint.name='crab-claw-joint-'+index;
  const glow=new T.Mesh(glowGeometry,new T.MeshBasicMaterial({color:0x70ffd3,transparent:true,opacity:.15,blending:T.AdditiveBlending,depthWrite:false}));glow.position.set(side*2.4,0,.84);root.add(glow);
  const anchor=new T.Object3D();anchor.name=side<0?'laser_contact_L':'laser_contact_R';anchor.position.set(side*2.4,0,BOSS_MUZZLE_Z+.015);root.add(anchor);
  return{side,index,shoulder,upper,hinge,finger,joint,anchor,glow};
 });
 const hip = new T.Vector3(), knee = new T.Vector3(), ankle = new T.Vector3(), foot = new T.Vector3();
 function pose(reveal:number,windup:number,targetX:number,firedX:number,recoil:number,time=0,broken:readonly number[]=[0,0],opening=0){
  const feet=crabFeet(reveal,Math.max(0,time-108));
  legs.forEach((leg,i)=>{
   const side = i % 2 ? 1 : -1, row = Math.floor(i / 2);
   foot.copy(feet[i]).divideScalar(VENT_CRAB_SCALE);
   hip.set(side * 1.7, .15 - row * .12, 0);
   knee.set(side * (2.9 + row * .65), -.8 - row * .12, foot.z * .35 + .25);
   ankle.set(foot.x - side * .17, foot.y + .58, foot.z + .11);
   span(leg.upper, hip, knee, 1.35 - row * .04);
   span(leg.lower, knee, ankle, 1.12 - row * .025, .47);
   span(leg.toe, ankle, foot, .92 * side, .16);
   leg.knee.position.copy(knee);
   leg.knee.position.z += .11;
   leg.knee.rotation.z = side * .29;
  });
  for(const{pivot,side}of eyes)pivot.rotation.z=side*(.08+Math.sin(time*.7)*.035);
  for(const{side,hinge}of plates)hinge.rotation.y=side*opening*1.3;
  core.scale.set(1.85*(1+Math.sin(time*3)*.025+opening*windup*.05),1.7,1);core.position.z=.76-(targetX===0?recoil*.06:0);coreGlow.visible=targetX===0&&opening>0;coreGlow.material.opacity=.12+windup*.3;
  for(const c of claws){
   const sag=broken[c.index]??0,active=Math.sign(targetX)===c.side&&sag===0;
   const kick = Math.sign(firedX) === c.side ? recoil : 0;
   c.hinge.rotation.z=-c.side*(sag*.95+.04*Math.sin(time*.9+c.index));c.hinge.position.z=.45-kick*.1;
   span(c.upper, c.shoulder, c.hinge.position, .9, .44);
   c.finger.rotation.z=-c.side*(.08+(active?windup*.65:0)+kick*.15);
   c.joint.material=material(40,sag>0?0x596b6b:active?0xffffff:0x6a8885);
   c.glow.visible=active;c.glow.material.opacity=.12+windup*.5;c.glow.scale.setScalar(1+windup*.25);
   c.joint.position.z=.78-kick*.06;c.glow.position.z=c.joint.position.z+.06;
   c.anchor.position.z=BOSS_MUZZLE_Z+.015-kick*.06;
  }
  center.position.z=BOSS_MUZZLE_Z+.015-(targetX===0?recoil*.06:0);
 }
 for(const color of[0x596b6b,0x6a8885])material(40,color);
 pose(1,0,-2.4,0,0);
 return{root,pose,setAtlas(texture:T.Texture){map=texture;texture.anisotropy=4;for(const m of materials.values()){m.map=texture;m.needsUpdate=true;}}};
}
