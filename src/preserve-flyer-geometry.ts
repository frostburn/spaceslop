import * as T from 'three';

type Profile = readonly (readonly [number, number, number, number])[];
export const flyerTorsoProfile: Profile = [
  [.61,.025,-.015,.045],[.44,.13,-.075,.10],[.25,.205,-.13,.16],
  [.02,.23,-.19,.21],[-.19,.21,-.16,.22],[-.32,.15,-.07,.18],[-.47,.09,.015,.17],[-.59,.08,.035,.15],
];
export const flyerSkullProfile: Profile = [
  [.18,.075,-.045,.10],[.08,.135,-.065,.17],[-.06,.145,-.065,.17],[-.17,.106,-.05,.10],
  [-.28,.085,-.042,.062],[-.38,.064,-.030,.043],[-.435,.025,-.015,.025],[-.45,.006,-.005,.008],
];
export const FLYER_EYE = {x:.119,y:-.07,z:.119};
export function flyerSection(profile: Profile, y: number) {
  let j=0;while(j<profile.length-2&&y<profile[j+1][0])j++;
  const a=profile[j],b=profile[j+1],before=profile[Math.max(0,j-1)],after=profile[Math.min(profile.length-1,j+2)];
  const dy=b[0]-a[0],t=T.MathUtils.clamp((y-a[0])/dy,0,1),t2=t*t,t3=t*t*t;
  const at=(k:number)=>(2*t3-3*t2+1)*a[k]+(t3-2*t2+t)*dy*(b[k]-before[k])/(b[0]-before[0])
    +(-2*t3+3*t2)*b[k]+(t3-t2)*dy*(after[k]-a[k])/(after[0]-a[0]);
  return{width:Math.max(.005,at(1)),floor:at(2),crown:at(3)};
}
export function flyerSkinPoint(profile:Profile,y:number,angle:number,skull=false) {
  const p=flyerSection(profile,y),s=Math.sin(angle);
  const point=new T.Vector3(Math.sign(s)*Math.abs(s)**.82*p.width,y,T.MathUtils.lerp(p.floor,p.crown,(.5+.5*Math.cos(angle))**.9));
  if(skull){
    const socket=Math.exp(-(((Math.abs(point.x)-FLYER_EYE.x)/.048)**2+((y-FLYER_EYE.y)/.068)**2+((point.z-FLYER_EYE.z)/.038)**2));
    point.x-=Math.sign(point.x)*socket*.023*T.MathUtils.smoothstep(Math.abs(point.x),.06,.105);
  }
  return point;
}
function vertexColor(g:T.BufferGeometry,skin=false,depths:readonly number[]=[]){
  const p=g.getAttribute('position'),n=g.getAttribute('normal'),colors:number[]=[],color=new T.Color();
  const upper=new T.Color(skin?0x78806b:0x52685f),lower=new T.Color(skin?0xa0a28a:0x858c77),inner=new T.Color(0x24332e);
  for(let i=0;i<p.count;i++){
    color.copy(upper).lerp(lower,T.MathUtils.smoothstep(-n.getZ(i),-.2,.85));
    color.multiplyScalar(.94+.06*Math.sin(p.getY(i)*27+p.getX(i)*31));color.lerp(inner,T.MathUtils.smoothstep(depths[i]??0,.003,.025));
    colors.push(color.r,color.g,color.b);
  }
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));return g;
}
// A closed ribcage/keel, neck and pelvis are one surface. The rostrum similarly
// grows out of a sculpted cranium; paired holes turn into actual nasal tunnels.
export function flyerLoft(profile:Profile,rows=36,sides=24,skull=false) {
  const positions:number[]=[],uv:number[]=[],indices:number[]=[],depths:number[]=[];
  const holes=skull?[{i0:8,i1:12,j0:40,j1:44},{i0:28,i1:32,j0:40,j1:44}]:[];
  const add=(p:T.Vector3,u:number,v:number,depth=0)=>{const id=positions.length/3;positions.push(p.x,p.y,p.z);uv.push(u,v);depths.push(depth);return id;};
  const along=(j:number)=>T.MathUtils.lerp(profile[0][0],profile.at(-1)![0],j/rows);
  for(let j=0;j<=rows;j++)for(let i=0;i<=sides;i++){
    add(flyerSkinPoint(profile,along(j),i/sides*Math.PI*2,skull),i/sides,j/rows);
    if(j<rows&&i<sides&&!holes.some(h=>i>=h.i0&&i<h.i1&&j>=h.j0&&j<h.j1)){
      const a=j*(sides+1)+i;indices.push(a,a+sides+1,a+1,a+1,a+sides+1,a+sides+2);
    }
  }
  for(const h of holes){
    const edge:[number,number][]=[];
    for(let i=h.i0;i<h.i1;i++)edge.push([h.j0,i]);for(let j=h.j0;j<h.j1;j++)edge.push([j,h.i1]);
    for(let i=h.i1;i>h.i0;i--)edge.push([h.j1,i]);for(let j=h.j1;j>h.j0;j--)edge.push([j,h.i0]);
    const centerY=along((h.j0+h.j1)/2),centerA=(h.i0+h.i1)/2/sides*Math.PI*2,side=Math.sign(Math.sin(centerA));
    let previous=edge.map(([j,i])=>j*(sides+1)+i);
    for(const[r,inset]of[[.85,-.0015],[.55,.008],[.18,.024]]){
      const ring=edge.map(([j,i])=>{
        const y=T.MathUtils.lerp(centerY,along(j),r),a=T.MathUtils.lerp(centerA,i/sides*Math.PI*2,r);
        const p=flyerSkinPoint(profile,y,a,true);p.x-=side*inset;return add(p,a/(Math.PI*2),(profile[0][0]-y)/(profile[0][0]-profile.at(-1)![0]),Math.max(0,inset));
      });
      for(let k=0;k<edge.length;k++){const next=(k+1)%edge.length;indices.push(previous[k],ring[k],previous[next],previous[next],ring[k],ring[next]);}previous=ring;
    }
    const p=flyerSkinPoint(profile,centerY,centerA,true);p.x-=side*.03;const cap=add(p,centerA/(Math.PI*2),.75,.03);
    for(let k=0;k<edge.length;k++)indices.push(previous[k],cap,previous[(k+1)%edge.length]);
  }
  for(const j of[0,rows]){
    const s=flyerSection(profile,along(j)),cap=add(new T.Vector3(0,along(j),(s.floor+s.crown)/2),.5,j/rows);
    for(let i=0;i<sides;i++){const a=j*(sides+1)+i;if(j===0)indices.push(cap,a,a+1);else indices.push(cap,a+1,a);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
  const n=g.getAttribute('normal'),v=new T.Vector3();
  for(let j=0;j<=rows;j++){const a=j*(sides+1),b=a+sides;v.fromBufferAttribute(n,a).add(new T.Vector3().fromBufferAttribute(n,b)).normalize();n.setXYZ(a,v.x,v.y,v.z);n.setXYZ(b,v.x,v.y,v.z);}
  return vertexColor(g,skull,depths);
}
// Muscle bellies taper through the elbow/wrist or knee/ankle, without balls at
// the joints. The same helper makes a tapering muscular tail and hooked digits.
export function flyerSkinTube(points:readonly (readonly [number,number,number])[],radii:readonly number[],rows=18,sides=10) {
  const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),g=new T.TubeGeometry(curve,rows,1,sides,false),p=g.getAttribute('position');
  for(let row=0;row<=rows;row++){
    const t=row/rows,c=curve.getPointAt(t),u=t*(radii.length-1),i=Math.min(radii.length-2,Math.floor(u)),r=T.MathUtils.lerp(radii[i],radii[i+1],u-i);
    for(let k=0;k<=sides;k++){const j=row*(sides+1)+k;p.setXYZ(j,c.x+(p.getX(j)-c.x)*r,c.y+(p.getY(j)-c.y)*r,c.z+(p.getZ(j)-c.z)*r*.82);}
  }
  g.computeVertexNormals();return vertexColor(g);
}
