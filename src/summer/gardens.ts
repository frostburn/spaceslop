import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {SUMMER_FLOOR} from './layout';
import {summerChannel,summerShoreDistance} from './river';
import {lotusLeaf,meadowFlower} from './botany';

// Increasingly tended banks introduce the palace's stone and botanical vocabulary.
export function createRiverGardens(){
  const root=new T.Group();root.name='summer-river-gardens';
  const stone=new T.MeshStandardMaterial({color:0xa9a58b,roughness:.88}),soil=new T.MeshStandardMaterial({color:0x464a32,roughness:1});
  const green=new T.MeshStandardMaterial({color:0x657c46,roughness:.9,side:T.DoubleSide}),petal=new T.MeshStandardMaterial({color:0xcbbac3,roughness:.8}),lamp=new T.MeshBasicMaterial({color:0xffdab1});
  const leaf=lotusLeaf(),flower=meadowFlower();
  const sites=[194,212,230,248,264].map((y,i)=>{
    const node=new T.Group();node.position.y=y;root.add(node);
    const buckets=new Map<T.Material,T.BufferGeometry[]>();
    const add=(geometry:T.BufferGeometry,material:T.Material,x:number,dy:number,z:number,angle=0)=>{
      const g=geometry.index?geometry.toNonIndexed():geometry;if(g!==geometry)geometry.dispose();
      g.rotateZ(angle);g.translate(x,dy,z);const parts=buckets.get(material)??[];parts.push(g);buckets.set(material,parts);
    };
    for(const side of[-1,1]){
      if(i===0&&side===1)continue;
      const channel=summerChannel(y),x=channel.x+side*(channel.width*Math.sqrt(1+channel.slope**2)+2.5);
      add(new T.CylinderGeometry(1,1.08,.3,28).rotateX(Math.PI/2).scale(1,1.6,1),stone,x,0,SUMMER_FLOOR+.19);
      add(new T.CircleGeometry(.88,28).scale(1,1.6,1),soil,x,0,SUMMER_FLOOR+.35);
      for(let j=0;j<13;j++){
        const a=j*2.39996,r=.22+(j%3)*.2,px=x+Math.cos(a)*r,py=Math.sin(a)*r*1.6;
        add(leaf.clone().scale(.34,.42,.65),green,px,py,SUMMER_FLOOR+.37,a);
        if(j%3===0)add(flower.clone().scale(2.6,2.6,2.6),petal,px,py,SUMMER_FLOOR+.66,a);
      }
      for(let j=-5;j<=5;j++){
        const dy=j*.78,p=summerChannel(y+dy),px=p.x+side*(p.width*Math.sqrt(1+p.slope**2)+4.2);
        if(summerShoreDistance(px,y+dy)<.7)continue;
        add(new T.BoxGeometry(.52,.58,.1),stone,px,dy,SUMMER_FLOOR+.09,-Math.atan(p.slope)+(j%2?-.08:.05));
      }
      for(const dy of[-1.9,1.9]){
        add(new T.CylinderGeometry(.085,.12,.7,8).rotateX(Math.PI/2),stone,x+side*1.15,dy,SUMMER_FLOOR+.4);
        add(new T.SphereGeometry(.12,10,6).scale(1,1,.65),lamp,x+side*1.15,dy,SUMMER_FLOOR+.8);
      }
    }
    for(const[material,parts]of buckets){const geometry=mergeGeometries(parts)!;parts.forEach(p=>p.dispose());node.add(new T.Mesh(geometry,material));}
    return{node,y};
  });
  leaf.dispose();flower.dispose();
  return{root,sites,update(scroll:number){for(const site of sites)site.node.visible=Math.abs(site.y-scroll)<40;},
    prime(){const states=sites.map(s=>[s.node.visible,s.node.position.y] as const);sites.forEach(s=>{s.node.visible=true;s.node.position.y=0;});return()=>sites.forEach((s,i)=>{s.node.visible=states[i][0];s.node.position.y=states[i][1];});}};
}
