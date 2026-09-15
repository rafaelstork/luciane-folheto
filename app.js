import { mountGallery } from './modules/gallery.js?v=2.0.0';

let mounted = null;
async function initApp({restore=false}={}) {
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
    lock(owner) {
      if(!locks.size){savedOverflow=html.style.overflow;html.style.overflow='hidden';lenis?.stop();}
      locks.add(owner);
    },
    unlock(owner) {
      locks.delete(owner);
      if(!locks.size){html.style.overflow=savedOverflow;lenis?.start();}
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
  const lightControl=document.querySelector('[data-light]');
  const fallbackLight=document.querySelector('[data-material-light]');
  document.querySelector('.light-control').hidden=false;
  const updateLight=()=>fallbackLight?.setAttribute('opacity',String(.2+Number(lightControl.value)/100*.8));
  on(lightControl,'input',updateLight);updateLight();
  const menuButton=document.querySelector('.menu-toggle');
  const menu=document.querySelector('.menu-dialog');
  let menuTween=null, menuClosing=false, menuTimer=0;
  const menuClose=({immediate=false,focus=true}={})=>{
    if(!menu.open)return;
    menuClosing=true;menuTween?.kill();clearTimeout(menuTimer);
    const done=()=>{clearTimeout(menuTimer);menu.close();menu.removeAttribute('style');menuClosing=false;menuButton.setAttribute('aria-expanded','false');scroll.unlock('menu');if(focus)menuButton.focus({preventScroll:true});};
    if(gsap&&!reduced()&&!immediate){menuTween=gsap.to(menu,{x:24,opacity:0,'--backdrop':0,duration:.24,onComplete:done,overwrite:true});menuTimer=setTimeout(done,400);}else done();
  };
  if(typeof menu.showModal==='function'){
    menuButton.hidden=false;html.classList.add('enhanced');
    on(menuButton,'click',()=>{
      if(menu.open&&!menuClosing){menuClose();return;}
      menuTween?.kill();clearTimeout(menuTimer);menuClosing=false;
      if(!menu.open)menu.showModal();scroll.lock('menu');menuButton.setAttribute('aria-expanded','true');
      if(gsap&&!reduced()){
        gsap.set(menu,{opacity:1,x:0,'--backdrop':.65});
        menuTween=gsap.timeline().fromTo(menu,{x:45,opacity:.6,'--backdrop':0},{x:0,opacity:1,'--backdrop':.65,duration:.38,ease:'power2.out'}).fromTo(menu.querySelectorAll('nav a'),{x:18},{x:0,stagger:.045,duration:.3},.08);
        if(DrawSVG)menuTween.fromTo(menu.querySelectorAll('.menu-art .draw'),{drawSVG:'0%'},{drawSVG:'100%',duration:.75,ease:'power2.out'},.1);
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
    cancelAnimationFrame(anchorFrame);anchorFrame=requestAnimationFrame(()=>{let target;try{target=document.querySelector(location.hash||'#inicio');}catch{}if(target)scroll.to(target,true);});
  });

  // Horizontal native film: a real scroll container, with equivalent controls.
  const rail=document.querySelector('.project-rail');
  const cards=[...rail.children];
  const prev=document.querySelector('.rail-prev'),next=document.querySelector('.rail-next');
  document.querySelector('.rail-tools').hidden=false;
  const updateRail=()=>{
    const max=rail.scrollWidth-rail.clientWidth;
    prev.disabled=rail.scrollLeft<3;next.disabled=rail.scrollLeft>=max-3;
    let i=0,best=Infinity;const left=rail.getBoundingClientRect().left+parseFloat(getComputedStyle(rail).paddingLeft);
    cards.forEach((card,j)=>{const d=Math.abs(card.getBoundingClientRect().left-left);if(d<best){best=d;i=j;}});
    document.querySelector('.rail-count').textContent=`${String(i+1).padStart(2,'0')} — ${String(cards.length).padStart(2,'0')}`;
  };
  const moveRail=direction=>rail.scrollBy({left:direction*(cards[0].getBoundingClientRect().width+parseFloat(getComputedStyle(rail).gap)),behavior:reduced()?'instant':'smooth'});
  on(prev,'click',()=>moveRail(-1));on(next,'click',()=>moveRail(1));
  on(rail,'scroll',updateRail,{passive:true});on(window,'resize',updateRail);
  on(rail,'keydown',e=>{if(e.target!==rail)return;if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();if(e.key==='Home'||e.key==='End')rail.scrollTo({left:e.key==='Home'?0:rail.scrollWidth,behavior:reduced()?'instant':'smooth'});else moveRail(e.key==='ArrowRight'?1:-1);}});
  let drag=null,suppressClick=false,clickTimer=0;
  on(rail,'pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:rail.scrollLeft,moved:false};});
  on(rail,'pointermove',e=>{
    if(!drag||e.pointerId!==drag.id)return;
    if(!(e.buttons&1)){finishDrag();return;}
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if(!drag.moved&&Math.abs(dx)>8&&Math.abs(dx)>Math.abs(dy)){
      drag.moved=true;rail.setPointerCapture(e.pointerId);rail.classList.add('dragging');
    }
    if(drag.moved){e.preventDefault();rail.scrollLeft=drag.left-dx;}
  });
  const finishDrag=()=>{if(drag?.moved){suppressClick=true;clearTimeout(clickTimer);clickTimer=setTimeout(()=>{suppressClick=false;},200);if(rail.hasPointerCapture(drag.id))rail.releasePointerCapture(drag.id);}drag=null;rail.classList.remove('dragging');};
  on(rail,'pointerup',finishDrag);on(rail,'pointercancel',finishDrag);on(rail,'lostpointercapture',()=>{drag=null;rail.classList.remove('dragging');});
  on(window,'pointerup',e=>{if(drag?.id===e.pointerId)finishDrag();});
  on(window,'pointercancel',e=>{if(drag?.id===e.pointerId)finishDrag();});
  on(rail,'click',e=>{if(suppressClick){e.preventDefault();e.stopImmediatePropagation();suppressClick=false;}},{capture:true});
  on(rail,'dragstart',e=>e.preventDefault());updateRail();

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
    mediaContext?.revert();motionContext?.revert();mediaContext=null;motionContext=null;
    html.classList.toggle('reduced-motion',reduced());
    settleDetails();
    if(reduced()&&menu.open){menuTween?.kill();if(menuClosing)menuClose({immediate:true});else if(gsap){gsap.set([menu,...menu.querySelectorAll('nav a')],{x:0,opacity:1});if(DrawSVG)gsap.set(menu.querySelectorAll('.menu-art .draw'),{drawSVG:'100%'});}}
    motionButton.setAttribute('aria-pressed',String(reduced()));
    motionButton.textContent=reduced()?'Movimentos reduzidos':'Reduzir movimentos';
    updateScrollEngine();gallery.refreshMotion();
    uiTweens.forEach(t=>t.kill());uiTweens=[];
    document.querySelectorAll('.button .icon,.text-link .icon,.icon-button .icon').forEach(icon=>icon.style.transform='');
    if(reduced()||!gsap||!ScrollTrigger){html.dataset.motion='static';return;}
    html.dataset.motion='gsap';
    motionContext=gsap.context(()=>{
      mediaContext=gsap.matchMedia();
      mediaContext.add({mobile:'(max-width:700px)',desktop:'(min-width:701px)'},context=>{
        const mobile=context.conditions.mobile;
        const hero=document.querySelector('.hero');
        const entry=gsap.timeline({defaults:{ease:'power2.out'}});
        if(DrawSVG)entry.from('.hero-frame .draw',{drawSVG:'0%',duration:1.5},0).from('.hero-joint .draw',{drawSVG:'0%',duration:1.6},.15);
        entry.from('.hero-photo img',{scale:1.035,duration:1.4},0).from('.hero h1 span,.hero h1 em',{y:mobile?8:15,stagger:.09,duration:.7},.1);
        ScrollTrigger.create({trigger:hero,start:'top bottom',end:'bottom top',onToggle:s=>s.isActive?entry.resume():entry.pause()});
        const groups=[['.portfolio','.project-caption'],['.about','.portrait'],['.services','.service-list'],['.contact','.contact-drawing']];
        groups.forEach(([section,target],i)=>{
          const tl=gsap.timeline({scrollTrigger:{trigger:section,start:'top 88%',toggleActions:'play pause resume pause'}});
          tl.from(target,{x:i%2?18:-15,duration:.8,ease:'power2.out'},0);
          const paths=document.querySelector(section).querySelectorAll('.draw');
          if(DrawSVG&&paths.length)tl.from(paths,{drawSVG:'0%',duration:1.1,stagger:.08},0);
          if(section==='.portfolio')tl.from('.project-image',{'--frame-reveal':0,duration:1.1,stagger:.08,ease:'power2.out'},0);
        });
        gsap.from('.material-fallback .plane-a',{x:-12,y:8,ease:'none',scrollTrigger:{trigger:'.material-section',start:'top 90%',end:'bottom 30%',scrub:.6}});
        gsap.from('.material-fallback .plane-b',{x:15,y:-10,ease:'none',scrollTrigger:{trigger:'.material-section',start:'top 90%',end:'bottom 30%',scrub:.6}});
      });
    },document.querySelector('main'));
    if(!html.hasAttribute('data-qa-nogpu')){
      const generation=sceneGeneration;
      const element=document.querySelector('.material-scene');
      const observer=new IntersectionObserver(entries=>{
        if(!entries.some(e=>e.isIntersecting))return;observer.disconnect();
        import('./modules/material-scene.js?v=2.0.0').then(async({mountMaterialScene})=>{
          if(!alive||generation!==sceneGeneration)return;
          const instance=await mountMaterialScene({element,gsap,reduced});
          if(!alive||generation!==sceneGeneration){instance.destroy();return;}
          scene=instance;
          const trigger=ScrollTrigger.create({trigger:'.material-section',start:'top bottom',end:'bottom top',onUpdate:s=>scene?.setProgress(s.progress)});
          const previousDestroy=scene.destroy;scene.destroy=()=>{trigger.kill();previousDestroy();};
        }).catch(()=>{element.dataset.scene='fallback';});
      },{rootMargin:'250px'});
      observer.observe(element);motionContext.add(()=>()=>observer.disconnect());
    }
    html.dataset.triggerCount=String(ScrollTrigger.getAll().length);
    scheduleRefresh();
  }
  on(motionButton,'click',()=>{requestedReduce=!reduced();try{localStorage.setItem('lf-reduced-motion',String(requestedReduce));}catch{}setupMotion();});
  on(media,'change',setupMotion);
  on(window,'resize',scheduleRefresh);
  document.fonts?.ready.then(()=>{if(alive)scheduleRefresh();});
  const controller={destroy(){alive=false;sceneGeneration++;abort.abort();menuTween?.kill();clearTimeout(menuTimer);clearTimeout(refreshTimer);clearTimeout(clickTimer);cancelAnimationFrame(anchorFrame);gallery.destroy();menuClose({immediate:true,focus:false});scene?.destroy();mediaContext?.revert();motionContext?.revert();settleDetails();uiTweens.forEach(t=>t.kill());gsap?.ticker.remove(ticker);lenis?.destroy();locks.clear();html.style.overflow=savedOverflow;html.classList.remove('enhanced');}};
  mounted=controller;
  if(gsap){
    try{Lenis=(await import('./vendor/lenis.mjs')).default;}catch{html.dataset.scrollMode='native';}
  }
  if(!alive)return;
  setupMotion();
  if(location.hash&&!restore){anchorFrame=requestAnimationFrame(()=>{let target;try{target=document.querySelector(location.hash);}catch{}if(target)scroll.to(target,true);});}
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initApp,{once:true});else initApp();
window.addEventListener('pagehide',()=>{mounted?.destroy();mounted=null;});
window.addEventListener('pageshow',event=>{if(event.persisted)initApp({restore:true});});
