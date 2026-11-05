import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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
      const height=upper?T.MathUtils.lerp(sine,Math.max(0,sine),flatten):Math.min(0,sine);
      positions.push(Math.cos(theta)*Math.max(.001,p.x),p.y,(upper?0:lowerBite)+height*Math.max(.001,p.z));
      uv.push(j/columns,i/rows);
      if(i<rows&&j<columns){const n=i*(columns+1)+j;indices.push(n,n+columns+1,n+1,n+1,n+columns+1,n+columns+2);}
    }
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const normal=geometry.getAttribute('normal');
  for(let row=0;row<=rows;row++) {
    const a=row*(columns+1),b=a+columns;
    const n=new T.Vector3(normal.getX(a)+normal.getX(b),normal.getY(a)+normal.getY(b),normal.getZ(a)+normal.getZ(b)).normalize();
    normal.setXYZ(a,n.x,n.y,n.z);normal.setXYZ(b,n.x,n.y,n.z);
  }
  return geometry;
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
  const skull=prepare(shell([[.60,.70,.53],[.83,.63,.42],[1.12,.57,.33],
    [1.55,.48,.25],[1.94,.28,.16],[2.10,.07,.06],[2.14,.001,.002]],true));
  const mandible=hingeLocal(prepare(shell([[.78,.54,.14],[.9,.56,.17],[1.25,.50,.16],
    [1.65,.39,.12],[1.92,.23,.09],[2.06,.14,.05],[2.12,.001,.002]],false)));
  const hinges=[-1,1].map(side=>prepare(new T.SphereGeometry(1,20,12)
    .scale(.12,.15,.16).translate(side*.51,JAW_HINGE_Y,JAW_HINGE_Z)));
  return {skull,mandible,hinges,upperPalate:palate(false),lowerPalate:palate(true),
    upperTeeth:teeth(false),lowerTeeth:teeth(true),upperLip:lip(false),lowerLip:lip(true)};
}
export function marineJawGeometry(prepare:(geometry:T.BufferGeometry)=>T.BufferGeometry) {
  return cached??=build(prepare);
}
