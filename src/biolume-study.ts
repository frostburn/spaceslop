import {createBiolumeView} from './biolume/view';
import {defaultOptions,type StudyOptions} from './biolume/layout';
import {loadStudyTexture} from './studies/heliostat-assets';
import type {StudyTexture} from './assets/catalog';
declare const __STUDY_TEXTURES__:Partial<Record<StudyTexture,string>>;

if(import.meta.env.DEV){
  const canvas=document.querySelector<HTMLCanvasElement>('#preview')!,play=document.querySelector<HTMLButtonElement>('#play')!,timeline=document.querySelector<HTMLInputElement>('#time')!;
  const clock=document.querySelector<HTMLOutputElement>('#clock')!,status=document.querySelector<HTMLElement>('#asset-status')!,stats=document.querySelector<HTMLElement>('#stats')!,error=document.querySelector<HTMLElement>('#error')!;
  canvas.tabIndex=0;
  const lifetime=new AbortController(),{signal}=lifetime;
  let view:ReturnType<typeof createBiolumeView>|undefined,raf=0,time=0,last=0,playing=true,dragging=false,ready=false,observer:ResizeObserver|undefined,preparation:Promise<void>=Promise.resolve();
  const keys=new Set<string>();
  function pause(){playing=false;play.textContent='Play';play.setAttribute('aria-pressed','false');}
  function draw(){view?.draw(time);timeline.value=String(time);clock.value=`${time.toFixed(2)} s`;const s=view?.stats();if(s)stats.textContent=`${s.lights} local lights · ${s.ambient} ambient · ${s.draws} draws · ${s.triangles.toLocaleString()} triangles`;}
  function cleanup(){if(signal.aborted)return;lifetime.abort();cancelAnimationFrame(raf);observer?.disconnect();void preparation.finally(()=>view?.dispose());}
  window.addEventListener('pagehide',cleanup,{signal});
  const restore=(e:PageTransitionEvent)=>{if(e.persisted)location.reload();};window.addEventListener('pageshow',restore);
  import.meta.hot?.dispose(()=>{cleanup();window.removeEventListener('pageshow',restore);});
  function failure(reason:unknown){if(signal.aborted)return;pause();error.hidden=false;error.textContent='Unable to prepare the lighting study. Reload to try again.';console.error(reason);}
  try{
    view=createBiolumeView(canvas);
    const options={...defaultOptions};
    for(const key of Object.keys(options)as(keyof StudyOptions)[]){document.querySelector<HTMLInputElement>('#'+key)!.addEventListener('change',e=>{options[key]=(e.target as HTMLInputElement).checked;view?.setOptions(options);draw();},{signal});}
    document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach(button=>button.addEventListener('click',()=>{
      const preset=button.dataset.preset;options.environment=preset==='both'||preset==='environment';options.actors=preset==='both'||preset==='actors';options.emission=preset!=='blackout';
      for(const key of['environment','actors','emission']as const)document.querySelector<HTMLInputElement>('#'+key)!.checked=options[key];view?.setOptions(options);draw();
    },{signal}));
    play.addEventListener('click',()=>{if(playing)pause();else{playing=true;play.textContent='Pause';play.setAttribute('aria-pressed','true');}},{signal});
    document.querySelector('#follow')!.addEventListener('click',()=>{view?.follow();draw();},{signal});
    timeline.addEventListener('input',()=>{pause();time=timeline.valueAsNumber;draw();},{signal});
    canvas.addEventListener('pointerdown',e=>{dragging=true;canvas.setPointerCapture(e.pointerId);canvas.focus();view?.pointer(e.clientX,e.clientY);draw();},{signal});
    canvas.addEventListener('pointermove',e=>{if(dragging){view?.pointer(e.clientX,e.clientY);draw();}},{signal});
    for(const name of['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>dragging=false,{signal});
    canvas.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','w','a','s','d'].includes(e.key)){
      e.preventDefault();keys.add(e.key);
      if(!playing){const p=view!.actors.player.position;view!.movePlayer(p.x+(['ArrowRight','d'].includes(e.key)?.2:['ArrowLeft','a'].includes(e.key)?-.2:0),p.y+(['ArrowUp','w'].includes(e.key)?.2:['ArrowDown','s'].includes(e.key)?-.2:0));draw();}
    }},{signal});
    canvas.addEventListener('keyup',e=>keys.delete(e.key),{signal});canvas.addEventListener('blur',()=>keys.clear(),{signal});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();keys.clear();}},{signal});
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();pause();error.hidden=false;error.textContent='Graphics context lost. Reload to recreate the study.';},{signal});
    observer=new ResizeObserver(draw);observer.observe(canvas);
    preparation=(async()=>{
      const entries=await Promise.all((['backdrop','foreground']as const).map(async key=>{
        const path=__STUDY_TEXTURES__[key==='backdrop'?'biolumeBackdrop':'biolumeForeground'];
        return [key,path?await loadStudyTexture(import.meta.env.BASE_URL+path,signal):undefined]as const;
      }));
      if(signal.aborted){for(const[,t]of entries)t?.dispose();return;}
      const plates=Object.fromEntries(entries.filter(([,t])=>t));view!.setArt(plates);
      status.textContent=`${Object.keys(plates).length}/2 full-screen plates loaded · missing plates use source-drawn fallbacks.`;
      // Compile fixed light-count and alpha-cutout materials before animation.
      view!.draw(0);
      if(view!.renderer.extensions.has('KHR_parallel_shader_compile'))await view!.renderer.compileAsync(view!.scene,view!.camera);
      else view!.renderer.compile(view!.scene,view!.camera);
      if(signal.aborted)return;
      ready=true;play.disabled=false;draw();
    })().catch(failure);
    function animate(now:number){
      if(signal.aborted)return;
      const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
      if(ready&&playing){time=(time+dt)%24;
        if(keys.size){const p=view!.actors.player.position;view!.movePlayer(p.x+dt*3*((keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0)),p.y+dt*3*((keys.has('ArrowUp')||keys.has('w')?1:0)-(keys.has('ArrowDown')||keys.has('s')?1:0)));}
        draw();
      }raf=requestAnimationFrame(animate);
    }raf=requestAnimationFrame(animate);
  }catch(reason){failure(reason);cleanup();}
}else document.body.textContent='The bioluminescence study is available only in Vite dev mode.';
