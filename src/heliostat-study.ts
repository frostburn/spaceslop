import { createHeliostatView,type StudyOptions } from './studies/heliostat-view';
import { loadStudyArt } from './studies/heliostat-assets';
import { studyFrame,studyTimeAtSwing,routeSection,STUDY_DURATION,ROUTE_DURATION } from './heliostat/layout';

if(import.meta.env.DEV){
  const canvas=document.querySelector<HTMLCanvasElement>('#preview')!,slider=document.querySelector<HTMLInputElement>('#swing')!;
  const timeline=document.querySelector<HTMLInputElement>('#time')!,section=document.querySelector<HTMLSelectElement>('#section')!;
  const play=document.querySelector<HTMLButtonElement>('#play')!,clock=document.querySelector<HTMLOutputElement>('#clock')!;
  const angle=document.querySelector<HTMLOutputElement>('#angle')!,assets=document.querySelector<HTMLParagraphElement>('#assets')!;
  const error=document.querySelector<HTMLParagraphElement>('#error')!,inspection=document.querySelector<HTMLButtonElement>('#inspect-backdrop')!;
  const lifetime=new AbortController(),{signal}=lifetime;
  let raf=0,time=0,progress=0,playing=false,last=0,backdropInspection=false;
  let observer:ResizeObserver|undefined,view:ReturnType<typeof createHeliostatView>|undefined;
  let preparation:Promise<void>=Promise.resolve();
  const options:StudyOptions={artwork:true,sky:true,distant:true,corridor:true,wireframe:false,orbit:false};
  const stop=()=>{playing=false;play.textContent='Play study';play.setAttribute('aria-pressed','false');};
  const leaveOrbit=()=>{
    options.orbit=false;document.querySelector<HTMLInputElement>('#orbit')!.checked=false;view?.setOptions(options);
  };
  const mainView=()=>{backdropInspection=false;view?.inspectBackdrop(false);leaveOrbit();};
  function draw(){
    view?.draw(time,progress);slider.value=String(progress);timeline.value=String(time);
    angle.value=backdropInspection?'Full image':`${Math.round(progress*100)}%`;
    clock.value=`${time.toFixed(1)} s · ${backdropInspection?'Backdrop inspection':routeSection(time)}`;
    section.value=String(time<20?0:time<45?20:time<70?45:time<100?70:time<STUDY_DURATION?100:108);
    document.querySelector('#stage-label')!.textContent=backdropInspection?'Heliostat / Full backdrop':`Heliostat / ${routeSection(time)}`;
    document.querySelectorAll<HTMLButtonElement>('[data-pose]').forEach(button=>{
      button.setAttribute('aria-pressed',String(!backdropInspection&&Math.abs(Number(button.dataset.pose)-progress)<.005));
    });
    inspection.setAttribute('aria-pressed',String(backdropInspection));
    document.querySelector<HTMLInputElement>('#orbit')!.disabled=backdropInspection;
  }
  function goTime(value:number){const frame=studyFrame(value);time=frame.time;progress=frame.progress;draw();}
  function cleanup(){
    if(signal.aborted)return;lifetime.abort();cancelAnimationFrame(raf);observer?.disconnect();
    void preparation.finally(()=>view?.dispose());
  }
  window.addEventListener('pagehide',cleanup,{signal});
  const restore=(event:PageTransitionEvent)=>{if(event.persisted)location.reload();};
  window.addEventListener('pageshow',restore);
  import.meta.hot?.dispose(()=>{cleanup();window.removeEventListener('pageshow',restore);});
  try{
    view=createHeliostatView(canvas);
    timeline.addEventListener('input',()=>{stop();mainView();goTime(timeline.valueAsNumber);},{signal});
    section.addEventListener('change',()=>{stop();mainView();goTime(Number(section.value));},{signal});
    slider.addEventListener('input',()=>{stop();mainView();goTime(studyTimeAtSwing(slider.valueAsNumber));},{signal});
    document.querySelectorAll<HTMLButtonElement>('[data-pose]').forEach(button=>{
      button.addEventListener('click',()=>{stop();mainView();const p=Number(button.dataset.pose);goTime(p===0?0:studyTimeAtSwing(p));},{signal});
    });
    inspection.addEventListener('click',()=>{stop();leaveOrbit();backdropInspection=true;view?.inspectBackdrop(true);draw();},{signal});
    for(const id of Object.keys(options)as(keyof StudyOptions)[]){
      document.querySelector<HTMLInputElement>('#'+id)!.addEventListener('change',event=>{
        options[id]=(event.target as HTMLInputElement).checked;if(id==='orbit')stop();view?.setOptions(options);draw();
      },{signal});
    }
    play.addEventListener('click',()=>{
      mainView();if(playing)stop();else{
        if(time>=STUDY_DURATION)goTime(0);playing=true;play.textContent='Pause';play.setAttribute('aria-pressed','true');
      }
    },{signal});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();},{signal});
    canvas.addEventListener('webglcontextlost',event=>{
      event.preventDefault();stop();error.hidden=false;error.textContent='Graphics context lost. Reload the study to recreate its scene.';
    },{signal});
    observer=new ResizeObserver(draw);observer.observe(canvas);draw();
    function animate(now:number){
      if(signal.aborted)return;
      if(playing){
        goTime(Math.min(STUDY_DURATION,time+Math.min(.05,(now-last)/1000)));if(time>=STUDY_DURATION)stop();
      }
      last=now;raf=requestAnimationFrame(animate);
    }
    raf=requestAnimationFrame(animate);
    preparation=loadStudyArt(signal).then(async art=>{
      if(signal.aborted)return;view!.setArt(art);draw();await view!.warmup();if(signal.aborted)return;
      play.disabled=false;assets.textContent=`${Object.keys(art).length}/3 artwork files loaded · missing files use procedural fallbacks.`;
    }).catch(reason=>{
      if(signal.aborted)return;error.hidden=false;error.textContent='Graphics preparation failed. Reload the study to try again.';console.error(reason);
    });
    timeline.max=String(STUDY_DURATION);timeline.dataset.routeEnd=String(ROUTE_DURATION);
  }catch(reason){cleanup();error.hidden=false;error.textContent='Unable to start the WebGL study. Reload to try again.';console.error(reason);}
}else document.body.textContent='The Uranus station study is available only in Vite dev mode.';
