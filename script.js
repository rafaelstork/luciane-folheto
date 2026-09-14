'use strict';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const menu = document.querySelector('.mobile-menu');
const menuToggle = document.querySelector('.menu-toggle');
const lightbox = document.querySelector('.lightbox');
const galleries = {
  deck: [
    ['deck-oasis-1.webp','Deck Oásis — o espaço de convivência','Lounge, vegetação e piscina do Deck Oásis sob a luz do sol.'],
    ['deck-oasis-3.webp','Deck Oásis — água, luz e natureza','Vista frontal da piscina, palmeiras e guarda-sóis do Deck Oásis.'],
    ['deck-oasis-4.webp','Deck Oásis — um lugar para estar','Jardim, mobiliário e área de estar sob o céu aberto.'],
    ['deck-oasis-5.webp','Deck Oásis — camadas de verde','Folhagens e mobiliário de fibras em composição no jardim.'],
    ['deck-oasis-6.webp','Deck Oásis — junto à água','Espreguiçadeiras, cestos e cobogó à beira da piscina.']
  ],
  interiores: [
    ['camarim-store.webp','Camarim Store · Orlândia, SP','Imagem de projeto com marcenaria e arcos iluminados da Camarim Store.'],
    ['162-a.webp','162 A · Bosque Pitangueiras','Imagem do hall do projeto 162 A com banco e marcenaria integrados.'],
    ['helia-constantino.webp','Estética Helia Constantino','Imagem de projeto de copa com marcenaria, prateleiras e detalhes dourados.']
  ]
};
let currentGallery = 'deck';
let currentImage = 0;
let returnFocus = null;
const closeTimers = new WeakMap();

function syncScrollLock() {
  document.body.classList.toggle('locked', menu.open || lightbox.open);
}
function openDialog(dialog) {
  clearTimeout(closeTimers.get(dialog));
  if (!dialog.open) dialog.showModal();
  syncScrollLock();
  requestAnimationFrame(() => requestAnimationFrame(() => dialog.classList.add('is-visible')));
}
function closeDialog(dialog, callback) {
  if (!dialog.open) return;
  clearTimeout(closeTimers.get(dialog));
  dialog.classList.remove('is-visible');
  const finish = () => {
    dialog.close();
    syncScrollLock();
    if (dialog === menu) {
      menuToggle.setAttribute('aria-expanded','false');
      menuToggle.setAttribute('aria-label','Abrir menu');
    }
    if (callback) callback();
  };
  if (reduceMotion.matches) finish();
  else closeTimers.set(dialog, setTimeout(finish, dialog === menu ? 330 : 190));
}
menuToggle.addEventListener('click', () => {
  menuToggle.setAttribute('aria-expanded','true');
  menuToggle.setAttribute('aria-label','Fechar menu');
  openDialog(menu);
});
document.querySelector('.menu-close').addEventListener('click', () => closeDialog(menu));
menu.addEventListener('cancel', event => {event.preventDefault();closeDialog(menu);});
menu.addEventListener('click', event => {if (event.target === menu && event.clientX < menu.getBoundingClientRect().left) closeDialog(menu);});
menu.querySelectorAll('nav a').forEach(link => link.addEventListener('click', event => {
  event.preventDefault();
  const target = document.querySelector(link.getAttribute('href'));
  closeDialog(menu, () => {
    history.replaceState(null,'',link.getAttribute('href'));
    target.scrollIntoView({behavior:reduceMotion.matches?'instant':'smooth',block:'start'});
    target.setAttribute('tabindex','-1');
    target.focus({preventScroll:true});
    target.addEventListener('blur',()=>target.removeAttribute('tabindex'),{once:true});
  });
}));
window.matchMedia('(min-width: 761px)').addEventListener('change', event => {if(event.matches && menu.open) closeDialog(menu);});

document.querySelectorAll('.service-toggle').forEach(button => button.addEventListener('click', () => {
  const expanded = button.getAttribute('aria-expanded') === 'true';
  const panel = document.getElementById(button.getAttribute('aria-controls'));
  button.setAttribute('aria-expanded',String(!expanded));
  button.querySelector('span').textContent = expanded ? '+' : '−';
  panel.classList.toggle('collapsed',expanded);
  panel.inert = expanded;
}));

function renderImage() {
  const gallery = galleries[currentGallery];
  const [file,title,alt] = gallery[currentImage];
  const img = document.querySelector('.lightbox-image');
  img.alt = alt;
  img.src = 'assets/images/' + file;
  document.getElementById('lightbox-title').textContent = currentGallery === 'deck' ? 'Deck Oásis · CASACOR 2026' : 'Projetos de interiores';
  document.getElementById('lightbox-description').textContent = title;
  document.getElementById('lightbox-credit').textContent = currentGallery === 'deck' ? 'Luciane Folheto & João Vitor Gulini · Foto: Victor / Divulgação CASACOR Ribeirão Preto' : 'Projeto: Luciane Folheto · Acervo oficial do escritório';
  document.getElementById('lightbox-counter').textContent = `${currentImage+1} / ${gallery.length}`;
  document.querySelector('.lightbox-prev').disabled = currentImage === 0;
  document.querySelector('.lightbox-next').disabled = currentImage === gallery.length-1;
}
document.querySelectorAll('[data-gallery]').forEach(button => button.addEventListener('click', () => {
  returnFocus = button;
  currentGallery = button.dataset.gallery;
  currentImage = Number(button.dataset.index);
  renderImage();
  openDialog(lightbox);
}));
function stepImage(direction) {currentImage=Math.max(0,Math.min(galleries[currentGallery].length-1,currentImage+direction));renderImage();}
function closeGallery() {closeDialog(lightbox, () => returnFocus?.focus({preventScroll:true}));}
document.querySelector('.lightbox-close').addEventListener('click',closeGallery);
document.querySelector('.lightbox-prev').addEventListener('click',()=>stepImage(-1));
document.querySelector('.lightbox-next').addEventListener('click',()=>stepImage(1));
lightbox.addEventListener('cancel',event=>{event.preventDefault();closeGallery();});
lightbox.addEventListener('click',event=>{if(event.target === lightbox || event.target.classList.contains('lightbox-stage'))closeGallery();});
lightbox.addEventListener('keydown',event=>{
  if(event.key === 'ArrowRight'){event.preventDefault();stepImage(1);}
  if(event.key === 'ArrowLeft'){event.preventDefault();stepImage(-1);}
  if(event.key === 'Home'){event.preventDefault();currentImage=0;renderImage();}
  if(event.key === 'End'){event.preventDefault();currentImage=galleries[currentGallery].length-1;renderImage();}
});
let touchStart = null;
let suppressSwipeClick = false;
lightbox.addEventListener('click',event=>{if(suppressSwipeClick){event.stopImmediatePropagation();event.preventDefault();suppressSwipeClick=false;}},true);
document.querySelector('.lightbox-stage').addEventListener('pointerdown',event=>{
  if(event.pointerType!=='touch')return;
  if(!event.isPrimary){touchStart=null;return;}
  touchStart={id:event.pointerId,x:event.clientX,y:event.clientY};
});
document.querySelector('.lightbox-stage').addEventListener('pointerup',event=>{
  if(!touchStart || event.pointerId!==touchStart.id)return;
  const dx=event.clientX-touchStart.x,dy=event.clientY-touchStart.y;
  touchStart=null;
  if(Math.abs(dx)>60 && Math.abs(dx)>Math.abs(dy)*1.5){suppressSwipeClick=true;stepImage(dx<0?1:-1);setTimeout(()=>{suppressSwipeClick=false;},400);}
});
document.querySelector('.lightbox-stage').addEventListener('pointercancel',()=>{touchStart=null;});
