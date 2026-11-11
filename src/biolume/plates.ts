import * as T from 'three';
import {createSurface,type LightUniforms} from './surface';
import {GROVE_SCREENS,GROVE_GROUND_Z,GROVE_LEAF_Z,groveTileY,grovePlateHeight} from './route';
import {loadGrovePlate,PLATE_GUTTER} from './plate-assets';

export function createGrovePlates(shared:LightUniforms,signal:AbortSignal){
  const root=new T.Group();root.name='grove-raster-layers';
  const layers=([false,true]as const).map(foreground=>Array.from({length:GROVE_SCREENS},(_,screen)=>{
    const z=foreground?GROVE_LEAF_Z:GROVE_GROUND_Z,h=grovePlateHeight(z);
    const surface=createSurface(foreground?'foreground':'backdrop',h*9/16,h,shared,screen);
    surface.mesh.name=`grove-${foreground?'foreground':'ground'}-${screen}`;
    surface.mesh.position.z=z;surface.mesh.renderOrder=foreground?10:-10;root.add(surface.mesh);
    return surface;
  }));
  let priming=false,disposed=false;const maps:T.Texture[]=[];
  const ready=Promise.all((['biolumeBackdrop','biolumeForeground']as const).map(async(name,index)=>{
    const textures=await loadGrovePlate(name,signal);
    if(disposed||signal.aborted){for(const t of textures)t.dispose();return[];}
    maps.push(...textures);
    textures.forEach((map,i)=>{const height=(map.image as HTMLCanvasElement).height;layers[index][i].setArt(map,PLATE_GUTTER/height,1-PLATE_GUTTER/height);});
    return textures;
  })).then(textures=>textures.flat());
  function update(time:number){for(let layer=0;layer<2;layer++)for(let i=0;i<GROVE_SCREENS;i++){
    const mesh=layers[layer][i].mesh;mesh.position.y=groveTileY(i,time,layer===1);
    mesh.visible=priming||Math.abs(mesh.position.y)<grovePlateHeight(mesh.position.z)*1.1;
  }}
  update(0);
  return{root,ready,layers,update,prime(value:boolean){priming=value;for(const layer of layers)for(const s of layer)s.mesh.frustumCulled=!value;update(0);},
    dispose(){if(disposed)return;disposed=true;for(const layer of layers)for(const s of layer){s.mesh.material.uniforms.map.value=null;s.fallback.dispose();}for(const map of maps){map.dispose();const canvas=map.image as HTMLCanvasElement;canvas.width=canvas.height=1;}maps.length=0;}};
}
