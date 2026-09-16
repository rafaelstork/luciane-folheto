// Persistent shell; every replaced page owns its motion resources.
export function mountNavigation({getPage,unmount,mount}){
  const {Swup,SwupJsPlugin,SwupHeadPlugin,SwupA11yPlugin,SwupScrollPlugin,gsap}=window;
  if(!Swup||!SwupJsPlugin||!SwupHeadPlugin||!SwupA11yPlugin||!SwupScrollPlugin||!gsap)return null;
  const overlay=document.querySelector('.page-transition'),planes=[...overlay.querySelectorAll('i')],drawing=overlay.querySelector('svg');
  let active=null,animation=null,finish=null,alive=true;
  const events=new AbortController();
  const fitViewport=()=>gsap.set(overlay,{width:window.innerWidth,height:window.innerHeight});
  fitViewport();window.addEventListener('resize',fitViewport,{signal:events.signal});
  // GSAP owns both translation components. A CSS translateY(100%) must not
  // survive as an extra pixel offset when yPercent is animated back to zero.
  gsap.set(planes,{y:0,yPercent:100});
  const reduced=()=>getPage()?.reduced()||matchMedia('(prefers-reduced-motion: reduce)').matches;
  function stop(){animation?.kill();animation=null;const done=finish;finish=null;done?.();}
  function clear(){stop();gsap.set(overlay,{visibility:'hidden',pointerEvents:'none'});gsap.set(planes,{y:0,yPercent:100});gsap.set(drawing,{opacity:0});overlay.dataset.phase='idle';document.querySelector('main')?.removeAttribute('inert');getPage()?.scroll.unlock('navigation');document.documentElement.dataset.navigation='idle';}
  function transition(done,enter){
    stop();finish=done;
    if(reduced()||!alive){if(enter)getPage()?.enter();const callback=finish;finish=null;callback?.();return;}
    const complete=()=>{animation=null;overlay.dataset.phase=enter?'revealed':'covered';const callback=finish;finish=null;callback?.();};
    fitViewport();gsap.set(overlay,{visibility:'visible',pointerEvents:'auto'});
    overlay.dataset.phase=enter?'revealing':'covering';
    if(enter){
      gsap.set(planes,{y:0,yPercent:0});
      animation=gsap.timeline({onComplete:complete}).to(drawing,{opacity:0,duration:.22},0)
        .to(planes,{y:0,yPercent:-100,stagger:.065,duration:.8,ease:'power3.inOut'},.08)
        .call(()=>getPage()?.enter(),[],.28);
    }else{
      gsap.set(planes,{y:0,yPercent:100});
      animation=gsap.timeline({onComplete:complete}).to(planes,{y:0,yPercent:0,stagger:.065,duration:.68,ease:'power3.inOut'},0)
        .to(drawing,{opacity:.65,duration:.2},.55);
    }
  }
  const swup=new Swup({containers:['#conteudo'],animateHistoryBrowsing:true,
    linkSelector:'a[href]:not([data-gallery]):not([download]):not([target="_blank"])',
    plugins:[
      new SwupJsPlugin({animations:[{from:'(.*)',to:'(.*)',out:done=>transition(done,false),in:done=>transition(done,true)}]}),
      new SwupHeadPlugin({persistAssets:true,awaitAssets:false}),
      new SwupA11yPlugin({announcements:{visit:'Página: {title}',url:'Página: {url}'}}),
      new SwupScrollPlugin({animateScroll:{betweenPages:false,samePageWithHash:true,samePage:true},offset:()=>document.querySelector('.site-header').offsetHeight+18,
        scrollFunction:(el,top,left,animate,start,end)=>{
          start();getPage()?.closeMenu();
          if(el===document.documentElement||el===document.body){const page=getPage();if(page)page.scroll.position(top,left,animate,end);else{window.scrollTo({top,left,behavior:'instant'});end();}}
          else{el.scrollTo({top,left,behavior:'instant'});end();}
        }})
    ]});
  swup.hooks.on('visit:start',visit=>{active=visit;getPage()?.closeOverlays();getPage()?.scroll.lock('navigation');document.querySelector('main')?.setAttribute('inert','');document.documentElement.dataset.navigation='leaving';if(reduced())visit.animation.animate=false;visit.a11y.focus={selector:visit.to.hash||'#conteudo',wait:true};});
  swup.hooks.before('content:replace',visit=>{
    if(visit.animation.animate&&!reduced()){gsap.set(planes,{y:0,yPercent:0});overlay.dataset.phase='covered';}
    unmount();
  });
  swup.hooks.on('content:replace',async()=>{await mount();getPage()?.scroll.lock('navigation');document.documentElement.dataset.navigation='entering';});
  swup.hooks.on('visit:end',visit=>{if(active!==visit)return;getPage()?.enter();clear();active=null;});
  swup.hooks.on('visit:abort',visit=>{if(active===visit){clear();active=null;}});
  // Core performs normal HTTP navigation after a failed active visit.
  swup.hooks.on('visit:fail',visit=>{if(active===visit){clear();active=null;}});
  document.documentElement.dataset.navigation='idle';
  return {destroy(){alive=false;events.abort();clear();swup.destroy();}};
}
