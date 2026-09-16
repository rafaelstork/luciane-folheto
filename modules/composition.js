export function mountComposition({gsap,ScrollTrigger,DrawSVG,fromVisit=false}){
  let intro;
  const context=gsap.context(()=>{
    const responsive=gsap.matchMedia();
    responsive.add({mobile:'(max-width:700px)',desktop:'(min-width:701px)'},({conditions})=>{
    const distance=conditions.mobile ? .6 : 1;
    const main=document.querySelector('main'),hero=main.querySelector('.hero');
    const draw=(tl,target,at,duration=1.6)=>{const nodes=main.querySelectorAll(target);if(DrawSVG&&nodes.length)tl.from(nodes,{drawSVG:'0%',duration,stagger:.09,ease:'power2.inOut'},at);};
    intro=gsap.timeline({paused:fromVisit,defaults:{ease:'power3.out'}});
    if(hero){
      intro.fromTo('.hero-shutter',{scaleY:.32},{scaleY:0,duration:1.4,ease:'power3.inOut'},0)
        .from('.hero-margin .hero-joint',{y:25*distance,rotationY:-18*distance,transformOrigin:'left center',duration:1.7},.2)
        .from('.hero h1 span,.hero h1 em',{y:18*distance,stagger:.09,duration:.9},.1);
      draw(intro,'.hero-frame .draw',.15,1.7);draw(intro,'.hero-joint .draw',.4,2.1);
      ScrollTrigger.create({trigger:hero,start:'top bottom',end:'bottom top',onToggle:s=>{if(!fromVisit)s.isActive?intro.resume():intro.pause();}});
      gsap.to('.hero-joint',{yPercent:-12,ease:'none',scrollTrigger:{trigger:hero,start:'top top',end:'bottom top',scrub:.7}});
      gsap.fromTo('.hero-photo img',{scale:1.025,yPercent:0},{scale:1.075,yPercent:2*distance,ease:'none',scrollTrigger:{trigger:hero,start:'top top',end:'bottom top',scrub:.8}});
      const portfolio=gsap.timeline({scrollTrigger:{trigger:'.portfolio',start:'top 85%',toggleActions:'play pause resume pause'}});
      portfolio.from('.project-image',{'--frame-reveal':0,duration:1.25,stagger:.12,ease:'power3.inOut'},0).from('.project-image img',{clipPath:'inset(0 0 14% 0 round 3px 3px 90px 3px)',y:24,duration:1.2,stagger:.1,ease:'power3.out'},.15);
      const niche=gsap.timeline({scrollTrigger:{trigger:'.spatial-figure',start:'top 88%',end:'bottom 18%',scrub:.7}});
      niche.fromTo('.spatial-ruler i',{scaleX:0},{scaleX:1,ease:'none'},0)
        .fromTo('.spatial-hairline',{y:18*distance},{y:-12*distance,ease:'none'},0)
        .fromTo('.material-reference',{y:22*distance},{y:-20*distance,ease:'none'},0);
      draw(niche,'.spatial-hairline .draw',0,1);
      const about=gsap.timeline({scrollTrigger:{trigger:'.about',start:'top 85%',end:'center 45%',scrub:.7}});
      about.from('.portrait',{'--portrait-plane':.55,'--portrait-offset':'24px',y:35*distance,ease:'none'},0);
      // The drawing owns its travel interval, independent of the portrait.
      const aboutDrawing=gsap.timeline({scrollTrigger:{trigger:'.about-lines',start:'top 92%',end:'bottom 24%',scrub:1.3}});
      draw(aboutDrawing,'.about-lines .draw',0,1);
      const services=gsap.timeline({scrollTrigger:{trigger:'.services',start:'top 85%',toggleActions:'play pause resume pause'}});
      services.from('.service-list details',{x:18*distance,stagger:.12,duration:.75},0);
      const contact=gsap.timeline({scrollTrigger:{trigger:'.contact-drawing svg',start:'top 92%',end:'bottom 24%',scrub:1.3}});
      contact.from('.contact-drawing',{x:-35,rotationY:15,transformOrigin:'right center',ease:'none'},0);draw(contact,'.contact-drawing .draw',0,1);
    }else{
      intro.from('.case-photo-frame .case-image img',{scale:1.045,duration:1.4},0).from('.case-heading h1',{y:18,duration:.8},.1);
      draw(intro,'.case-frame .draw',.1,1.5);
      const story=gsap.timeline({scrollTrigger:{trigger:'.case-story',start:'top 87%',end:'bottom 65%',scrub:.6}});
      draw(story,'.case-diagram .draw',0,1);
      main.querySelectorAll('.case-gallery-grid figure').forEach(figure=>{
        gsap.from(figure,{y:30*distance,duration:1,ease:'power3.out',scrollTrigger:{trigger:figure,start:'top 92%',toggleActions:'play pause resume pause'}});
      });
      gsap.from('.case-next img',{clipPath:'inset(0 100% 0 0 round 65px 0 0 0)',duration:1,scrollTrigger:{trigger:'.case-next',start:'top 95%',toggleActions:'play pause resume pause'}});
    }
    });
    return ()=>responsive.revert();
  },document.querySelector('main'));
  return {enter(){intro?.play();fromVisit=false;},destroy(){context.revert();}};
}
