// Conceptual relief derived from repeated curved openings, not a model of a built work.
export function mountPortalScene({element,gsap,reduced}){
  if(!element)return {destroy(){}};
  let alive=true,ready=false,visible=false,loading=false,dirty=true,renderer,context,resizeObserver,frameCount=0;
  const events=new AbortController(),geometries=new Set(),materials=new Set();
  const state={progress:0,entrance:0,pointerX:0,pointerY:0};
  let intro,scene,camera,portals,uniforms,drawFrame,glFailed=false;
  const on=(node,name,fn)=>node.addEventListener(name,fn,{signal:events.signal,passive:true});
  function release(){
    ready=false;context?.revert();resizeObserver?.disconnect();gsap?.ticker.remove(drawFrame);
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());geometries.clear();materials.clear();
    if(renderer){const old=renderer;renderer=null;const lost=old.getContext().isContextLost();old.dispose();if(!lost)old.forceContextLoss();old.domElement.remove();}
    element.dataset.scene='fallback';
  }
  const requestRender=()=>{dirty=true;};
  async function load(){
    if(loading||!gsap||reduced()||document.documentElement.hasAttribute('data-qa-nogpu')||navigator.connection?.saveData)return;
    loading=true;element.dataset.scene='loading';
    try{
      const T=await import('../vendor/three/three.module.min.js');if(!alive)return;
      renderer=new T.WebGLRenderer({antialias:true,powerPreference:'low-power'});
      renderer.outputColorSpace=T.SRGBColorSpace;renderer.setClearColor('#d9c2aa');renderer.debug.onShaderError=()=>{glFailed=true;};
      scene=new T.Scene();camera=new T.OrthographicCamera(-4.8,4.8,4,-4,.1,40);
      camera.position.set(6.3,3.3,9.2);camera.lookAt(0,.1,-.35);
      uniforms={uProgress:{value:0},uEntrance:{value:0},uPointer:{value:new T.Vector2()},uStone:{value:new T.Color('#ddc5ad')},uShade:{value:new T.Color('#9e7658')},uLight:{value:new T.Color('#fff2da')}};
      const vertex=`varying vec2 surface;void main(){surface=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
      const fragment=`varying vec2 surface;uniform float uProgress,uEntrance;uniform vec2 uPointer;uniform vec3 uStone,uShade,uLight;
      float grain(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){vec2 p=surface;float angle=mix(.3,1.15,uProgress);float d=p.x+p.y*angle-uProgress*2.8-uPointer.x*.3;
      float light=smoothstep(-3.5,-1.9,d)*(1.-smoothstep(1.2,2.5,d));
      float bands=smoothstep(-.25,.6,sin(d*6.2))*smoothstep(-3.,-1.7,d)*(1.-smoothstep(1.5,3.,d));
      float sweep=exp(-pow((d+3.-uEntrance*7.)*1.4,2.))*sin(uEntrance*3.14159265);
      vec3 col=mix(uStone*.88,uStone,smoothstep(-2.5,2.5,p.y));col=mix(col,uLight,light*.48+sweep*.32);col=mix(col,uShade,bands*.32);
      col+=(grain(p*170.)-.5)*.016;gl_FragColor=vec4(col,1.);#include <colorspace_fragment>
      }`.replace(';#include',';\n#include');
      const plaster=new T.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:fragment,toneMapped:false});materials.add(plaster);
      const standard=color=>{const m=new T.MeshStandardMaterial({color,roughness:.88,metalness:.02});materials.add(m);return m;};
      const edge=standard('#b58b6b'),stone=standard('#cfad8e'),back=standard('#ad886b'),bronze=standard('#967453');
      function mesh(g,m,parent=scene){geometries.add(g);const item=new T.Mesh(g,m);parent.add(item);return item;}
      const floor=mesh(new T.BoxGeometry(8,.13,8),stone);floor.position.set(0,-2.43,-.15);
      const ground=mesh(new T.PlaneGeometry(24,24),plaster);ground.rotation.x=-Math.PI/2;ground.position.y=-2.51;
      const rear=mesh(new T.PlaneGeometry(16,12),back);rear.position.set(0,1,-4.5);
      const shape=new T.Shape();shape.moveTo(-2.35,-2.38);shape.lineTo(2.35,-2.38);shape.lineTo(2.35,2.5);shape.lineTo(-1.6,2.5);shape.quadraticCurveTo(-2.35,2.5,-2.35,1.75);shape.closePath();
      const hole=new T.Path();hole.moveTo(-1.12,-2.32);hole.lineTo(-1.12,.7);hole.bezierCurveTo(-1.12,2.2,1.12,2.2,1.12,.7);hole.lineTo(1.12,-2.32);hole.closePath();shape.holes.push(hole);
      const portalGeometry=new T.ExtrudeGeometry(shape,{depth:.22,bevelEnabled:true,bevelThickness:.025,bevelSize:.025,bevelSegments:1,steps:1,curveSegments:24});geometries.add(portalGeometry);
      portals=new T.Group();scene.add(portals);
      for(let i=0;i<3;i++){const wall=new T.Mesh(portalGeometry,[plaster,edge]);wall.position.set(0,0,1.55-i*1.55);portals.add(wall);}
      // A slender material joint gives a readable scale to the receding planes.
      for(let i=0;i<3;i++){const seam=mesh(new T.BoxGeometry(.022,4.1,.025),bronze,portals.children[0]);seam.position.set(1.7+i*.09,-.2,.26);}
      scene.add(new T.HemisphereLight('#fff4df','#85644a',2.4));
      const sunlight=new T.DirectionalLight('#fff0d6',2.6);sunlight.position.set(-4,6,8);scene.add(sunlight);
      drawFrame=()=>{
        if(!alive||!ready||!visible||document.hidden||!dirty||!renderer)return;
        uniforms.uProgress.value=state.progress;uniforms.uEntrance.value=state.entrance;uniforms.uPointer.value.set(state.pointerX,state.pointerY);
        const opening=1-state.entrance;
        portals.children.forEach((wall,i)=>{wall.position.z=1.55-i*(1.05+state.progress*1.25+opening*.35);wall.position.x=(i-1)*state.progress*.18;});
        portals.rotation.y=-.16+state.progress*.34-opening*.1;
        camera.position.set(6.3-state.progress*4.1+opening*.7+state.pointerX*.3,3.3-state.progress*.45+state.pointerY*.18,9.2);camera.lookAt(0,.1,-.35-state.progress*.4);
        renderer.render(scene,camera);if(glFailed){release();return;}dirty=false;
        element.dataset.progress=state.progress.toFixed(3);element.dataset.frames=String(++frameCount);
      };
      const resize=()=>{if(!renderer)return;const w=element.clientWidth,h=element.clientHeight;if(!w||!h)return;const aspect=w/h;const vertical=aspect<1?4.8:3.8;camera.left=-vertical*aspect;camera.right=vertical*aspect;camera.top=vertical;camera.bottom=-vertical;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<701?1.25:1.5));renderer.setSize(w,h,false);requestRender();};
      resize();renderer.compile(scene,camera);renderer.render(scene,camera);if(glFailed)throw new Error('Shader unavailable');
      const canvas=renderer.domElement;canvas.setAttribute('aria-hidden','true');element.querySelector('.scene-mount').append(canvas);ready=true;element.dataset.scene='ready';
      canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();if(ready)release();},{signal:events.signal});
      resizeObserver=new ResizeObserver(resize);resizeObserver.observe(element);gsap.ticker.add(drawFrame);
      let px,py;
      context=gsap.context(()=>{
        intro=gsap.to(state,{entrance:1,duration:4.2,ease:'sine.inOut',paused:!visible||document.hidden,onUpdate:requestRender});
        gsap.to(state,{progress:1,ease:'none',onUpdate:requestRender,scrollTrigger:{trigger:element,start:'top 95%',end:'bottom 10%',scrub:1.1}});
        px=gsap.quickTo(state,'pointerX',{duration:.6,ease:'power2.out',onUpdate:requestRender});py=gsap.quickTo(state,'pointerY',{duration:.6,ease:'power2.out',onUpdate:requestRender});
      },element);
      on(element,'pointermove',event=>{if(event.pointerType!=='mouse')return;const r=element.getBoundingClientRect();px((event.clientX-r.left)/r.width-.5);py(.5-(event.clientY-r.top)/r.height);});
      on(element,'pointerleave',()=>{px(0);py(0);});
    }catch{if(alive)release();}
  }
  // Prepare WebGL before the section reaches the viewport, while keeping the
  // entrance animation tied to actual visibility.
  const preloadObserver=new IntersectionObserver(entries=>{if(entries[0].isIntersecting){load();preloadObserver.disconnect();}},{threshold:0,rootMargin:'50% 0px'});preloadObserver.observe(element);
  const visibilityObserver=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible){load();if(!document.hidden)intro?.resume();dirty=true;}else intro?.pause();},{threshold:.01});visibilityObserver.observe(element);
  on(document,'visibilitychange',()=>{if(document.hidden)intro?.pause();else if(visible){intro?.resume();dirty=true;}});
  return {destroy(){alive=false;preloadObserver.disconnect();visibilityObserver.disconnect();events.abort();release();}};
}
