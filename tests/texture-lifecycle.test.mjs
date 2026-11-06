import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import * as T from 'three';
import {createServer} from 'vite';
const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,define:{__ENCOUNTER_TEXTURES__:JSON.stringify({armor:'encounters/test.png?v=123'})},server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});after(()=>server.close());
const {loadEncounterTexture}=await server.ssrLoadModule('/src/encounter-texture.ts');

test('cancelled preparation resolves promptly and a late image cannot overwrite the next scene',async()=>{
 const previousWindow=globalThis.window,originalLoad=T.TextureLoader.prototype.load;globalThis.window={setTimeout};let complete,calls=0,disposed=0;
 T.TextureLoader.prototype.load=function(url,onLoad){assert(url.endsWith('encounters/test.png?v=123'));complete=onLoad;calls++;return new T.Texture();};
 try{
  const controller=new AbortController();let applied=0;
  const pending=loadEncounterTexture('armor',()=>applied++,undefined,controller.signal);assert.equal(calls,1);controller.abort();assert.equal(await pending,undefined);
  const image=new T.Texture();image.addEventListener('dispose',()=>disposed++);complete(image);assert.equal(applied,0);assert.equal(disposed,1);
  await loadEncounterTexture('armor',()=>applied++,undefined,controller.signal);assert.equal(calls,1,'already-cancelled scope starts another image');
 }finally{T.TextureLoader.prototype.load=originalLoad;globalThis.window=previousWindow;}
});
