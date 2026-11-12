import * as T from 'three';
import type {LevelFrame} from '../rendering/level';
import type {LightUniforms} from './surface';
import {frogSignal} from './frog';
import {grovePods,groveLeafLights,groveSitePoint,groveScroll,type GroveSite} from './route';

export function createGroveLighting(shared:LightUniforms){
  const root=new T.Group();root.name='grove-local-lighting';
  shared.lightRange.value.set([8,8,7,7,6,7,9,8]);
  const lights=Array.from({length:8},(_,i)=>new T.PointLight([0xffb34e,0xffab45,0x42ffe0,0x7cecff,0xa5ffd4,0x66dfff,0xff8c42,0x83eeff][i],0,shared.lightRange.value[i],2));root.add(...lights);
  const geometry=new T.PlaneGeometry(1,1);
  const halos=lights.map(light=>{
    const material=new T.ShaderMaterial({uniforms:{color:{value:light.color},gain:{value:0}},transparent:true,depthWrite:false,blending:T.AdditiveBlending,
      vertexShader:'varying vec2 p;void main(){p=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'varying vec2 p;uniform vec3 color;uniform float gain;void main(){gl_FragColor=vec4(color,pow(max(0.,1.-length(p)),4.)*gain);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
    const mesh=new T.Mesh(geometry,material);mesh.scale.setScalar(2);root.add(mesh);return mesh;
  });
  // One broad source for each pod bank and one for the local vein canopy. Soft
  // weighting avoids a visible jump when a different lantern enters the view.
  function sceneryLight(index:number,sites:readonly GroveSite[],time:number,side=0){
    const target=lights[index].position;target.set(0,0,0);let weight=0;
    for(const site of sites){if(side&&Math.sign(site.u-.5)!==side)continue;
      const p=groveSitePoint(site,time,index===2?1.8:.85),w=Math.exp(-Math.pow(p.y/5.5,4));
      target.x+=p.x*w;target.y+=p.y*w;target.z+=p.z*w;weight+=w;
    }
    if(weight>1e-6)target.multiplyScalar(1/weight);
    lights[index].intensity=(index===2?5:10)*Math.min(1,weight)*(1+.08*Math.sin(time*1.1+index));
  }
  return{root,lights,update(frame:LevelFrame,boss:T.Object3D){
    const {flight:f,time}=frame;sceneryLight(0,grovePods,time,-1);sceneryLight(1,grovePods,time,1);sceneryLight(2,groveLeafLights,time);
    const fighter=frame.victory?.fighter??f.player,drone=frame.victory?.drone??f.drone;
    for(let i=0;i<6;i++){
      const at=Math.floor(groveScroll(time))-.5+i%3,u=i<3?.11+.025*Math.sin(at*4.3):.89+.025*Math.cos(at*4.1);
      const p=groveSitePoint({at,u,size:1},time,-3.1);shared.blocker.value[i].set(p.x,p.y,p.z);
    }
    lights[3].position.set(fighter.x,fighter.y+.2,.85);lights[3].intensity=f.hull>0?2.4:0;
    lights[4].position.set(drone.x,drone.y,.75);lights[4].intensity=f.hull>0?1.8:0;
    lights[5].position.set(fighter.x,fighter.y-.85,-.25);lights[5].intensity=f.hull>0?4.2+.6*Math.sin(time*11):0;
    lights[6].intensity=0;lights[6].color.setHex(0xff8c42);
    if(boss.visible){lights[6].position.copy(boss.position);lights[6].position.z=1.45;lights[6].intensity=f.bossHealth>0?12+6*f.cannonWindup:.6;}
    else{
      let best=Infinity;
      for(const enemy of f.enemies){if(!enemy.grove||enemy.hp<=0||Math.abs(enemy.x)>4||Math.abs(enemy.y)>7)continue;
        const d=enemy.x*enemy.x+enemy.y*enemy.y;if(d>=best)continue;best=d;
        lights[6].position.set(enemy.x,enemy.y-.2,enemy.frog?1.5:.8);lights[6].intensity=enemy.frog?5+7*frogSignal(enemy.frog,enemy.age).warning:3.5+2*Math.max(0,1-(enemy.fire-enemy.age)/.65);lights[6].color.setHex(enemy.frog?0x58ffd0:0xff8c42);
      }
    }
    const source=f.shots.find(s=>Math.abs(s.x)<4&&s.y>-7&&s.y<8);
    lights[7].intensity=source?2.2:0;
    if(source){const k=22/(22-source.z);lights[7].position.set(source.x*k,source.y*k,.5);}
    const seeker=f.enemies.find(e=>e.rayOrb&&e.hp>0);
    if(seeker){lights[7].position.set(seeker.x,seeker.y,.7);lights[7].intensity=4.5;lights[7].color.setHex(0xffaa42);}else lights[7].color.setHex(0x83eeff);
    for(const wing of f.wings)if(wing.weapon==='laser'&&wing.beamEnd){lights[7].position.set(wing.beamEnd.x,wing.beamEnd.y,.65);lights[7].intensity=4;}
    const pulse=f.pulseFlash-(frame.victory?.time??0);
    if(pulse>0){lights[7].position.set(fighter.x,fighter.y,1.2);lights[7].intensity=24*pulse/.3;}
    for(let i=0;i<8;i++){
      const l=lights[i];shared.lightPosition.value[i].copy(l.position);shared.lightColor.value[i].set(l.color.r,l.color.g,l.color.b).multiplyScalar(l.intensity);
      halos[i].position.copy(l.position);halos[i].position.z+=.05;halos[i].material.uniforms.gain.value=Math.min(.18,l.intensity*.008);
    }
  }};
}
