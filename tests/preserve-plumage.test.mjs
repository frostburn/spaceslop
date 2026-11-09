import assert from 'node:assert/strict';import {after,test} from 'node:test';import * as T from 'three';import {createServer} from 'vite';
const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});after(()=>server.close());
const {createGroundskeeper}=await server.ssrLoadModule('/src/groundskeeper-rig.ts');
const luminance=c=>c.r*.2126+c.g*.7152+c.b*.0722;

test('sparrow camouflage has a pale underside, dark streaks and warm back patches at feather-root scale',()=>{
 const rig=createGroundskeeper(),body=rig.root.getObjectByName('heavy-torso').children.find(o=>o.isInstancedMesh&&o.count===4200),matrix=new T.Matrix4(),p=new T.Vector3(),c=new T.Color(),front=[],back=[];
 for(let i=0;i<body.count;i++){body.getMatrixAt(i,matrix);p.setFromMatrixPosition(matrix);body.getColorAt(i,c);if(p.y<-1.9)front.push(luminance(c));if(p.y>1.8)back.push(luminance(c));}
 const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
 assert(front.length>400&&back.length>400);assert(mean(front)>mean(back)*1.4,'underside loses its countershading');
 assert(Math.max(...front)-Math.min(...front)>.25,'breast must have contrasting markings rather than a uniform color wash');
 assert(Math.max(...back)-Math.min(...back)>.1,'back patches should include both warm and dark feathers');
});

test('camouflage stays attached during breathing, warning hackles, scrubbing and reviewed map replacement',()=>{
 const rig=createGroundskeeper(),colors=[];rig.root.traverse(o=>{if(o.isInstancedMesh&&o.instanceColor)colors.push([o,o.instanceColor.array.slice(),o.instanceColor.array]);});
 for(const t of[-1.4,1.8,2.5,5.6,8,0])rig.pose(t);
 for(const[o,values,array]of colors){assert.equal(o.instanceColor.array,array);assert.deepEqual(o.instanceColor.array,values);}
 const map=new T.Texture();rig.setFeatherTexture(map);assert.equal(rig.materials.feathers.map,map);
 for(const[o,values]of colors)assert.deepEqual(o.instanceColor.array,values,'uploaded relief must not recolor the camouflage');
});
