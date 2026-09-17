import { mountProjectRail } from './modules/project-rail.js?v=2.1.1';
import { mountGallery } from './modules/gallery.js?v=2.1.1';

import { mountComposition } from './modules/composition.js?v=2.1.1';
import { mountPortalScene } from './modules/portal-scene.js?v=2.1.1';
import { mountNavigation } from './modules/navigation.js?v=2.1.1';
let mounted = null, navigation = null;
async function initApp({restore=false,fromVisit=false}={}) {
  mounted?.destroy();
  const abort = new AbortController();
  const signal = abort.signal;
  const on = (node, type, handler, options = {}) => node?.addEventListener(type, handler, {...options, signal});
  const html = document.documentElement;
  const gsap = window.gsap || null;
  const ScrollTrigger = window.ScrollTrigger || null;
  const DrawSVG = window.DrawSVGPlugin || null;
  if(gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
  if(gsap && DrawSVG) gsap.registerPlugin(DrawSVG);
  let alive = true;
  let requestedReduce = false;
  try {requestedReduce = localStorage.getItem('lf-reduced-motion') === 'true';} catch {}
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => requestedReduce || media.matches || html.hasAttribute('data-qa-reduce');
  let lenis = null, Lenis = null, motionContext = null, mediaContext = null, scene = null;
  let sceneGeneration = 0, refreshTimer = 0, anchorFrame = 0;
  const locks = new Set();
  let savedOverflow = '';
  const scroll = {
    byWheel(delta) {
      if(locks.size)return;
      if(lenis)lenis.scrollTo(lenis.targetScroll+delta,{programmatic:false});
      else window.scrollBy({top:delta,behavior:'instant'});
    },
    lock(owner) {
      if(!locks.size){savedOverflow=html.style.overflow;html.style.overflow='hidden';lenis?.stop();}
      locks.add(owner);
    },
    unlock(owner) {
      locks.delete(owner);
      if(!locks.size){html.style.overflow=savedOverflow;lenis?.start();}
    },
    position(top,left=0,animate=false,end=()=>{}) {
      if(lenis){lenis.resize();lenis.scrollTo(top,{immediate:!animate||reduced(),force:true,onComplete:end});}
      else {window.scrollTo({top,left,behavior:'instant'});end();}
    },
    to(target, immediate=false) {
      const headerHeight=document.querySelector('.site-header').offsetHeight;
      if(lenis) lenis.scrollTo(target,{offset:-headerHeight-18,immediate:immediate||reduced(),duration:1.05});
      else window.scrollTo({top:Math.max(0,target.getBoundingClientRect().top+scrollY-headerHeight-18),behavior:'instant'});
    }
  };
  const ticker=time=>lenis?.raf(time*1000);
  function updateScrollEngine() {
    lenis?.destroy();lenis=null;
    gsap?.ticker.remove(ticker);
    if(Lenis && gsap && !reduced()){
      lenis=new Lenis({autoRaf:false,lerp:.1,smoothWheel:true,syncTouch:false,anchors:false});
      if(ScrollTrigger)lenis.on('scroll',ScrollTrigger.update);
      gsap.ticker.add(ticker);gsap.ticker.lagSmoothing(0);
      if(locks.size)lenis.stop();
    }
    html.dataset.scrollMode=lenis?'lenis':'native';
  }
  const scheduleRefresh=()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{if(alive){lenis?.resize();ScrollTrigger?.refresh();}},130);};
  const motionButton=document.querySelector('.motion-toggle');
  motionButton.hidden=false;
  const menuButton=document.querySelector('.menu-toggle');
  const menu=document.querySelector('.menu-dialog');
  let menuTween=null, menuClosing=false, menuTimer=0;
  const menuClose=({immediate=false,focus=true}={})=>{
    if(!menu.open)return;
    if(menuClosing&&!immediate)return;
    menuClosing=true;clearTimeout(menuTimer);
    const done=()=>{clearTimeout(menuTimer);menuTween?.kill();menuTween=null;menu.close();menu.removeAttribute('style');menu.querySelectorAll('nav a,.menu-art .draw').forEach(node=>node.removeAttribute('style'));menuClosing=false;menuButton.setAttribute('aria-expanded','false');scroll.unlock('menu');if(focus)menuButton.focus({preventScroll:true});};
    if(menuTween&&gsap&&!reduced()&&!immediate){menuTween.eventCallback('onReverseComplete',done).timeScale(1.5).reverse();menuTimer=setTimeout(done,800);}else done();
  };
  if(typeof menu.showModal==='function'){
    menuButton.hidden=false;html.classList.add('enhanced');
    on(menuButton,'click',()=>{
      if(menu.open&&!menuClosing){menuClose();return;}
      clearTimeout(menuTimer);menuClosing=false;
      if(!menu.open)menu.showModal();scroll.lock('menu');menuButton.setAttribute('aria-expanded','true');
      if(gsap&&!reduced()){
        if(menuTween){menuTween.eventCallback('onReverseComplete',null).timeScale(1).play();}
        else{
          gsap.set(menu,{opacity:1,x:0});
          menuTween=gsap.timeline({defaults:{ease:'power3.inOut'}})
            .fromTo(menu,{clipPath:'inset(0 0 100% 0 round 0 0 64px 64px)','--backdrop':0},{clipPath:'inset(0 0 0% 0 round 0 0 0px 0px)','--backdrop':.65,duration:.56},0)
            .fromTo(menu.querySelectorAll('nav a'),{y:32,opacity:0},{y:0,opacity:1,stagger:.065,duration:.48,ease:'power3.out'},.18);
          if(DrawSVG)menuTween.fromTo(menu.querySelectorAll('.menu-art .draw'),{drawSVG:'0%'},{drawSVG:'100%',duration:.7,ease:'power2.inOut'},.25);
        }
      }else{menu.style.opacity='1';menu.style.transform='none';menu.style.setProperty('--backdrop','.65');}
      menu.querySelector('.menu-close').focus({preventScroll:true});
    });
    on(menu.querySelector('.menu-close'),'click',()=>menuClose());
    on(menu,'cancel',e=>{e.preventDefault();menuClose();});
    let startOutside=false;
    on(menu,'pointerdown',e=>{startOutside=e.target===menu&&e.offsetX<0;});
    on(menu,'pointerup',e=>{if(startOutside&&e.target===menu)menuClose();startOutside=false;});
    on(window,'resize',()=>{if(innerWidth>700&&menu.open)menuClose({immediate:true,focus:false});});
  }
  const gallery=mountGallery({gsap,reduced,scroll,root:document});
  on(document,'click',e=>{
    if(navigation)return;
    const a=e.target.closest('a[href^="#"]');
    if(!a||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
    const href=a.getAttribute('href');let target;
    try{target=document.querySelector(href);}catch{return;}
    if(!target)return;e.preventDefault();
    if(menu.open)menuClose({immediate:true,focus:false});
    if(location.hash!==href)history.pushState(null,'',href);
    target.setAttribute('tabindex','-1');target.focus({preventScroll:true});scroll.to(target);
  });
  on(window,'popstate',()=>{
    if(navigation)return;
    cancelAnimationFrame(anchorFrame);anchorFrame=requestAnimationFrame(()=>{let target;try{target=document.querySelector(location.hash||'#inicio');}catch{}if(target)scroll.to(target,true);});
  });

  const projectRail=mountProjectRail({gsap,reduced,scroll});

  const detailsTweens=new Map();
  function settleDetails() {
    detailsTweens.forEach((tween,details)=>{
      tween.kill();
      details.open=details.querySelector('summary').getAttribute('aria-expanded')==='true';
      details.querySelector('.service-content').style.height='';
    });
    detailsTweens.clear();
  }
  document.querySelectorAll('.service-list details').forEach(details=>{
    const summary=details.querySelector('summary'),content=details.querySelector('.service-content');
    summary.setAttribute('aria-expanded',String(details.open));
    let intended=details.open;
    on(summary,'click',e=>{
      if(!gsap||reduced())return;
      e.preventDefault();intended=!intended;detailsTweens.get(details)?.kill();
      summary.setAttribute('aria-expanded',String(intended));
      if(intended){const from=details.open?content.getBoundingClientRect().height:0;details.open=true;content.style.height='auto';const height=content.scrollHeight;detailsTweens.set(details,gsap.fromTo(content,{height:from},{height,duration:.34,ease:'power2.inOut',onComplete:()=>{content.style.height='';scheduleRefresh();}}));}
      else detailsTweens.set(details,gsap.to(content,{height:0,duration:.28,ease:'power2.inOut',onComplete:()=>{details.open=false;content.style.height='';scheduleRefresh();}}));
    });
    on(details,'toggle',()=>{if(!detailsTweens.get(details)?.isActive()){intended=details.open;summary.setAttribute('aria-expanded',String(details.open));}scheduleRefresh();});
  });
  let uiTweens=[];
  document.querySelectorAll('.button,.text-link,.icon-button').forEach(control=>{
    const icon=control.querySelector('.icon');if(!icon)return;
    const animate=x=>{if(gsap&&!reduced()){gsap.killTweensOf(icon);const tween=gsap.to(icon,{x,duration:.18,overwrite:true});uiTweens.push(tween);if(uiTweens.length>40)uiTweens=uiTweens.filter(t=>t.isActive());}};
    on(control,'pointerenter',()=>animate(3));on(control,'pointerleave',()=>animate(0));on(control,'focus',()=>animate(3));on(control,'blur',()=>animate(0));on(control,'pointerdown',()=>animate(1));on(control,'pointerup',()=>animate(0));
  });

  function setupMotion() {
    sceneGeneration++;scene?.destroy();scene=null;
    mediaContext?.revert();motionContext?.destroy();mediaContext=null;motionContext=null;
    html.classList.toggle('reduced-motion',reduced());
    settleDetails();
    if(reduced()&&menu.open){menuTween?.kill();menuTween=null;if(menuClosing)menuClose({immediate:true});else if(gsap){gsap.set(menu,{clipPath:'none','--backdrop':.65});gsap.set([menu,...menu.querySelectorAll('nav a')],{x:0,y:0,opacity:1});if(DrawSVG)gsap.set(menu.querySelectorAll('.menu-art .draw'),{drawSVG:'100%'});}}
    motionButton.setAttribute('aria-pressed',String(reduced()));
    motionButton.textContent=reduced()?'Movimentos reduzidos':'Reduzir movimentos';
    updateScrollEngine();gallery.refreshMotion();
    uiTweens.forEach(t=>t.kill());uiTweens=[];
    document.querySelectorAll('.button .icon,.text-link .icon,.icon-button .icon').forEach(icon=>icon.style.transform='');
    scene=mountPortalScene({element:document.querySelector('.material-scene'),gsap,reduced});
    if(reduced()||!gsap||!ScrollTrigger){html.dataset.motion='static';return;}
    html.dataset.motion='gsap';
    motionContext=mountComposition({gsap,ScrollTrigger,DrawSVG,fromVisit});
    html.dataset.triggerCount=String(ScrollTrigger.getAll().length);
    scheduleRefresh();
  }
  on(motionButton,'click',()=>{requestedReduce=!reduced();try{localStorage.setItem('lf-reduced-motion',String(requestedReduce));}catch{}setupMotion();});
  on(media,'change',setupMotion);
  on(window,'resize',scheduleRefresh);
  document.fonts?.ready.then(()=>{if(alive)scheduleRefresh();});
  const controller={scroll,reduced,enter(){fromVisit=false;motionContext?.enter();},closeMenu(){menuClose({immediate:true,focus:false});},closeOverlays(){menuClose({immediate:true,focus:false});gallery.destroy();},destroy(){alive=false;sceneGeneration++;abort.abort();menuTween?.kill();clearTimeout(menuTimer);clearTimeout(refreshTimer);projectRail.destroy();cancelAnimationFrame(anchorFrame);gallery.destroy();menuClose({immediate:true,focus:false});scene?.destroy();mediaContext?.revert();motionContext?.destroy();settleDetails();uiTweens.forEach(t=>t.kill());gsap?.ticker.remove(ticker);lenis?.destroy();locks.clear();html.style.overflow=savedOverflow;html.classList.remove('enhanced');}};
  mounted=controller;
  if(gsap){
    try{Lenis=(await import('./vendor/lenis.mjs')).default;}catch{html.dataset.scrollMode='native';}
  }
  if(!alive)return;
  setupMotion();
  if(location.hash&&!restore){anchorFrame=requestAnimationFrame(()=>{let target;try{target=document.querySelector(location.hash);}catch{}if(target)scroll.to(target,true);});}
}

async function boot({restore=false}={}){
  await initApp({restore});
  if(!navigation)navigation=mountNavigation({getPage:()=>mounted,unmount:()=>{mounted?.destroy();mounted=null;},mount:()=>initApp({restore:true,fromVisit:true})});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>boot(),{once:true});else boot();
window.addEventListener('pagehide',()=>{navigation?.destroy();navigation=null;mounted?.destroy();mounted=null;});
window.addEventListener('pageshow',event=>{if(event.persisted)boot({restore:true});});
