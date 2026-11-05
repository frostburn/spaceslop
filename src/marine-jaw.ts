import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { sealMarineTube } from './marine-geometry';

export const JAW_HINGE_Y = .80;
export const JAW_HINGE_Z = -.09;
const lowerBite = -.18;

// A single rounded arcade supplies both tooth rows and lips.
// Geometry starts in the animal's bind frame; only the mandible is subsequently
// moved into hinge-local space. This keeps the closed bite aligned across parts.
const arcade = new T.CatmullRomCurve3([
  [-.55,.83],[-.48,1.25],[-.31,1.75],[-.12,2.04],[0,2.09],
  [.12,2.04],[.31,1.75],[.48,1.25],[.55,.83],
].map(([x,y])=>new T.Vector3(x,y,0)),false,'centripetal');

const upperProfile = new T.CatmullRomCurve3([
  [.8,.62,.49],[1.1,.58,.40],[1.4,.52,.28],[1.72,.40,.22],[1.98,.24,.15],[2.14,.003,.003],
].map(([y,w,h])=>new T.Vector3(w,y,h)),false,'centripetal');
const lowerProfile = new T.CatmullRomCurve3([
  [.8,.62,.38],[.95,.57,.28],[1.25,.50,.17],[1.65,.39,.12],[1.92,.23,.09],[2.06,.14,.05],[2.14,.003,.003],
].map(([y,w,h])=>new T.Vector3(w,y,h)),false,'centripetal');
function atY(curve:T.CatmullRomCurve3,y:number) {
  let a=0,b=1;
  for(let i=0;i<22;i++){const t=(a+b)/2;if(curve.getPoint(t).y<y)a=t;else b=t;}
  return curve.getPoint((a+b)/2);
}
function biteHeight(y:number,lower:boolean) {
  return T.MathUtils.lerp(JAW_HINGE_Z,lower?lowerBite:0,T.MathUtils.smoothstep(y,JAW_HINGE_Y,1.1));
}

// One indexed exterior runs from tail through neck into both jaws. The ventral
// neck gradually acquires jaw influence; there are no overlapping throat collars,
// separately capped skulls, or flat belly-colored faces inside the mouth.
function exterior() {
  const curve=new T.CatmullRomCurve3([
    [-4,.02,.04],[-3.4,.12,.17],[-2.6,.25,.30],[-1.7,.49,.47],[-.6,.83,.68],[.2,.78,.65],[.8,.62,.49],
  ].map(([y,w,h])=>new T.Vector3(w,y,h)),false,'centripetal');
  const p:number[]=[],uv:number[]=[],joints:number[]=[],weights:number[]=[],indices:number[]=[];
  const upperRows:number[][]=[],lowerRows:number[][]=[];
  function vertex(x:number,y:number,z:number,u:number,lower:boolean,front:boolean) {
    const index=p.length/3;p.push(x,y,z);uv.push(u,(y+4)/6.14);
    if(front){joints.push(lower?6:3,0,0,0);weights.push(1,0,0,0);}
    else if(y>.1) {
      const head=T.MathUtils.smoothstep(y,.1,.65);
      const ventral=T.MathUtils.smoothstep(-z,-.03,.20);
      const jaw=T.MathUtils.smoothstep(y,.15,.8)*ventral;
      joints.push(0,3,6,0);weights.push(1-head,head*(1-jaw),head*jaw,0);
    } else {
      const first=y<-.7?1:0,second=first+1;
      const weight=T.MathUtils.clamp(first===1?(-y-.7)/.9:(-y-.2)/.5,0,1);
      joints.push(first,second,0,0);weights.push(1-weight,weight,0,0);
    }
    return index;
  }
  for(let row=0;row<=80;row++) {
    const y=-4+row/80*4.8,v=atY(curve,y),ring:number[]=[];
    const power=T.MathUtils.lerp(1,.72,T.MathUtils.smoothstep(y,.3,.8));
    const center=JAW_HINGE_Z*T.MathUtils.smoothstep(y,.2,.8);
    for(let col=0;col<=32;col++) {
      const a=col/32*Math.PI*2,c=Math.cos(a),sn=Math.sin(a);
      const height=v.z*(sn<0?T.MathUtils.lerp(1,.38/.49,T.MathUtils.smoothstep(y,.2,.8)):1);
      ring.push(vertex(Math.sign(c)*Math.abs(c)**power*v.x,y,center+Math.sign(sn)*Math.abs(sn)**power*height,col/32,sn<0,false));
    }
    upperRows.push(ring.slice(0,17));lowerRows.push(ring.slice(16));
  }
  for(let row=1;row<=42;row++) {
    const y=.8+row/42*1.34;
    for(const lower of [false,true]) {
      const v=atY(lower?lowerProfile:upperProfile,y),ring:number[]=[];
      for(let col=0;col<=16;col++) {
        const a=(col/16+(lower?1:0))*Math.PI,c=Math.cos(a),sn=Math.sin(a);
        let x=Math.sign(c)*Math.abs(c)**.72*v.x,z=biteHeight(y,lower)+Math.sign(sn)*Math.abs(sn)**.72*v.z;
        if(!lower) {
          const pocket=Math.exp(-(((Math.abs(x)-.51)/.14)**2+((y-1.04)/.19)**2));
          const n=new T.Vector3(Math.sign(x)*.50,.82,.27).normalize();
          x-=n.x*pocket*.085;z-=n.z*pocket*.085;
        }
        ring.push(vertex(x,y,z,(col/16+(lower?1:0))*.5,lower,true));
      }
      (lower?lowerRows:upperRows).push(ring);
    }
  }
  for(const rows of [upperRows,lowerRows])for(let row=0;row<rows.length-1;row++)for(let col=0;col<16;col++) {
    const a=rows[row][col],b=rows[row+1][col],c=rows[row][col+1],d=rows[row+1][col+1];indices.push(a,b,c,c,b,d);
  }
  const tail=vertex(0,-4,0,.5,false,false);
  for(const ring of [upperRows[0],lowerRows[0]])for(let i=0;i<16;i++)indices.push(tail,ring[i],ring[i+1]);
  for(const lower of [false,true]) {
    const ring=(lower?lowerRows:upperRows).at(-1)!,tip=vertex(0,2.14,lower?lowerBite:0,.5,lower,true);
    for(let i=0;i<16;i++)indices.push(tip,ring[i+1],ring[i]);
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));
  geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));geometry.setIndex(indices);geometry.computeVertexNormals();
  // Smooth the duplicated UV seam only on the unsplit body/neck rings.
  const normals=geometry.getAttribute('normal');
  for(let row=0;row<=80;row++) {
    const a=upperRows[row][0],b=lowerRows[row][16],n=new T.Vector3().fromBufferAttribute(normals,a).add(new T.Vector3().fromBufferAttribute(normals,b)).normalize();
    normals.setXYZ(a,n.x,n.y,n.z);normals.setXYZ(b,n.x,n.y,n.z);
  }
  return geometry;
}

export function marineEyeFrame(side:number) {
  return {position:new T.Vector3(side*.51,1.04,.30),
    rotation:new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(side*.50,.82,.27).normalize())};
}
function orbit(side:number,cup:boolean,head:T.Mesh) {
  const positions:number[]=[],uv:number[]=[],indices:number[]=[],columns=16;
  const rings=cup?[[.088,.123,-.025],[.068,.096,-.07],[.001,.001,-.08]]:
    [[.15,.19,-.035],[.15,.19,.03],[.088,.123,.035],[.088,.123,-.025]];
  const frame=marineEyeFrame(side),normal=new T.Vector3(0,0,1).applyQuaternion(frame.rotation);
  const ray=new T.Raycaster();
  for(const [row,[rx,ry,z]] of rings.entries())for(let i=0;i<=columns;i++) {
    const angle=i/columns*Math.PI*2,c=Math.cos(angle),s=Math.sin(angle);
    const v=new T.Vector3(Math.sign(c)*Math.abs(c)**.7*rx,Math.sign(s)*Math.abs(s)**.7*ry,z);
    // A heavy upper/anterior hood protects a narrow, recessed eye opening.
    if(!cup) {
      const tangent=new T.Vector3(c,s,0).applyQuaternion(frame.rotation);
      v.z+=Math.max(0,tangent.z)*.06+Math.max(0,-tangent.y)*.015;
    }
    v.applyQuaternion(frame.rotation).add(frame.position);
    if(!cup && row===0) {
      // Extend the rear skirt into the actual skull instead of leaving an open
      // floating ring. Every foot is embedded beneath the continuous skin.
      ray.set(v.clone().addScaledVector(normal,.5),normal.clone().negate());
      const hit=ray.intersectObject(head,false)[0];
      if(hit)v.copy(hit.point).addScaledVector(normal,-.035);
    }
    positions.push(v.x,v.y,v.z);uv.push(i/columns,z);
  }
  for(let row=0;row<rings.length-1;row++)for(let col=0;col<columns;col++) {
    const i=row*(columns+1)+col;indices.push(i,i+1,i+columns+1,i+1,i+columns+2,i+columns+1);
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
function oralLight(geometry:T.BufferGeometry) {
  const p=geometry.getAttribute('position'),values:number[]=[];
  for(let i=0;i<p.count;i++)values.push(T.MathUtils.smoothstep(p.getY(i),.80,2.05));
  geometry.setAttribute('oralLight',new T.Float32BufferAttribute(values,1));return geometry;
}
function tongue() {
  const p:number[]=[],uv:number[]=[],indices:number[]=[];
  for(let row=0;row<=24;row++) {
    const t=row/24,y=.94+t*.97,width=.003+.22*(1-t)**.6*Math.sin(.48+t*Math.PI*.5);
    for(let col=0;col<=16;col++) {
      const a=col/16*Math.PI*2,x=Math.cos(a)*width;
      let z=biteHeight(y,true)+.025+Math.sin(t*Math.PI)*.028+Math.sin(a)*.028;
      if(Math.sin(a)>0)z-=Math.exp(-((x/.022)**2))*.007;
      p.push(x,y,z);uv.push(col/16,t);
      if(row<24&&col<16){const i=row*17+col;indices.push(i,i+17,i+1,i+1,i+17,i+18);}
    }
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);
  sealMarineTube(geometry,24,16);geometry.computeVertexNormals();oralLight(geometry);return hingeLocal(geometry);
}
function throat() {
  const p:number[]=[],uv:number[]=[],indices:number[]=[],joints:number[]=[],weights:number[]=[];
  for(let row=0;row<=12;row++)for(let col=0;col<=16;col++) {
    const t=row/12,u=col/8-1;
    p.push(u*.55,.95-Math.sin(t*Math.PI)*(1-u*u)*.16,T.MathUtils.lerp(biteHeight(.95,false),biteHeight(.95,true),t));
    uv.push(col/16,t);joints.push(3,6,0,0);weights.push(1-t,t,0,0);
    if(row<12&&col<16){const i=row*17+col;indices.push(i,i+1,i+17,i+1,i+18,i+17);}
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));
  geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));geometry.setIndex(indices);geometry.computeVertexNormals();return oralLight(geometry);
}

function ridge(profile:number[][]) {
  const positions:number[]=[],uv:number[]=[],indices:number[]=[];
  for(let row=0;row<profile.length;row++) {
    const [x,y,z,w,h]=profile[row];
    for(const [dx,dz] of [[-w,0],[0,-.025],[w,0],[0,h],[-w,0]]) {positions.push(x+dx,y,z+dz);uv.push(dx,row/4);}
    if(row<profile.length-1)for(let col=0;col<4;col++){const i=row*5+col;indices.push(i,i+5,i+1,i+1,i+5,i+6);}
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);
  sealMarineTube(geometry,profile.length-1,4);geometry.computeVertexNormals();return geometry;
}
function hingeLocal(geometry:T.BufferGeometry) { return geometry.translate(0,-JAW_HINGE_Y,-JAW_HINGE_Z); }
function palate(lower:boolean) {
  const p:number[]=[],indices:number[]=[];
  for(let row=0;row<=42;row++) {
    const y=.8+row/42*1.34,v=atY(lower?lowerProfile:upperProfile,y),z=biteHeight(y,lower)+(lower?.002:-.002);
    p.push(-v.x,y,z,v.x,y,z);
    if(row<42){const i=row*2;indices.push(i,i+1,i+2,i+1,i+3,i+2);}
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));geometry.setIndex(indices);
  oralLight(geometry);if(lower)hingeLocal(geometry);geometry.computeVertexNormals();return geometry;
}

function lip(lower:boolean) {
  const curve=new T.CatmullRomCurve3(arcade.getSpacedPoints(56).map(p=>
    new T.Vector3(p.x*(lower?.99:1.03),p.y,lower?lowerBite+.003:-.005)));
  const geometry=new T.TubeGeometry(curve,64,.010,6,false);
  oralLight(geometry);return lower?hingeLocal(geometry):geometry;
}
function teeth(lower:boolean) {
  const pieces:T.BufferGeometry[]=[],count=lower?28:29;
  for(let i=0;i<count;i++) {
    const t=(i+.5)/count,p=arcade.getPointAt(t),height=.085+.035*Math.sin(t*Math.PI);
    const geometry=new T.ConeGeometry(height*.23,height,8).rotateX(lower?Math.PI/2:-Math.PI/2);
    geometry.translate(p.x*(lower?.96:1),p.y,(lower?lowerBite:0)+(lower?height:-height)*.5);
    pieces.push(geometry);
  }
  const geometry=mergeGeometries(pieces);pieces.forEach(p=>p.dispose());
  return lower?hingeLocal(geometry):geometry;
}

let cached: ReturnType<typeof build> | undefined;
function build(prepare:(geometry:T.BufferGeometry)=>T.BufferGeometry) {
  const body=prepare(exterior()),head=new T.Mesh(body,new T.MeshBasicMaterial({side:T.DoubleSide}));
  head.updateMatrixWorld(true);
  const ridges=[prepare(ridge([[0,.65,.47,.07,.11],[0,1.0,.37,.09,.14],[0,1.35,.28,.065,.10],
    [0,1.8,.19,.024,.045],[0,1.98,.13,.008,.016]])),...[-1,1].map(side=>prepare(ridge([
      [side*.47,.72,.36,.065,.09],[side*.44,.92,.28,.08,.13],[side*.43,1.28,.18,.06,.09],
      [side*.28,1.72,.17,.025,.035],[side*.23,1.85,.14,.008,.015]])))];
  return {exterior:body,ridges,throat:throat(),tongue:tongue(),
    socketRims:[-1,1].map(side=>prepare(orbit(side,false,head))),socketCups:[-1,1].map(side=>orbit(side,true,head)),
    upperPalate:palate(false),lowerPalate:palate(true),
    upperTeeth:teeth(false),lowerTeeth:teeth(true),upperLip:lip(false),lowerLip:lip(true)};
}
export function marineJawGeometry(prepare:(geometry:T.BufferGeometry)=>T.BufferGeometry) {
  return cached??=build(prepare);
}
