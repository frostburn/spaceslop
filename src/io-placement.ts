import {ioChannel} from './io-layout';

// Transfer yards occupy gaps between vessel clusters, rather than cutting
// diagonally through them. The long crossing sits in the open refinery entry.
export const ioConveyorRoutes=[[-5,9,-3.2,15],[5.5,24,3.2,33],[-5.5,39,-3.2,47],
  [5.5,51,3.2,57],[-5.5,62,-3.2,67],[5.5,73,3.2,77],[-5.7,89,5.4,92]] as const;

// Includes the feeder behind the source and receiver pipe beyond the sink.
export function ioConveyorClearance(x:number,y:number,halfX=0,halfY=halfX){
  return ioConveyorRoutes.some(([x1,y1,x2,y2])=>{
    const ax=x1+ioChannel(y1),bx=x2+ioChannel(y2),dx=bx-ax,dy=y2-y1,length=Math.hypot(dx,dy);
    const a=[ax-dx/length*2.3,y1-dy/length*2.3],b=[bx+dx/length*2.3,y2+dy/length*2.3];
    // Segment versus expanded footprint (slab clipping). Conservative corners
    // provide service space around the .86-wide belt and wider terminal bins.
    let lo=0,hi=1;
    for(let axis=0;axis<2;axis++){
      const center=axis===0?x:y,extent=(axis===0?halfX:halfY)+1.0,d=b[axis]-a[axis];
      if(Math.abs(d)<1e-9){if(Math.abs(a[axis]-center)>extent)return false;}
      else{const t1=(center-extent-a[axis])/d,t2=(center+extent-a[axis])/d;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));if(lo>hi)return false;}
    }
    return true;
  });
}

export function ioSiteX(sx:number,y:number,kind:string){
  const side=Math.sign(sx);let x=sx-side*.55+ioChannel(y);
  // Main vessel, maintenance platform, outer tank and access rails. Low branch
  // pipes may still travel beneath elevated belts; solid structures may not.
  const halfX=kind==='pump'?1.1:2.5,halfY=kind==='pump'?1.8:3.4;
  const centerOffset=kind==='pump'?0:side*.6;
  while(ioConveyorClearance(x+centerOffset,y+.6,halfX,halfY))x+=side*.5;
  return x;
}
