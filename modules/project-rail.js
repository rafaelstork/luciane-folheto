/** Drag controls the horizontal film; wheel gestures always scroll the page. */
export function mountProjectRail({gsap,reduced,scroll}) {
  const rail=document.querySelector('.project-rail');
  if(!rail)return {destroy(){}};
  const abort=new AbortController(),on=(node,type,fn,opts={})=>node.addEventListener(type,fn,{...opts,signal:abort.signal});
  const cards=[...rail.children],prev=document.querySelector('.rail-prev'),next=document.querySelector('.rail-next');
  const count=document.querySelector('.rail-count'),progress=document.querySelector('.rail-progress i');
  let tween=null,target=null,drag=null,suppress=false,timer=0,frame=0;
  document.querySelector('.rail-tools').hidden=false;
  const maximum=()=>Math.max(0,rail.scrollWidth-rail.clientWidth);
  const clamp=value=>Math.min(maximum(),Math.max(0,value));
  const stops=()=>{
    const left=rail.getBoundingClientRect().left+parseFloat(getComputedStyle(rail).paddingLeft);
    return [...new Set([0,...cards.map(card=>Math.round(clamp(card.getBoundingClientRect().left-left+rail.scrollLeft))),maximum()])].sort((a,b)=>a-b);
  };
  const update=()=>{
    frame=0;const max=maximum(),x=rail.scrollLeft;
    prev.disabled=x<2;next.disabled=x>=max-2;
    const left=rail.getBoundingClientRect().left+parseFloat(getComputedStyle(rail).paddingLeft);
    let index=0,best=Infinity;
    cards.forEach((card,i)=>{const distance=Math.abs(card.getBoundingClientRect().left-left);if(distance<best){best=distance;index=i;}});
    if(max>0&&x>=max-2)index=cards.length-1;
    const label=`${String(index+1).padStart(2,'0')} — ${String(cards.length).padStart(2,'0')}`;
    if(count.textContent!==label)count.textContent=label;
    const visible=rail.clientWidth/rail.scrollWidth;
    if(progress)progress.style.transform=`scaleX(${visible+(1-visible)*(max?x/max:1)})`;
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
  const stop=()=>{tween?.kill();tween=null;target=null;rail.classList.remove('rail-moving');};
  const go=value=>{
    stop();target=clamp(value);
    if(gsap&&!reduced()){
      rail.classList.add('rail-moving');
      tween=gsap.to(rail,{scrollLeft:target,duration:.65,ease:'power3.out',overwrite:true,onComplete:()=>{stop();update();}});
    }else{rail.scrollTo({left:target,behavior:'instant'});stop();update();}
  };
  const move=direction=>{
    const from=target??rail.scrollLeft,positions=stops();
    go(direction>0?positions.find(x=>x>from+3)??maximum():positions.findLast(x=>x<from-3)??0);
  };
  on(prev,'click',()=>move(-1));on(next,'click',()=>move(1));
  on(rail,'scroll',schedule,{passive:true});
  on(window,'resize',()=>{stop();update();});
  on(rail,'keydown',event=>{
    if(event.target!==rail||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();
    if(event.key==='Home'||event.key==='End')go(event.key==='Home'?0:maximum());
    else move(event.key==='ArrowRight'?1:-1);
  });
  // Keep every wheel gesture vertical, including Shift+wheel and trackpads.
  // Ordinary vertical events bubble directly to the single Lenis controller.
  on(rail,'wheel',event=>{
    stop();
    if(event.ctrlKey)return;
    if(event.shiftKey||Math.abs(event.deltaX)>Math.abs(event.deltaY)){
      const delta=(Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY)*(event.deltaMode===1?16:event.deltaMode===2?innerHeight:1);
      event.preventDefault();event.stopPropagation();scroll.byWheel(delta);
    }
  },{passive:false});
  on(rail,'pointerdown',event=>{
    stop();
    if(event.pointerType!=='mouse'||event.button!==0)return;
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:rail.scrollLeft,lastX:event.clientX,lastTime:event.timeStamp,velocity:0,moved:false};
  });
  const finish=(cancel=false)=>{
    const current=drag;drag=null;
    if(current?.moved){
      suppress=true;clearTimeout(timer);timer=setTimeout(()=>{suppress=false;},350);
      if(rail.hasPointerCapture(current.id))rail.releasePointerCapture(current.id);
      rail.classList.remove('dragging');
      const projected=clamp(rail.scrollLeft+(cancel?0:current.velocity*160));
      go(stops().reduce((best,x)=>Math.abs(x-projected)<Math.abs(best-projected)?x:best));
    }
  };
  on(rail,'pointermove',event=>{
    if(!drag||drag.id!==event.pointerId)return;
    if(!(event.buttons&1)){finish();return;}
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(!drag.moved&&Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){drag=null;return;}
    if(!drag.moved&&Math.abs(dx)>8&&Math.abs(dx)>Math.abs(dy)){
      drag.moved=true;rail.setPointerCapture(event.pointerId);rail.classList.add('dragging');
    }
    if(drag.moved){
      event.preventDefault();rail.scrollLeft=clamp(drag.left-dx);
      const elapsed=event.timeStamp-drag.lastTime;
      if(elapsed>0)drag.velocity=-(event.clientX-drag.lastX)/elapsed;
      drag.lastX=event.clientX;drag.lastTime=event.timeStamp;
    }
  });
  on(window,'pointerup',event=>{if(drag?.id===event.pointerId){if(event.timeStamp-drag.lastTime>90)drag.velocity=0;finish();}});
  on(window,'pointercancel',()=>finish(true));on(rail,'lostpointercapture',()=>finish(true));
  on(rail,'click',event=>{if(suppress){event.preventDefault();event.stopImmediatePropagation();suppress=false;}},{capture:true});
  on(rail,'dragstart',event=>event.preventDefault());update();
  return {destroy(){abort.abort();stop();clearTimeout(timer);cancelAnimationFrame(frame);rail.classList.remove('dragging');}};
}
