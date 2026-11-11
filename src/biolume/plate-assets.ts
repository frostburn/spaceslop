import * as T from 'three';
import {encounterTextureUrl} from '../encounter-texture';
import {GROVE_SCREENS} from './route';

export const PLATE_GUTTER=4,PLATE_MAX_WIDTH=720;
export function plateSlice(width:number,height:number,index:number){
  const w=Math.min(PLATE_MAX_WIDTH,width),h=Math.round(w*16/9);
  return{width:w,height:h+2*PLATE_GUTTER,screenHeight:h,sourceY:height-(index+1)*height/GROVE_SCREENS,
    cropStart:PLATE_GUTTER/(h+2*PLATE_GUTTER),cropEnd:(h+PLATE_GUTTER)/(h+2*PLATE_GUTTER)};
}

// Decode one owner-supplied tall image, but never create/upload a tall GPU
// texture. Publish only a complete set of bounded, guttered screen textures.
export function loadGrovePlate(name:'biolumeBackdrop'|'biolumeForeground',signal:AbortSignal){
  const url=encounterTextureUrl(name);if(!url||signal.aborted)return Promise.resolve<T.Texture[]>([]);
  return new Promise<T.Texture[]>(resolve=>{
    const image=new Image(),textures:T.Texture[]=[];let alive=true;
    const cleanup=()=>{clearTimeout(deadline);signal.removeEventListener('abort',cancel);image.onload=null;image.onerror=null;image.src='';};
    const fail=()=>{if(!alive)return;alive=false;cleanup();for(const t of textures){t.dispose();const c=t.image as HTMLCanvasElement;c.width=c.height=1;}resolve([]);};
    const cancel=()=>fail(),deadline=window.setTimeout(fail,20000);
    signal.addEventListener('abort',cancel,{once:true});image.onerror=fail;
    image.onload=async()=>{
      try{
        for(let i=0;i<GROVE_SCREENS;i++){
          await new Promise<void>(r=>requestAnimationFrame(()=>r()));if(!alive||signal.aborted){fail();return;}
          const s=plateSlice(image.naturalWidth,image.naturalHeight,i),canvas=document.createElement('canvas');canvas.width=s.width;canvas.height=s.height;
          const context=canvas.getContext('2d');if(!context)throw Error('No canvas context');
          context.drawImage(image,0,0,image.naturalWidth,image.naturalHeight,0,PLATE_GUTTER-(GROVE_SCREENS-1-i)*s.screenHeight,s.width,s.screenHeight*GROVE_SCREENS);
          // Clamp the external ends; interior gutters include the neighboring
          // screen's real pixels, preserving both filtering and vein sampling.
          if(i===GROVE_SCREENS-1)context.drawImage(canvas,0,PLATE_GUTTER,s.width,1,0,0,s.width,PLATE_GUTTER);
          if(i===0)context.drawImage(canvas,0,s.height-PLATE_GUTTER-1,s.width,1,0,s.height-PLATE_GUTTER,s.width,PLATE_GUTTER);
          const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.generateMipmaps=false;map.minFilter=map.magFilter=T.LinearFilter;textures.push(map);
        }
        if(!alive||signal.aborted){fail();return;}alive=false;cleanup();resolve(textures);
      }catch{fail();}
    };
    image.src=url;
  });
}
