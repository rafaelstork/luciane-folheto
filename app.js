'use strict';
const whatsappMessage = 'Olá, Luciane! Conheci seus projetos pelo site e gostaria de conversar sobre um projeto de arquitetura ou interiores.';
document.querySelectorAll('[data-whatsapp]').forEach(link => { link.href = 'https://wa.me/5516997318584?text=' + encodeURIComponent(whatsappMessage); });

const menuButton = document.querySelector('.menu-toggle');
const menu = document.querySelector('.mobile-menu');
const main = document.querySelector('main');
const footer = document.querySelector('footer');
function setMenu(open) {
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  menu.classList.toggle('open', open);
  menu.inert = !open;
  main.inert = open;
  footer.inert = open;
  document.body.classList.toggle('locked', open);
  if (open) setTimeout(()=>{if(menu.classList.contains('open'))menu.querySelector('a').focus();},matchMedia('(prefers-reduced-motion: reduce)').matches?0:300);
  else menuButton.focus({preventScroll:true});
}
menuButton.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
document.querySelector('.site-header .brand').addEventListener('click',()=>{if(menuButton.getAttribute('aria-expanded')==='true')setMenu(false);});
menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  setMenu(false);
  const section = document.querySelector(link.getAttribute('href'));
  if(section){section.setAttribute('tabindex','-1'); section.focus({preventScroll:true});}
}));
document.addEventListener('keydown', event => {
  if (menuButton.getAttribute('aria-expanded') !== 'true') return;
  if (event.key === 'Escape') setMenu(false);
  if (event.key === 'Tab') {
    const items=[menuButton,...menu.querySelectorAll('a')];
    const first=items[0],last=items[items.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
});
matchMedia('(min-width:701px)').addEventListener('change', event => {if(event.matches&&menuButton.getAttribute('aria-expanded')==='true')setMenu(false);});

const projects = [
  {title:'Camarim Store', detail:'Arquitetura de interiores · Orlândia/SP', source:'https://www.instagram.com/arquiteta.lucianefolheto/p/DdJx5pLnJJE/'},
  {title:'Deck Oásis', detail:'CASACOR Ribeirão Preto 2026 · Luciane Folheto e João Gulini', source:'https://www.instagram.com/arquiteta.lucianefolheto/p/DchO2muG_7U/'},
  {title:'162 A', detail:'Projeto de interiores · Bosque Pitangueiras', source:'https://www.instagram.com/arquiteta.lucianefolheto/p/DcZtTtdGz6M/'},
  {title:'Quarto Evolutivo', detail:'Projeto de interiores · Quarto infantil', source:'https://www.instagram.com/arquiteta.lucianefolheto/p/DW3iY-pAEga/'},
  {title:'Estética Helia Constantino', detail:'Arquitetura de interiores · Espaço profissional', source:'https://www.instagram.com/arquiteta.lucianefolheto/p/Db65LqZHA_6/'},
  {title:'Jantar & adega', detail:'Projeto de interiores e ambientação · Apartamento', source:'https://www.instagram.com/arquiteta.lucianefolheto/p/DaTyuHOnILP/'}
];
const dialog = document.querySelector('.lightbox');
const image = document.querySelector('#lightbox-image');
const previous = document.querySelector('.gallery-prev');
const next = document.querySelector('.gallery-next');
let selected = 0;
let opener;
function showImage(index) {
  if(index<0||index>=projects.length)return;
  selected=index;
  const data=projects[index];
  const original=document.querySelector('[data-project="'+index+'"] img');
  image.src=original.src;image.alt=original.alt;
  document.querySelector('#lightbox-title').textContent=data.title;
  document.querySelector('#lightbox-detail').textContent=data.detail;
  document.querySelector('#lightbox-source').href=data.source;
  document.querySelector('#lightbox-counter').textContent=String(index+1).padStart(2,'0')+' / '+String(projects.length).padStart(2,'0');
  document.querySelector('#gallery-status').textContent=data.title+'. Imagem '+(index+1)+' de '+projects.length+'.';
  previous.disabled=index===0;next.disabled=index===projects.length-1;
}
document.querySelectorAll('[data-project]').forEach(button => button.addEventListener('click', () => {
  opener=button;showImage(Number(button.dataset.project));dialog.showModal();document.body.classList.add('locked');document.querySelector('.close-lightbox').focus();
}));
document.querySelector('.close-lightbox').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{document.body.classList.remove('locked');opener?.focus({preventScroll:true});});
dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
previous.addEventListener('click',()=>showImage(selected-1));next.addEventListener('click',()=>showImage(selected+1));
dialog.addEventListener('keydown',event=>{if(event.key==='ArrowRight'){event.preventDefault();showImage(selected+1);}if(event.key==='ArrowLeft'){event.preventDefault();showImage(selected-1);}});
let touchStart;
image.addEventListener('touchstart',event=>{if(event.touches.length===1)touchStart={x:event.touches[0].clientX,y:event.touches[0].clientY};else touchStart=null;},{passive:true});
image.addEventListener('touchend',event=>{if(!touchStart)return;const dx=event.changedTouches[0].clientX-touchStart.x;const dy=event.changedTouches[0].clientY-touchStart.y;if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*1.5)showImage(selected+(dx<0?1:-1));touchStart=null;},{passive:true});

if('IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
    entry.target.classList.toggle('motion-visible',entry.isIntersecting);
    if(entry.isIntersecting&&entry.target.classList.contains('reveal'))entry.target.classList.add('in-view');
  }),{threshold:.15});
  document.querySelectorAll('.reveal,.hero').forEach(element=>observer.observe(element));
}

const motionToggle=document.querySelector('.motion-toggle');
const reducedPreference=matchMedia('(prefers-reduced-motion: reduce)');
function setReducedMotion(reduced){
  document.documentElement.classList.toggle('reduced-motion',reduced);
  motionToggle.setAttribute('aria-pressed',String(reduced));
  motionToggle.textContent=reduced?'Movimentos reduzidos':'Reduzir movimentos';
}
setReducedMotion(reducedPreference.matches);
motionToggle.addEventListener('click',()=>setReducedMotion(reducedPreference.matches||motionToggle.getAttribute('aria-pressed')!=='true'));
reducedPreference.addEventListener('change',event=>setReducedMotion(event.matches));

