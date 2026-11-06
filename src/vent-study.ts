import {Flight} from './game';
import {FlightView} from './view';
import {VENT_DURATION,VENT_APPROACH,ventSection} from './vent-layout';
if(import.meta.env.DEV){
 const canvas=document.querySelector<HTMLCanvasElement>('#preview')!,slider=document.querySelector<HTMLInputElement>('#time')!,play=document.querySelector<HTMLButtonElement>('#play')!,label=document.querySelector<HTMLOutputElement>('#phase')!;
 const view=new FlightView(canvas),bossStart=VENT_DURATION+VENT_APPROACH,end=bossStart+24;let playing=false,last=0;
 function preview(){
  const t=slider.valueAsNumber,f=new Flight('sentry',[],'vex','vents');
  f.phase=t<VENT_DURATION?'stage':t<bossStart?'approach':'boss';f.time=t<VENT_DURATION?t:t<bossStart?t-VENT_DURATION:t-bossStart;
  view.resize(canvas.clientWidth,canvas.clientHeight);view.render(f,0);
  label.value=`${t.toFixed(2)} s · ${f.phase==='stage'?ventSection(t):f.phase==='approach'?'cliff swing / rim climb':'crab boss framing / circular-wall scurry'}`;
 }
 slider.addEventListener('input',()=>{playing=false;play.textContent='Play';preview();});
 document.querySelector<HTMLSelectElement>('#section')!.addEventListener('change',event=>{slider.value=(event.target as HTMLSelectElement).value;slider.dispatchEvent(new Event('input'));});
 play.addEventListener('click',()=>{if(slider.valueAsNumber>=end)slider.value='100';playing=!playing;play.textContent=playing?'Pause':'Play';});
 function tick(now:number){if(playing){slider.value=String(Math.min(end,slider.valueAsNumber+Math.min(.05,(now-last)/1000)));preview();if(slider.valueAsNumber>=end){playing=false;play.textContent='Play';}}last=now;requestAnimationFrame(tick);}
 preview();void view.warmup(new AbortController().signal,preview).then(()=>{play.disabled=false;preview();});new ResizeObserver(preview).observe(canvas);requestAnimationFrame(tick);
}else document.body.textContent='The abyss study is available only in Vite dev mode.';
