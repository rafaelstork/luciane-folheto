let gallerySequence = 0;

/** Native image dialog; the page owns GSAP and the shared scroll coordinator. */
export function mountGallery({ gsap = null, reduced = () => false, scroll, root = document } = {}) {
  const doc = root.ownerDocument || root;
  const win = doc.defaultView;
  const links = Array.from(root.querySelectorAll('a[data-gallery]'));
  const seen = new Set();
  const items = links.filter(link => {
    const id = link.dataset.gallery;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  }).map(link => ({
    id: link.dataset.gallery,
    href: link.href,
    title: link.dataset.title || link.querySelector('img')?.alt || 'Projeto',
    detail: link.dataset.detail || '',
    source: link.dataset.source || '',
    link,
  }));
  const empty = { destroy() {}, refreshMotion() {} };
  if (!items.length || !win.HTMLDialogElement?.prototype.showModal) return empty;

  const uid = `gallery-${++gallerySequence}`;
  const lockOwner = uid;
  const dialog = doc.createElement('dialog');
  dialog.className = 'gallery-dialog';
  dialog.setAttribute('aria-labelledby', `${uid}-title`);
  dialog.setAttribute('data-lenis-prevent', '');
  dialog.innerHTML = `
    <div class="gallery-panel">
      <header class="gallery-header">
        <p class="gallery-eyebrow">Acervo selecionado</p>
        <p class="gallery-count" aria-label="Posição na galeria"></p>
        <button class="gallery-button gallery-close" type="button" aria-label="Fechar imagem" autofocus>
          <span class="gallery-button-plane" aria-hidden="true"></span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18"/></svg>
        </button>
      </header>
      <div class="gallery-stage" aria-busy="false">
        <div class="gallery-images"></div>
        <div class="gallery-status" hidden>
          <p class="gallery-status-text" role="status"></p>
          <button class="gallery-retry" type="button" hidden>Tentar novamente</button>
        </div>
      </div>
      <footer class="gallery-footer">
        <div class="gallery-caption">
          <h2 class="gallery-title" id="${uid}-title">Projetos de Luciane Folheto</h2>
          <p class="gallery-detail"></p>
          <a class="gallery-source" target="_blank" rel="noopener noreferrer" hidden>Ver publicação original
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false"><path d="M6 18 18 6M7 6h11v11"/></svg>
          </a>
        </div>
        <nav class="gallery-navigation" aria-label="Navegação das imagens">
          <button class="gallery-button gallery-previous" type="button" aria-label="Imagem anterior" data-direction="-1">
            <span class="gallery-button-plane" aria-hidden="true"></span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false"><path d="M20 12H4m7-7-7 7 7 7"/></svg>
          </button>
          <button class="gallery-button gallery-next" type="button" aria-label="Próxima imagem" data-direction="1">
            <span class="gallery-button-plane" aria-hidden="true"></span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false"><path d="M4 12h16m-7-7 7 7-7 7"/></svg>
          </button>
        </nav>
      </footer>
      <p class="gallery-announcement" role="status" aria-live="polite" aria-atomic="true"></p>
    </div>`;
  doc.body.append(dialog);
  const find = selector => dialog.querySelector(selector);
  const panel = find('.gallery-panel');
  const stage = find('.gallery-stage');
  const images = find('.gallery-images');
  const status = find('.gallery-status');
  const statusText = find('.gallery-status-text');
  const retry = find('.gallery-retry');
  const title = find('.gallery-title');
  const detail = find('.gallery-detail');
  const source = find('.gallery-source');
  const count = find('.gallery-count');
  const announce = find('.gallery-announcement');
  const closeButton = find('.gallery-close');
  const previous = find('.gallery-previous');
  const next = find('.gallery-next');
  find('.gallery-navigation').hidden = items.length === 1;

  let alive = true;
  let opened = false;
  let closing = false;
  let generation = 0;
  let requestedIndex = -1;
  let displayedIndex = -1;
  let activeImage = null;
  let trigger = null;
  let pending = null;
  let panelTimeline = null;
  let imageTimeline = null;
  let closeTimer = 0;
  let gesture = null;
  let backdropStart = null;
  let engine = gsap;
  let context = null;
  const removers = [];
  const buttonTweens = new Map();

  function on(node, type, handler, options) {
    node.addEventListener(type, handler, options);
    removers.push(() => node.removeEventListener(type, handler, options));
  }
  function animated() { return Boolean(engine && !reduced()); }
  function runAnimation(action, fallback) {
    if (!animated()) { fallback(); return; }
    try {
      if (!context) context = engine.context(() => {}, dialog);
      context.add(action);
    } catch {
      engine = null;
      try { context?.revert(); } catch { /* The immediate DOM fallback still releases the modal. */ }
      context = null;
      stopAnimations();
      fallback();
    }
  }
  function resetVisual(node) {
    if (!node) return;
    node.style.removeProperty('transform');
    node.style.removeProperty('opacity');
    node.style.removeProperty('visibility');
  }
  function finishImage() {
    imageTimeline?.kill();
    imageTimeline = null;
    for (const image of Array.from(images.children)) {
      if (image !== activeImage) image.remove();
    }
    resetVisual(activeImage);
  }
  function stopAnimations() {
    panelTimeline?.kill();
    panelTimeline = null;
    finishImage();
    buttonTweens.forEach(tween => tween.kill());
    buttonTweens.clear();
    resetVisual(panel);
    for (const node of dialog.querySelectorAll('.gallery-button svg, .gallery-button-plane')) resetVisual(node);
    dialog.style.removeProperty('--gallery-backdrop-opacity');
  }
  function cancelPending() {
    pending?.abort();
    pending = null;
  }
  function updateControls() {
    previous.setAttribute('aria-disabled', String(requestedIndex <= 0));
    next.setAttribute('aria-disabled', String(requestedIndex >= items.length - 1));
  }
  function updateCaption(index) {
    const item = items[index];
    title.textContent = item.title;
    detail.textContent = item.detail;
    detail.hidden = !item.detail;
    count.textContent = `${index + 1} de ${items.length}`;
    const allowedSource = /^https?:\/\//i.test(item.source);
    source.hidden = !allowedSource;
    if (allowedSource) source.href = item.source;
    else source.removeAttribute('href');
  }
  function setStatus(message = '', failed = false) {
    status.hidden = !message;
    statusText.textContent = message;
    retry.hidden = !failed;
    stage.setAttribute('aria-busy', String(Boolean(message) && !failed));
  }

  // decode cannot be aborted; the generation token also guards its late completion.
  function loadImage(url, signal) {
    return new Promise((resolve, reject) => {
      const image = new win.Image();
      let settled = false;
      const timeout = win.setTimeout(() => finish(new Error('Image timeout')), 20000);
      const clean = () => {
        win.clearTimeout(timeout);
        image.onload = image.onerror = null;
        signal.removeEventListener('abort', abort);
      };
      const finish = error => {
        if (settled) return;
        settled = true;
        clean();
        if (error) { image.removeAttribute('src'); reject(error); }
        else resolve(image);
      };
      const abort = () => {
        finish(new win.DOMException('Cancelled', 'AbortError'));
        image.removeAttribute('src');
      };
      signal.addEventListener('abort', abort, { once: true });
      image.decoding = 'async';
      image.onload = async () => {
        try { if (image.decode) await image.decode(); } catch { /* The loaded image remains usable. */ }
        if (image.naturalWidth > 0) finish();
        else finish(new Error('Invalid image'));
      };
      image.onerror = () => finish(new Error('Image unavailable'));
      image.src = url;
      if (signal.aborted) abort();
    });
  }

  function makeImage(image, index) {
    image.removeAttribute('id');
    image.className = 'gallery-image';
    image.alt = items[index].link.querySelector('img')?.alt || items[index].title;
    image.draggable = false;
    return image;
  }
  function showImage(image, index, direction) {
    finishImage();
    const old = activeImage;
    activeImage = makeImage(image, index);
    if (old) { old.alt = ''; old.setAttribute('aria-hidden', 'true'); }
    images.append(activeImage);
    displayedIndex = index;
    updateCaption(index);
    setStatus();
    const complete = () => {
      finishImage();
      if (opened && !closing) announce.textContent = `${items[index].title}. Imagem ${index + 1} de ${items.length}.`;
    };
    runAnimation(() => {
      imageTimeline = engine.timeline({ onComplete: complete });
      imageTimeline.fromTo(activeImage,
        { x: direction * 16, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.4, ease: 'power2.out' }, 0);
      if (old) imageTimeline.to(old, { x: direction * -12, opacity: 0, duration: 0.3, ease: 'power2.inOut' }, 0);
    }, complete);
  }
  async function requestImage(index, direction = 1) {
    if (!alive || !opened || closing || index < 0 || index >= items.length) return;
    requestedIndex = index;
    const token = ++generation;
    cancelPending();
    finishImage();
    updateControls();
    announce.textContent = '';
    setStatus('Carregando imagem…');
    const controller = new win.AbortController();
    pending = controller;
    try {
      const image = await loadImage(items[index].href, controller.signal);
      if (!alive || !opened || closing || token !== generation) return;
      pending = null;
      showImage(image, index, direction);
    } catch (error) {
      if (!alive || !opened || closing || token !== generation || error.name === 'AbortError') return;
      pending = null;
      setStatus(activeImage ? 'Esta imagem não carregou. A imagem exibida continua disponível.' : 'Não foi possível carregar a imagem.', true);
    }
  }
  function step(direction) {
    if (closing) return;
    const target = requestedIndex + direction;
    if (target >= 0 && target < items.length) requestImage(target, direction);
  }

  function finishClose({ restoreFocus = true } = {}) {
    win.clearTimeout(closeTimer);
    closeTimer = 0;
    ++generation;
    cancelPending();
    stopAnimations();
    try { context?.revert(); } catch { /* Library failure cannot keep the document locked. */ }
    context = null;
    opened = false;
    closing = false;
    gesture = backdropStart = null;
    // close events are queued by browsers, so cleanup is idempotent.
    if (dialog.open) dialog.close();
    scroll?.unlock(lockOwner);
    images.replaceChildren();
    activeImage = null;
    displayedIndex = requestedIndex = -1;
    setStatus();
    announce.textContent = '';
    if (restoreFocus && trigger?.isConnected) trigger.focus({ preventScroll: true });
    trigger = null;
  }
  function close() {
    if (!opened || closing) return;
    closing = true;
    ++generation;
    cancelPending();
    stopAnimations();
    // Release the modal even if a library callback or ticker fails.
    closeTimer = win.setTimeout(() => finishClose(), 420);
    runAnimation(() => {
      panelTimeline = engine.timeline({ onComplete: () => finishClose() });
      panelTimeline.to(panel, { y: 12, opacity: 0, duration: 0.25, ease: 'power2.in' }, 0);
      panelTimeline.to(dialog, { '--gallery-backdrop-opacity': 0, duration: 0.25 }, 0);
    }, () => finishClose());
  }
  function open(index, opener) {
    if (!alive) return;
    if (opened || dialog.open) finishClose({ restoreFocus: false });
    trigger = opener;
    requestedIndex = index;
    displayedIndex = -1;
    updateControls();
    title.textContent = items[index].title;
    count.textContent = `${items.length} imagens`;
    detail.hidden = true;
    source.hidden = true;
    // Only reuse an already decoded thumbnail; do not start a second fetch.
    const thumbnail = opener.querySelector('img');
    if (thumbnail?.complete && thumbnail.naturalWidth > 0) {
      activeImage = makeImage(thumbnail.cloneNode(false), index);
      activeImage.removeAttribute('srcset');
      activeImage.removeAttribute('sizes');
      activeImage.removeAttribute('loading');
      activeImage.src = thumbnail.currentSrc || thumbnail.src;
      images.append(activeImage);
      displayedIndex = index;
      updateCaption(index);
    }
    try { dialog.showModal(); } catch {
      trigger = null;
      images.replaceChildren();
      activeImage = null;
      return false;
    }
    opened = true;
    closing = false;
    scroll?.lock(lockOwner);
    closeButton.focus({ preventScroll: true });
    runAnimation(() => {
      panelTimeline = engine.timeline();
      panelTimeline.fromTo(dialog, { '--gallery-backdrop-opacity': 0 }, { '--gallery-backdrop-opacity': 1, duration: 0.3 }, 0);
      panelTimeline.fromTo(panel, { y: 18, opacity: 0.65 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out' }, 0);
    }, () => { resetVisual(panel); });
    requestImage(index, 1);
    return true;
  }

  on(root, 'click', event => {
    const link = event.target.closest?.('a[data-gallery]');
    if (!link || !root.contains(link) || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const index = items.findIndex(item => item.id === link.dataset.gallery);
    if (index < 0) return;
    if (open(index, link)) event.preventDefault();
  });
  on(closeButton, 'click', close);
  on(previous, 'click', () => { if (previous.getAttribute('aria-disabled') !== 'true') step(-1); });
  on(next, 'click', () => { if (next.getAttribute('aria-disabled') !== 'true') step(1); });
  on(retry, 'click', () => requestImage(requestedIndex, Math.sign(requestedIndex - displayedIndex) || 1));
  on(dialog, 'cancel', event => { event.preventDefault(); close(); });
  on(dialog, 'close', () => { if (opened && !dialog.open) finishClose(); });
  on(dialog, 'keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      step(event.key === 'ArrowLeft' ? -1 : 1);
    }
    if (event.key === 'Tab') {
      const focusable = Array.from(dialog.querySelectorAll('button, a[href], [tabindex="0"]')).filter(node => !node.hidden && node.getClientRects().length && !node.disabled);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  on(dialog, 'pointerdown', event => {
    backdropStart = event.target === dialog ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null;
  });
  on(dialog, 'pointerup', event => {
    if (backdropStart?.id === event.pointerId && event.target === dialog && Math.hypot(event.clientX - backdropStart.x, event.clientY - backdropStart.y) < 6) close();
    backdropStart = null;
  });
  on(dialog, 'pointercancel', () => { backdropStart = null; });

  on(images, 'pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || !opened || closing) { gesture = null; return; }
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, horizontal: false };
  });
  on(images, 'pointermove', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { gesture = null; return; }
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.4 && !gesture.horizontal) {
      gesture.horizontal = true;
      try { images.setPointerCapture(event.pointerId); } catch { /* Pointer may already have ended. */ }
    }
  });
  on(images, 'pointerup', event => {
    const current = gesture;
    gesture = null;
    if (images.hasPointerCapture?.(event.pointerId)) images.releasePointerCapture(event.pointerId);
    if (!current || current.id !== event.pointerId || !current.horizontal) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.4) step(dx < 0 ? 1 : -1);
  });
  on(images, 'pointercancel', () => { gesture = null; });
  on(images, 'lostpointercapture', () => { gesture = null; });

  for (const button of [closeButton, previous, next]) {
    const icon = button.querySelector('svg');
    const plane = button.querySelector('.gallery-button-plane');
    let hovered = false;
    let focused = false;
    function response(pressed = false) {
      const wasActive = button.classList.contains('gallery-button-active');
      const active = (hovered || focused || pressed) && button.getAttribute('aria-disabled') !== 'true';
      button.classList.toggle('gallery-button-active', active);
      buttonTweens.get(button)?.kill();
      runAnimation(() => {
        const direction = Number(button.dataset.direction || 0);
        const timeline = engine.timeline();
        timeline.to(icon, { x: active ? direction * 3 : 0, scale: pressed ? 0.88 : 1, duration: 0.18, ease: 'power2.out' }, 0);
        timeline.fromTo(plane, { scaleX: wasActive ? 1 : 0 }, { scaleX: active ? 1 : 0, duration: 0.18, ease: 'power2.out' }, 0);
        buttonTweens.set(button, timeline);
      }, () => { resetVisual(icon); resetVisual(plane); });
    }
    on(button, 'pointerenter', event => { if (event.pointerType === 'mouse') { hovered = true; response(); } });
    on(button, 'pointerleave', () => { hovered = false; response(); });
    on(button, 'focus', () => { focused = true; response(); });
    on(button, 'blur', () => { focused = false; response(); });
    on(button, 'pointerdown', () => response(true));
    on(button, 'pointerup', () => response());
    on(button, 'pointercancel', () => response());
    on(button, 'keydown', event => { if (event.key === ' ' || event.key === 'Enter') response(true); });
    on(button, 'keyup', event => { if (event.key === ' ' || event.key === 'Enter') response(); });
  }

  return {
    refreshMotion() {
      if (!alive || !reduced()) return;
      if (closing) finishClose();
      else stopAnimations();
    },
    destroy() {
      if (!alive) return;
      alive = false;
      removers.forEach(remove => remove());
      finishClose({ restoreFocus: false });
      dialog.remove();
    },
  };
}
