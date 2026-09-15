/**
 * Junta de luz: two mineral surfaces meeting along an oblique construction joint.
 * Three r182 / WebGL2, one plane and one draw call; no image textures or post passes.
 * All drawing uses the shared GSAP ticker. HTML/SVG remains the base composition.
 */

const vertexShader = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */`
  varying vec2 vUv;
  uniform vec2 uResolution;
  uniform vec2 uPointer;
  uniform float uPointerStrength;
  uniform float uLight;
  uniform float uScroll;
  uniform float uEntrance;
  uniform vec3 uClay;
  uniform vec3 uPaper;
  uniform vec3 uSepia;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float grain(vec2 p) {
    vec2 cell = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(cell), hash(cell + vec2(1.0, 0.0)), f.x),
               mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0)), f.x), f.y);
  }

  void main() {
    // Height-normalized coordinates preserve the slope and material scale on resize.
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
    vec2 normal = normalize(vec2(0.72, -1.0));
    float distanceToJoint = dot(p, normal) + 0.055;
    float fold = 0.22 + 0.50 * uScroll + 0.12 * uEntrance;
    float halfGap = 0.013 + 0.024 * uScroll + 0.007 * uEntrance;
    float aa = max(fwidth(distanceToJoint), 0.001);
    float leftPlane = 1.0 - smoothstep(-halfGap - aa, -halfGap + aa, distanceToJoint);
    float rightPlane = smoothstep(halfGap - aa, halfGap + aa, distanceToJoint);

    // Each source owns a distinct uniform: UI light, pointer offset, scroll and entry.
    float sweep = sin(uEntrance * 3.14159265) * 0.35;
    vec2 lightXY = vec2(mix(-0.65, 0.7, uLight) + sweep, 0.48);
    lightXY += uPointer * vec2(0.48, 0.34) * uPointerStrength;
    vec3 lightDirection = normalize(vec3(lightXY - p, 1.15));
    vec3 leftNormal = normalize(vec3(-normal * fold, 1.0));
    vec3 rightNormal = normalize(vec3(normal * fold * 0.62, 1.0));
    float leftDiffuse = max(dot(leftNormal, lightDirection), 0.0);
    float rightDiffuse = max(dot(rightNormal, lightDirection), 0.0);

    float coarse = grain(p * 85.0);
    float fine = hash(floor(p * 720.0));
    float mineral = (coarse - 0.5) * 0.035 + (fine - 0.5) * 0.019;
    float proximity = exp(-abs(distanceToJoint) * 5.0);
    vec3 clayPlane = mix(uClay, uPaper, 0.12) * (0.72 + leftDiffuse * 0.28);
    vec3 paperPlane = mix(uPaper, uClay, 0.09) * (0.83 + rightDiffuse * 0.17);
    clayPlane *= 1.0 - proximity * (0.065 + fold * 0.08);
    paperPlane *= 1.0 - proximity * 0.085;
    clayPlane += mineral;
    paperPlane += mineral * 0.64;

    // A recessed joint and its lit edge give the two flat fields material depth.
    vec3 recessed = mix(uSepia, uClay, 0.30);
    float glow = exp(-pow(distanceToJoint / max(halfGap * 0.40, 0.003), 2.0));
    float travellingLight = exp(-length(p - lightXY * 0.45) * 1.6);
    recessed = mix(recessed, uPaper, glow * (0.22 + travellingLight * 0.43));
    vec3 color = recessed * (1.0 - leftPlane - rightPlane)
               + clayPlane * leftPlane + paperPlane * rightPlane;
    float litEdge = exp(-abs(distanceToJoint - halfGap) * 260.0);
    color = mix(color, uPaper, litEdge * (0.17 + 0.18 * travellingLight));
    float vignette = smoothstep(0.18, 0.94, length(p * vec2(0.53, 0.76)));
    color *= 1.0 - vignette * 0.06;
    gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
    // THREE.Color converts CSS sRGB values to linear; convert output exactly once.
    #include <colorspace_fragment>
  }
`;

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const emptyController = () => ({ destroy() {}, setProgress() {}, refreshMotion() {} });
const instances = new WeakMap();

/**
 * Resolves immediately with a cleanup handle; loading continues only while mounted.
 * The caller owns ScrollTrigger and calls setProgress with its normalized progress.
 */
export async function mountMaterialScene({ element, gsap, reduced = () => false } = {}) {
  if (!element) return emptyController();
  instances.get(element)?.destroy();

  const hasMotionEngine = Boolean(gsap?.ticker && gsap?.to && gsap?.context);
  const section = element.closest('.material-section') || element.parentElement;
  const lightControl = section?.querySelector('input[data-light]');
  const connection = navigator.connection;
  const state = { entrance: 0, pointerX: 0, pointerY: 0, pointerStrength: 0 };
  let progress = 0;
  let light = readLight();
  let alive = true;
  let visible = false;
  let failed = false;
  let loading = false;
  let generation = 0;
  let dirty = false;
  let ticking = false;
  let firstFrame = false;
  let hasPlayed = false;
  let resource = null;
  let entranceTween = null;
  let pointerTween = null;
  let animationContext = null;
  let resizeObserver = null;
  let visibilityObserver = null;
  let lastWidth = 0;
  let lastHeight = 0;
  let lastDpr = 0;

  function readLight() {
    if (!lightControl) return 0.62;
    const min = Number(lightControl.min || 0);
    const max = Number(lightControl.max || 100);
    return clamp((Number(lightControl.value) - min) / Math.max(max - min, 1));
  }

  function permitted() {
    return alive && hasMotionEngine && element.isConnected && !reduced() && !connection?.saveData;
  }

  function canDraw() {
    return permitted() && visible && !document.hidden && Boolean(resource);
  }

  function stopTick() {
    if (!ticking) return;
    gsap.ticker.remove(draw);
    ticking = false;
  }

  function requestFrame() {
    dirty = true;
    if (!canDraw() || ticking) return;
    ticking = true;
    gsap.ticker.add(draw);
  }

  function disposeResources() {
    stopTick();
    entranceTween?.kill();
    pointerTween?.kill();
    entranceTween = pointerTween = null;
    animationContext?.revert();
    animationContext = null;
    const current = resource;
    resource = null;
    if (current) {
      current.canvas.removeEventListener('webglcontextlost', contextLost);
      current.geometry.dispose();
      current.material.dispose();
      current.scene.clear();
      current.renderer.dispose();
      // Dispose removes Three's context listeners before releasing the context.
      if (!current.gl.isContextLost()) current.renderer.forceContextLoss();
      current.canvas.remove();
    }
    firstFrame = false;
    lastWidth = lastHeight = lastDpr = 0;
    element.removeAttribute('data-scene-ready');
  }

  function fallback({ permanent = false } = {}) {
    generation += 1;
    loading = false;
    failed = permanent;
    disposeResources();
    element.dataset.scene = 'fallback';
  }

  function contextLost(event) {
    event.preventDefault();
    fallback({ permanent: true });
  }

  function measure() {
    if (!resource || !permitted()) return;
    const width = Math.max(1, Math.round(element.clientWidth));
    const height = Math.max(1, Math.round(element.clientHeight));
    const mobile = window.matchMedia('(max-width: 700px)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5);
    if (width === lastWidth && height === lastHeight && dpr === lastDpr) return;
    lastWidth = width;
    lastHeight = height;
    lastDpr = dpr;
    resource.renderer.setPixelRatio(dpr);
    resource.renderer.setSize(width, height, false);
    resource.uniforms.uResolution.value.set(width, height);
    requestFrame();
  }

  function draw() {
    if (!canDraw()) {
      stopTick();
      return;
    }
    if (!dirty) {
      stopTick();
      return;
    }
    dirty = false;
    const current = resource;
    const uniforms = current.uniforms;
    uniforms.uScroll.value = progress;
    uniforms.uEntrance.value = state.entrance;
    uniforms.uLight.value = light;
    uniforms.uPointer.value.set(state.pointerX, state.pointerY);
    uniforms.uPointerStrength.value = state.pointerStrength;
    try {
      current.renderer.render(current.scene, current.camera);
      if (current.shaderFailed || current.gl.isContextLost()) {
        fallback({ permanent: true });
        return;
      }
      if (!firstFrame) {
        if (current.gl.getError() !== current.gl.NO_ERROR) {
          fallback({ permanent: true });
          return;
        }
        // A valid frame exists before the decorative canvas covers the SVG.
        element.append(current.canvas);
        firstFrame = true;
        element.dataset.scene = 'ready';
        element.setAttribute('data-scene-ready', 'true');
      }
    } catch {
      fallback({ permanent: true });
      return;
    }
    if (!entranceTween?.isActive() && !pointerTween?.isActive()) stopTick();
  }

  function animatePointer(x, y, strength) {
    if (!canDraw()) return;
    pointerTween?.kill();
    // Explicit ownership keeps only one pointer tween, even during a long visit.
    pointerTween = gsap.to(state, {
      pointerX: x,
      pointerY: y,
      pointerStrength: strength,
      duration: 0.55,
      ease: 'power2.out',
      onUpdate: requestFrame,
      onComplete: requestFrame
    });
    requestFrame();
  }

  function pointerMove(event) {
    if (event.pointerType === 'touch' || !canDraw()) return;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    animatePointer(
      clamp((event.clientX - rect.left) / rect.width, 0, 1) * 2 - 1,
      1 - clamp((event.clientY - rect.top) / rect.height, 0, 1) * 2,
      1
    );
  }

  function pointerLeave() {
    animatePointer(0, 0, 0);
  }

  function lightInput() {
    light = readLight();
    // The page owns the immediate SVG response; this module owns canvas uniforms.
    requestFrame();
  }

  function updateActivity() {
    if (!alive) return;
    if (!permitted()) {
      fallback();
      return;
    }
    if (!visible || document.hidden) {
      entranceTween?.pause();
      pointerTween?.kill();
      pointerTween = null;
      state.pointerX = state.pointerY = state.pointerStrength = 0;
      stopTick();
      return;
    }
    if (!resource) {
      void initialize();
      return;
    }
    entranceTween?.resume();
    pointerTween?.resume();
    measure();
    requestFrame();
  }

  async function initialize() {
    if (!permitted() || !visible || document.hidden || resource || loading || failed) return;
    loading = true;
    const ticket = ++generation;
    element.dataset.scene = 'loading';
    let canvas;
    let gl;
    let pendingRenderer;
    try {
      const THREE = await import('../vendor/three/three.module.min.js');
      if (!alive || ticket !== generation || !permitted()) return;
      canvas = document.createElement('canvas');
      canvas.className = 'material-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;border-radius:inherit;display:block;';
      // Probe before constructing Three to avoid its unsupported-backend error log.
      gl = canvas.getContext('webgl2', {
        alpha: false, antialias: false, depth: false, stencil: false,
        powerPreference: 'low-power', failIfMajorPerformanceCaveat: true
      });
      if (!gl) {
        failed = true;
        element.dataset.scene = 'fallback';
        return;
      }
      canvas.addEventListener('webglcontextlost', contextLost, false);
      const renderer = new THREE.WebGLRenderer({ canvas, context: gl, alpha: false, antialias: false, depth: false, stencil: false });
      pendingRenderer = renderer;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.NoToneMapping;
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2);
      camera.position.z = 1;
      const uniforms = {
        uResolution: { value: new THREE.Vector2(1, 1) },
        uPointer: { value: new THREE.Vector2() },
        uPointerStrength: { value: 0 },
        uLight: { value: light },
        uScroll: { value: progress },
        uEntrance: { value: hasPlayed ? 1 : 0 },
        uClay: { value: new THREE.Color('#d5b7a0') },
        uPaper: { value: new THREE.Color('#f5f1e9') },
        uSepia: { value: new THREE.Color('#583e33') }
      };
      const geometry = new THREE.PlaneGeometry(2, 2);
      const material = new THREE.ShaderMaterial({
        uniforms, vertexShader, fragmentShader,
        depthTest: false, depthWrite: false, toneMapped: false
      });
      scene.add(new THREE.Mesh(geometry, material));
      resource = { canvas, gl, renderer, scene, camera, geometry, material, uniforms, shaderFailed: false };
      pendingRenderer = null;
      renderer.debug.onShaderError = () => { if (resource) resource.shaderFailed = true; };
      state.entrance = hasPlayed ? 1 : 0;
      animationContext = gsap.context(() => {}, element);
      if (!hasPlayed) {
        hasPlayed = true;
        animationContext.add(() => {
          entranceTween = gsap.to(state, {
            entrance: 1, duration: 3.8, ease: 'sine.inOut', paused: true,
            onUpdate: requestFrame, onComplete: requestFrame
          });
        });
      }
      measure();
      updateActivity();
    } catch {
      if (alive && ticket === generation) {
        fallback({ permanent: true });
        pendingRenderer?.dispose();
        // If construction failed before resources were registered, release the probe.
        if (gl && !gl.isContextLost()) gl.getExtension('WEBGL_lose_context')?.loseContext();
        canvas?.removeEventListener('webglcontextlost', contextLost);
        canvas?.remove();
      }
    } finally {
      if (ticket === generation) loading = false;
    }
  }

  function windowResize() {
    measure();
  }

  function refreshMotion() {
    if (!alive) return;
    // A preference change can retry a previous import/backend failure explicitly.
    failed = false;
    updateActivity();
  }

  function setProgress(value) {
    if (!alive || !Number.isFinite(value)) return;
    const next = clamp(value);
    if (next === progress) return;
    progress = next;
    requestFrame();
  }

  function destroy() {
    if (!alive) return;
    alive = false;
    generation += 1;
    visibilityObserver?.disconnect();
    resizeObserver?.disconnect();
    element.removeEventListener('pointermove', pointerMove);
    element.removeEventListener('pointerleave', pointerLeave);
    lightControl?.removeEventListener('input', lightInput);
    document.removeEventListener('visibilitychange', updateActivity);
    window.removeEventListener('resize', windowResize);
    connection?.removeEventListener?.('change', refreshMotion);
    disposeResources();
    element.removeAttribute('data-scene');
    instances.delete(element);
  }

  element.dataset.scene = 'fallback';
  lightInput();
  element.addEventListener('pointermove', pointerMove, { passive: true });
  element.addEventListener('pointerleave', pointerLeave, { passive: true });
  lightControl?.addEventListener('input', lightInput, { passive: true });
  document.addEventListener('visibilitychange', updateActivity);
  window.addEventListener('resize', windowResize, { passive: true });
  connection?.addEventListener?.('change', refreshMotion);

  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(element);
  }
  if ('IntersectionObserver' in window) {
    visibilityObserver = new IntersectionObserver(([entry]) => {
      if (!alive) return;
      visible = entry.isIntersecting && entry.intersectionRatio > 0;
      updateActivity();
    }, { threshold: [0, 0.01] });
    visibilityObserver.observe(element);
  } else {
    // Older environments retain the complete SVG instead of a continuously drawn scene.
    failed = true;
  }

  const controller = { destroy, setProgress, refreshMotion };
  instances.set(element, controller);
  return controller;
}
