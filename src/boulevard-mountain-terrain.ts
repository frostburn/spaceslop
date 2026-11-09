import {boulevardRandom} from './boulevard-geometry';
import type {VectorPoint} from './boulevard-vectors';
type Site=readonly[number,number];
type Triangle={a:number;b:number;c:number;x:number;y:number;r2:number};
// Eight overlapping, anisotropic peaks create shoulders, saddles and valleys.
// Heights are independent of the triangulation, so facets describe real relief.
const peaks=[[-31,-2,8.5,14,14,-.22],[-23,-6,5.8,16,13,.18],[-16,-1.5,8.6,14,15,-.10],[-7,-5,2.8,14,12,.30],[3,-2,1.7,12,12,-.14],[12,-4,6.8,16,14,.22],[22,-1.6,9.7,16,16,-.18],[31,-6,7.7,18,14,.13]];
function height(x:number,y:number){
 let z=-9+.35*Math.sin(x*.31+y*.47);
 for(const[px,py,top,rx,ry,angle]of peaks){const dx=x-px,dy=y-py,u=dx*Math.cos(angle)+dy*Math.sin(angle),v=-dx*Math.sin(angle)+dy*Math.cos(angle);z=Math.max(z,top-(top+5)*Math.abs(u)/rx-(top+9)*Math.abs(v)/ry);}
 return z;
}
function triangulate(input:readonly Site[]){
 const points:Site[]=[...input,[-200,-100],[200,-100],[0,200]],n=input.length;
 function triangle(a:number,b:number,c:number):Triangle|undefined{
  const[ax,ay]=points[a],[bx,by]=points[b],[cx,cy]=points[c],d=2*(ax*(by-cy)+bx*(cy-ay)+cx*(ay-by));if(Math.abs(d)<1e-10)return;
  const aa=ax*ax+ay*ay,bb=bx*bx+by*by,cc=cx*cx+cy*cy,x=(aa*(by-cy)+bb*(cy-ay)+cc*(ay-by))/d,y=(aa*(cx-bx)+bb*(ax-cx)+cc*(bx-ax))/d;return{a,b,c,x,y,r2:(x-ax)**2+(y-ay)**2};
 }
 let triangles=[triangle(n,n+1,n+2)!];
 for(let i=0;i<n;i++){
  const[x,y]=points[i],bad=new Set(triangles.filter(t=>(x-t.x)**2+(y-t.y)**2<=t.r2+1e-8)),edges=new Map<string,{a:number;b:number;count:number}>();
  for(const t of bad)for(const[a,b]of[[t.a,t.b],[t.b,t.c],[t.c,t.a]]){const key=Math.min(a,b)+':'+Math.max(a,b),edge=edges.get(key);if(edge)edge.count++;else edges.set(key,{a,b,count:1});}
  triangles=triangles.filter(t=>!bad.has(t));for(const{a,b,count}of edges.values())if(count===1){const t=triangle(a,b,i);if(t)triangles.push(t);}
 }
 return triangles.filter(t=>t.a<n&&t.b<n&&t.c<n).flatMap(t=>{const a=points[t.a],b=points[t.b],c=points[t.c];return(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])>0?[t.a,t.b,t.c]:[t.a,t.c,t.b];});
}
export function mountainTerrain(){
 const back=[-35,-31.8,-29.2,-25.5,-23.5,-20.1,-17,-14.4,-11.2,-8.9,-5.5,-2.5,1,4.3,7.5,10.8,14,17.4,20,23,26.1,29.4,32.8,35],sites:Site[]=back.map(x=>[x,0]);
 for(let i=0;i<=16;i++)sites.push([-35+i*70/16,-14]);for(const x of[-35,35])for(const y of[-11,-7,-3.5])sites.push([x,y]);
 const add=(x:number,y:number,gap=.85)=>{if(x<=-35||x>=35||y<=-14||y>=0||sites.some(([px,py])=>Math.hypot(x-px,y-py)<gap))return;sites.push([x,y]);};
 for(const[x,y,,rx,ry,angle]of peaks){add(x,y);for(const side of[-1,1]){add(x+side*rx*.36*Math.cos(angle),y+side*rx*.36*Math.sin(angle));add(x-side*ry*.28*Math.sin(angle),y+side*ry*.28*Math.cos(angle));}}
 const random=boulevardRandom(0x5a71);for(let i=0;i<280&&sites.length<124;i++)add(-34.5+random()*69,-13.5+random()*13,1.55);
 const points:VectorPoint[]=sites.map(([x,y])=>[x,y,height(x,y)]),crest=points.slice(0,back.length);
 return{points,crest,triangles:triangulate(sites)};
}
