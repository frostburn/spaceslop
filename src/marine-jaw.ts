import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { sealMarineTube } from './marine-geometry';

export const JAW_HINGE_Y = .80;
export const JAW_HINGE_Z = -.09;
const lowerBite = -.18;

// A single rounded arcade supplies both tooth rows, lips and oral lining.
// Geometry starts in the animal's bind frame; only the mandible is subsequently
// moved into hinge-local space. This keeps the closed bite aligned across parts.
const arcade = new T.CatmullRomCurve3([
  [-.55,.83],[-.48,1.25],[-.31,1.75],[-.12,2.04],[0,2.09],
  [.12,2.04],[.31,1.75],[.48,1.25],[.55,.83],
].map(([x,y])=>new T.Vector3(x,y,0)),false,'centripetal');

function shell(profile:number[][], upper:boolean) {
  const curve=new T.CatmullRomCurve3(profile.map(([y,w,h])=>new T.Vector3(w,y,h)),false,'centripetal');
  const positions:number[]=[],uv:number[]=[],indices:number[]=[];
  const rows=52,columns=32;
  for(let i=0;i<=rows;i++) {
    const p=curve.getPoint(i/rows), flatten=T.MathUtils.smoothstep(p.y,.64,.82);
    for(let j=0;j<=columns;j++) {
      const theta=j/columns*Math.PI*2,sine=Math.sin(theta);
      const cosine=Math.cos(theta), angular=(v:number)=>Math.sign(v)*Math.abs(v)**.72;
      const height=upper?T.MathUtils.lerp(angular(sine),Math.max(0,angular(sine)),flatten):Math.min(0,angular(sine));
      let x=angular(cosine)*Math.max(.001,p.x),z=(upper?0:lowerBite)+height*Math.max(.001,p.z);
      if(upper && sine>0) {
        // Depress the actual skull surface into each orbit so the eye can sit
        // behind the rim rather than floating on top of an unbroken forehead.
        const pocket=Math.exp(-(((Math.abs(x)-.50)/.14)**2+((p.y-1.05)/.19)**2));
        x-=Math.sign(x)*pocket*.065;z-=pocket*.060;
      }
      positions.push(x,p.y,z);
      uv.push(j/columns,i/rows);
      if(i<rows&&j<columns){const n=i*(columns+1)+j;indices.push(n,n+columns+1,n+1,n+1,n+columns+1,n+columns+2);}
    }
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);sealMarineTube(geometry,rows,columns);geometry.computeVertexNormals();
  const normal=geometry.getAttribute('normal');
  for(let row=0;row<=rows;row++) {
    const a=row*(columns+1),b=a+columns;
    const n=new T.Vector3(normal.getX(a)+normal.getX(b),normal.getY(a)+normal.getY(b),normal.getZ(a)+normal.getZ(b)).normalize();
    normal.setXYZ(a,n.x,n.y,n.z);normal.setXYZ(b,n.x,n.y,n.z);
  }
  return geometry;
}

export function marineEyeFrame(side:number) {
  return {position:new T.Vector3(side*.50,1.05,.25),
    rotation:new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(side*.76,0,.65).normalize())};
}
function orbit(side:number,cup:boolean) {
  const positions:number[]=[],uv:number[]=[],indices:number[]=[],columns=16;
  const rings=cup?[[.088,.123,-.025],[.068,.096,-.07],[.001,.001,-.08]]:
    [[.15,.19,-.035],[.15,.19,.03],[.088,.123,.035],[.088,.123,-.025]];
  const frame=marineEyeFrame(side);
  for(const [rx,ry,z] of rings)for(let i=0;i<=columns;i++) {
    const angle=i/columns*Math.PI*2,c=Math.cos(angle),s=Math.sin(angle);
    const v=new T.Vector3(Math.sign(c)*Math.abs(c)**.7*rx,Math.sign(s)*Math.abs(s)**.7*ry,z);
    // A heavy upper/anterior hood protects a narrow, recessed eye opening.
    if(!cup)v.z+=Math.max(0,-side*c)*.045+Math.max(0,s)*.015;
    v.applyQuaternion(frame.rotation).add(frame.position);positions.push(v.x,v.y,v.z);uv.push(i/columns,z);
  }
  for(let row=0;row<rings.length-1;row++)for(let col=0;col<columns;col++) {
    const i=row*(columns+1)+col;indices.push(i,i+1,i+columns+1,i+1,i+columns+2,i+columns+1);
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
function throat() {
  const positions:number[]=[],uv:number[]=[],indices:number[]=[],weights:number[]=[],joints:number[]=[],columns=24;
  // Bury the rear ring inside the fully head-bound part of the neck. A ring on
  // the torso's blend region can pull out into a visible collar when the head tilts.
  const rings=[[.66,.54,-.12,.27],[.76,.51,-.18,.25],[.87,.46,-.23,.19],[1.0,.41,-.25,.13]];
  for(let row=0;row<rings.length;row++)for(let col=0;col<=columns;col++) {
    const [y,w,z,h]=rings[row],angle=col/columns*Math.PI*2;
    positions.push(Math.cos(angle)*w,y,z+Math.sin(angle)*h);uv.push(col/columns,row/3);
    const jaw=row===0?0:row===3?1:(row/3)*(.7-.3*Math.sin(angle));
    joints.push(0,1,0,0);weights.push(1-jaw,jaw,0,0);
    if(row<rings.length-1&&col<columns){const i=row*(columns+1)+col;indices.push(i,i+columns+1,i+1,i+1,i+columns+1,i+columns+2);}
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));
  geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));geometry.setIndex(indices);
  const skinIndices=indices.length;
  sealMarineTube(geometry,3,columns);geometry.computeVertexNormals();
  // The front closure is inside the mouth; expose dark oral tissue, not a pale
  // skin-colored disk across the open bite. The rear closure is buried in the neck.
  geometry.addGroup(0,skinIndices,0);geometry.addGroup(skinIndices,columns*6,1);return geometry;
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
  const points=arcade.getSpacedPoints(56).map(p=>new T.Vector2(p.x*(lower?.92:.97),p.y));
  const geometry=new T.ShapeGeometry(new T.Shape(points));
  const p=geometry.getAttribute('position');
  for(let i=0;i<p.count;i++)p.setZ(i,lower?lowerBite+.012:-.018);
  if(lower)hingeLocal(geometry);
  geometry.computeVertexNormals();return geometry;
}
function lip(lower:boolean) {
  const curve=new T.CatmullRomCurve3(arcade.getSpacedPoints(56).map(p=>
    new T.Vector3(p.x*(lower?.99:1.03),p.y,lower?lowerBite+.003:-.005)));
  const geometry=new T.TubeGeometry(curve,64,.010,6,false);
  return lower?hingeLocal(geometry):geometry;
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
  const skull=prepare(shell([[.60,.70,.53],[.83,.65,.45],[1.12,.59,.34],
    [1.40,.52,.25],[1.72,.40,.20],[1.98,.24,.14],[2.10,.09,.055],[2.14,.001,.002]],true));
  const mandible=hingeLocal(prepare(shell([[.78,.54,.14],[.9,.56,.17],[1.25,.50,.16],
    [1.65,.39,.12],[1.92,.23,.09],[2.06,.14,.05],[2.12,.001,.002]],false)));
  const hinges=[-1,1].map(side=>prepare(new T.SphereGeometry(1,20,12)
    .scale(.12,.15,.16).translate(side*.51,JAW_HINGE_Y,JAW_HINGE_Z)));
  const ridges=[prepare(ridge([[0,.65,.47,.07,.11],[0,1.0,.37,.09,.14],[0,1.35,.28,.065,.10],
    [0,1.8,.19,.024,.045],[0,1.98,.13,.008,.016]])),...[-1,1].map(side=>prepare(ridge([
      [side*.47,.72,.36,.065,.09],[side*.44,.92,.28,.08,.13],[side*.43,1.28,.18,.06,.09],
      [side*.28,1.72,.17,.025,.035],[side*.23,1.85,.14,.008,.015]])))];
  return {skull,mandible,hinges,ridges,throat:prepare(throat()),
    socketRims:[-1,1].map(side=>prepare(orbit(side,false))),socketCups:[-1,1].map(side=>orbit(side,true)),
    upperPalate:palate(false),lowerPalate:palate(true),
    upperTeeth:teeth(false),lowerTeeth:teeth(true),upperLip:lip(false),lowerLip:lip(true)};
}
export function marineJawGeometry(prepare:(geometry:T.BufferGeometry)=>T.BufferGeometry) {
  return cached??=build(prepare);
}
