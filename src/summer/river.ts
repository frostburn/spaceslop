// The same piecewise cubic channel drives scenery, planting and hydra anchors.
// Uneven bend spacing avoids the repeated, nearly parallel old sine channels.
const stations=[
  [-40,-1.2,1.35],[-26,4.4,1.65],[-12,-4,1.45],[3,1.8,1.35],
  [17,4.8,1.8],[32,-4.6,1.6],[47,4.6,1.85],[61,-4.6,1.55],
  [76,1.1,1.45],[90,4.8,1.9],[105,-4.3,1.55],[120,4.2,1.75],
  [136,-4.2,1.65],[150,2,1.5],[164,-1.2,1.5],[180,4.7,1.85],
  [196,-4.7,1.6],[212,4.5,1.8],[228,-.8,1.55],[243,4.2,1.7],
  [258,-4.1,1.75],[274,1.5,1.5],[285,0,1.65],[310,0,1.65],[350,0,1.65],
] as const;
type Cubic=readonly [number,number,number,number];
function tangent(i:number,axis:1|2){
  if(i===0||i===stations.length-1)return 0;
  const left=(stations[i][axis]-stations[i-1][axis])/(stations[i][0]-stations[i-1][0]);
  const right=(stations[i+1][axis]-stations[i][axis])/(stations[i+1][0]-stations[i][0]);
  if(left*right<=0)return 0;
  return 2*left*right/(left+right);
}
function cubic(i:number,axis:1|2):Cubic{
  const h=stations[i+1][0]-stations[i][0],a=stations[i][axis],b=stations[i+1][axis],m=tangent(i,axis)*h,n=tangent(i+1,axis)*h;
  return[2*a-2*b+m+n,-3*a+3*b-2*m-n,m,a];
}
const sections=stations.slice(0,-1).map((p,i)=>({from:p[0],to:stations[i+1][0],x:cubic(i,1),width:cubic(i,2)}));
const evaluate=(c:Cubic,u:number)=>((c[0]*u+c[1])*u+c[2])*u+c[3];
export function summerChannel(y:number){
  const s=sections.find(s=>y<s.to)??sections[sections.length-1],h=s.to-s.from,u=Math.max(0,Math.min(1,(y-s.from)/h));
  const slope=((3*s.x[0]*u+2*s.x[1])*u+s.x[2])/h;
  return{x:evaluate(s.x,u),width:evaluate(s.width,u),slope,curve:(6*s.x[0]*u+2*s.x[1])/(h*h)};
}
export function summerRiver(y:number){return summerChannel(y).x;}
export function summerShoreDistance(x:number,y:number){const p=summerChannel(y);return Math.abs(x-p.x)/Math.sqrt(1+p.slope*p.slope)-p.width;}
export function summerRiverShader(){
  const f=(n:number)=>`(${n.toFixed(8)})`,poly=(c:Cubic)=>`((${f(c[0])}*u+${f(c[1])})*u+${f(c[2])})*u+${f(c[3])}`;
  return `vec4 summerChannel(float y){\n${sections.map((s,i)=>{
    const h=s.to-s.from;
    return `${i<sections.length-1?`if(y<${f(s.to)})`:''}{float u=clamp((y-${f(s.from)})/${f(h)},0.,1.);return vec4(${poly(s.x)},${poly(s.width)},((3.*${f(s.x[0])}*u+2.*${f(s.x[1])})*u+${f(s.x[2])})/${f(h)},(6.*${f(s.x[0])}*u+2.*${f(s.x[1])})/${f(h*h)});}`;
  }).join('\n')}\n}`;
}
export function mammothBankX(y:number,preferred:number,size:number){
  // Check the full grazing footprint, including the trunk ahead of the head.
  let best=preferred*5.5,clearance=-Infinity;
  for(const side of[preferred,-preferred])for(const magnitude of[4.6,5.2,5.8,6.35]){
    const x=side*magnitude;let dry=Infinity;
    for(const dx of[-1.4,0,1.4])for(const dy of[-4,-2,0,1.8])dry=Math.min(dry,summerShoreDistance(x+dx*size,y+dy*size));
    if(dry>clearance){best=x;clearance=dry;}if(dry>.5)return x;
  }
  return best;
}
