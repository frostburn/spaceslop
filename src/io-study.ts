import { Flight, STEP } from './game';
import { FlightView } from './view';
import { IO_DURATION,IO_APPROACH } from './io-layout';

if(import.meta.env.DEV){
  const canvas=document.querySelector<HTMLCanvasElement>('#preview')!,slider=document.querySelector<HTMLInputElement>('#time')!,play=document.querySelector<HTMLButtonElement>('#play')!,broken=document.querySelector<HTMLInputElement>('#broken')!,label=document.querySelector<HTMLOutputElement>('#phase')!;
  const view=new FlightView(canvas);let playing=false,last=0;
  function preview(){
    const f=new Flight('sentry',[],'vex','io'),t=slider.valueAsNumber;
    if(t<IO_DURATION){f.phase='stage';f.time=t;}else{f.phase=t<IO_DURATION+IO_APPROACH?'approach':'boss';f.time=t<IO_DURATION+IO_APPROACH?t-IO_DURATION:0;}
    if(broken.checked){
      f.phase='boss';f.time=0;f.charges=4;for(let i=0;i<4;i++)f.pulse();
      for(let i=0;i<73;i++)f.step(STEP);f.shots=[];f.threats=[];f.markers=[];
    }
    view.resize(canvas.clientWidth,canvas.clientHeight);view.render(f,0);
    label.value=broken.checked?'Failed support · exposed machinery':`${t.toFixed(2)} s · ${f.phase==='stage'?'patrol':f.phase==='approach'?'camera approach':'boss framing'}`;
  }
  function animate(now:number){if(playing){slider.value=String(Math.min(28,slider.valueAsNumber+Math.min(.05,(now-last)/1000)));preview();if(slider.valueAsNumber>=28){playing=false;play.textContent='Play';}}last=now;requestAnimationFrame(animate);}
  slider.addEventListener('input',()=>{playing=false;play.textContent='Play';broken.checked=false;preview();});
  broken.addEventListener('change',()=>{playing=false;play.textContent='Play';slider.value='28';preview();});
  play.addEventListener('click',()=>{if(slider.valueAsNumber>=28)slider.value='0';broken.checked=false;playing=!playing;play.textContent=playing?'Pause':'Play';});
  preview();void view.warmup(new AbortController().signal,preview).then(()=>{play.disabled=false;preview();});
  new ResizeObserver(preview).observe(canvas);requestAnimationFrame(animate);
}else document.body.textContent='The camera study is available only in Vite dev mode.';
