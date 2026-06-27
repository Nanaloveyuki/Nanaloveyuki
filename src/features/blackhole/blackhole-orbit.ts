import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { CopyShader } from 'three/examples/jsm/shaders/CopyShader.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { Observer } from '@blackhole/core/observer';
import {
  blackholeFragmentShader,
  blackholeVertexShader,
  getBlackholeShaderDefines,
} from '@blackhole/shaders/blackholeBackground';
import {
  BLACKHOLE_BODY_CLASS,
  HEADER_SELECTOR,
  HOST_SELECTOR,
  PAGE_SELECTOR,
} from '@blackhole/types';
import type { BlackholeWindow, OrbitSceneTarget, SceneName } from '@blackhole/types';
import { clamp, smoothstep } from '@blackhole/math';

const getSceneName = (): SceneName => {
  const page = document.querySelector<HTMLElement>(PAGE_SELECTOR);
  return (page?.dataset.blackholeScene as SceneName | undefined) ?? 'projects';
};

export const bootBlackholeOrbit = () => {
  const blackholeWindow = window as BlackholeWindow;
  if (
    blackholeWindow.__BLACKHOLE_RUNTIME_MODE__ &&
    blackholeWindow.__BLACKHOLE_RUNTIME_MODE__ !== 'orbit'
  ) {
    blackholeWindow.__BLACKHOLE_DISPOSE__?.();
  }

  const host = document.querySelector<HTMLElement>(HOST_SELECTOR);
  if (!host) {
    blackholeWindow.__BLACKHOLE_DEMO_INITIALIZED__ = false;
    blackholeWindow.__BLACKHOLE_DEMO_HOST__ = null;
    blackholeWindow.__BLACKHOLE_RUNTIME_MODE__ = null;
    blackholeWindow.__BLACKHOLE_DISPOSE__ = undefined;
    return;
  }

  const canvasMount = host.querySelector<HTMLElement>('[data-blackhole-canvas]');
  if (!canvasMount) {
    throw new Error('Missing blackhole orbit mount point');
  }

  const existingCanvas = host.querySelector('canvas');
  if (
    blackholeWindow.__BLACKHOLE_RUNTIME_MODE__ === 'orbit' &&
    blackholeWindow.__BLACKHOLE_DEMO_HOST__ === host &&
    existingCanvas
  ) {
    blackholeWindow.__BLACKHOLE_DEMO_REFRESH__?.();
    return;
  }

  blackholeWindow.__BLACKHOLE_DISPOSE__?.();
  blackholeWindow.__BLACKHOLE_DEMO_INITIALIZED__ = true;
  blackholeWindow.__BLACKHOLE_DEMO_HOST__ = host;
  blackholeWindow.__BLACKHOLE_RUNTIME_MODE__ = 'orbit';

  let siteHeader = document.querySelector<HTMLElement>(HEADER_SELECTOR);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x000000, 1.0);
  renderer.autoClear = false;
  canvasMount.append(renderer.domElement);

  const scene = new THREE.Scene();
  const screenCamera = new THREE.Camera();
  screenCamera.position.z = 1;

  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, screenCamera);
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(128, 128), 0.75, 0.45, 0.68);
  const shaderPass = new ShaderPass(CopyShader);
  shaderPass.renderToScreen = true;
  composer.addPass(renderPass);
  composer.addPass(bloomPass);
  composer.addPass(shaderPass);

  const textureLoader = new THREE.TextureLoader();
  const textures = new Map<string, THREE.Texture | null>();
  const observer = new Observer(68, 1, 0.1, 2000);
  observer.position.set(0, 0, 2.74);
  observer.up.set(0, 1, 0);
  const origin = new THREE.Vector3(0, 0, 0);

  const material = new THREE.ShaderMaterial({
    fragmentShader: `${getBlackholeShaderDefines('low')}${blackholeFragmentShader}`,
    vertexShader: blackholeVertexShader,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      time: { value: 0 },
      resolution: { value: new THREE.Vector2(1, 1) },
      cam_pos: { value: observer.position.clone() },
      cam_dir: { value: new THREE.Vector3(0, 0, -1) },
      cam_up: { value: observer.up.clone() },
      fov: { value: observer.fov },
      cam_vel: { value: new THREE.Vector3(0, 0, 0) },
      accretion_disk: { value: true },
      use_disk_texture: { value: true },
      doppler_shift: { value: true },
      lorentz_transform: { value: true },
      beaming: { value: true },
      bg_texture: { value: null },
      star_texture: { value: null },
      disk_texture: { value: null },
    },
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(mesh);

  const state = {
    time: 0,
    rafId: 0,
    lastFrame: 0,
    renderPaused: false,
    scrollProgress: 0,
    lastScrollY: window.scrollY,
    headerPinned: true,
    resolutionScale: 0.85,
  };

  const loadTexture = (
    name: string,
    url: string,
    magFilter: THREE.MagnificationTextureFilter,
    minFilter: THREE.MinificationTextureFilter,
  ) =>
    new Promise<void>((resolve, reject) => {
      textures.set(name, null);
      textureLoader.load(
        url,
        (texture) => {
          texture.magFilter = magFilter;
          texture.minFilter = minFilter;
          texture.wrapS = THREE.ClampToEdgeWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          textures.set(name, texture);
          resolve();
        },
        undefined,
        reject,
      );
    });

  const getSceneTarget = (sceneName: SceneName): OrbitSceneTarget => {
    if (sceneName === 'blog') {
      return {
        distance: 7.2,
        fov: 58,
        autoYaw: Math.PI,
        autoPitch: -0.04,
        driftAmplitude: 0.015,
        starYawSpeed: 0.015,
        bloomStrength: 0.52,
        bloomRadius: 0.4,
        bloomThreshold: 0.72,
      };
    }

    return {
      distance: 2.74,
      fov: 78,
      autoYaw: 1.82,
      autoPitch: 0.005,
      driftAmplitude: 0.035,
      starYawSpeed: 0.006,
      bloomStrength: 0.78,
      bloomRadius: 0.46,
      bloomThreshold: 0.66,
    };
  };

  const setDemoSize = () => {
    const width = Math.max(canvasMount.clientWidth, 1);
    const height = Math.max(canvasMount.clientHeight, 1);
    const pixelRatio = Math.min(window.devicePixelRatio, 1.8) * state.resolutionScale;

    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    material.uniforms.resolution.value.set(width * pixelRatio, height * pixelRatio);
  };

  const syncScrollState = () => {
    const currentScrollY = window.scrollY;
    const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    state.scrollProgress = clamp(currentScrollY / maxScroll, 0, 1);

    if (siteHeader) {
      const deltaY = currentScrollY - state.lastScrollY;
      if (currentScrollY < 24 || deltaY < -4) {
        state.headerPinned = true;
      } else if (deltaY > 6 && currentScrollY > 120) {
        state.headerPinned = false;
      }

      siteHeader.classList.toggle('is-hidden', !state.headerPinned);
      state.lastScrollY = currentScrollY;
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!siteHeader) return;

    if (event.clientY <= 64) {
      state.headerPinned = true;
      siteHeader.classList.remove('is-hidden');
    }
  };

  const refreshPageBindings = () => {
    if (!document.body.classList.contains(BLACKHOLE_BODY_CLASS)) {
      document.body.classList.add(BLACKHOLE_BODY_CLASS);
    }

    siteHeader = document.querySelector<HTMLElement>(HEADER_SELECTOR);
    syncScrollState();
    setDemoSize();
  };

  const pauseRendering = () => {
    if (state.renderPaused) return;
    state.renderPaused = true;
    window.cancelAnimationFrame(state.rafId);
    state.rafId = 0;
  };

  const resumeRendering = () => {
    if (!state.renderPaused) return;
    state.renderPaused = false;
    state.lastFrame = 0;
    state.rafId = window.requestAnimationFrame(tick);
  };

  const onVisibilityChange = () => {
    if (document.hidden) {
      pauseRendering();
      return;
    }

    resumeRendering();
  };

  const updateCamera = (delta: number) => {
    const sceneName = getSceneName();
    const target = getSceneTarget(sceneName);
    const blend = clamp(1 - Math.exp(-delta * 3.6), 0.04, 0.18);
    const orbitProgress = smoothstep(0, 1, state.scrollProgress);
    const autoYaw = target.autoYaw + orbitProgress * 0.42;
    const autoPitch = target.autoPitch + Math.sin(state.time * 0.11) * 0.015;
    const starYawOffset = state.time * target.starYawSpeed;
    const distance = THREE.MathUtils.lerp(
      target.distance,
      target.distance + (sceneName === 'blog' ? 0.5 : 0.24),
      orbitProgress * 0.45,
    );
    const driftOffset = Math.sin(state.time * 0.18) * target.driftAmplitude;

    observer.fov = THREE.MathUtils.lerp(observer.fov, target.fov, blend);
    observer.distance = distance;
    observer.moving = true;
    observer.update(delta);

    const orbitUpAxis = new THREE.Vector3(0, 1, 0);
    const rotatedPosition = observer.position.clone();
    const orbitYawQuaternion = new THREE.Quaternion().setFromAxisAngle(orbitUpAxis, autoYaw);
    rotatedPosition.applyQuaternion(orbitYawQuaternion);

    const orbitPitchAxis = new THREE.Vector3()
      .crossVectors(orbitUpAxis, rotatedPosition)
      .normalize();
    let orbitPitchQuaternion: THREE.Quaternion | null = null;
    if (orbitPitchAxis.lengthSq() > 0) {
      orbitPitchQuaternion = new THREE.Quaternion().setFromAxisAngle(orbitPitchAxis, autoPitch);
      rotatedPosition.applyQuaternion(orbitPitchQuaternion);
    }

    observer.position.copy(rotatedPosition);
    observer.up.copy(orbitUpAxis).applyQuaternion(orbitYawQuaternion);
    if (orbitPitchQuaternion) {
      observer.up.applyQuaternion(orbitPitchQuaternion);
    }

    const upVector = observer.up.clone().normalize();
    const baseForward = origin.clone().sub(observer.position).normalize();
    const right = new THREE.Vector3().crossVectors(baseForward, upVector).normalize();
    observer.position.addScaledVector(right, driftOffset);

    const lookTarget = origin.clone();
    if (sceneName !== 'blog') {
      lookTarget.addScaledVector(baseForward, 0.08);
      lookTarget.addScaledVector(right, 1.72 + driftOffset);
    } else {
      lookTarget.addScaledVector(baseForward, -18);
      lookTarget.addScaledVector(upVector, 0.18);
      lookTarget.z = -18;
    }

    const lookDirection = lookTarget.sub(observer.position);
    const yawQuaternion = new THREE.Quaternion().setFromAxisAngle(upVector, starYawOffset);
    const rotatedLookTarget = lookDirection.applyQuaternion(yawQuaternion).normalize();
    const cameraLookTarget = observer.position.clone().add(rotatedLookTarget);

    observer.lookAt(cameraLookTarget);
    observer.updateMatrixWorld();

    material.uniforms.cam_pos.value.copy(observer.position);
    material.uniforms.cam_dir.value.copy(rotatedLookTarget);
    material.uniforms.cam_up.value.copy(observer.up);
    material.uniforms.cam_vel.value.set(0, 0, 0);
    material.uniforms.fov.value = observer.fov;

    bloomPass.strength = THREE.MathUtils.lerp(bloomPass.strength, target.bloomStrength, blend);
    bloomPass.radius = THREE.MathUtils.lerp(bloomPass.radius, target.bloomRadius, blend);
    bloomPass.threshold = THREE.MathUtils.lerp(bloomPass.threshold, target.bloomThreshold, blend);
  };

  const tick = (timestamp: number) => {
    if (!state.lastFrame) {
      state.lastFrame = timestamp;
    }

    const delta = Math.min((timestamp - state.lastFrame) / 1000, 0.05);
    state.lastFrame = timestamp;
    state.time += delta;

    material.uniforms.time.value = state.time;
    material.uniforms.bg_texture.value = textures.get('bg1') ?? null;
    material.uniforms.star_texture.value = textures.get('star') ?? null;
    material.uniforms.disk_texture.value = textures.get('disk') ?? null;
    updateCamera(delta);
    composer.render();
    state.rafId = window.requestAnimationFrame(tick);
  };

  const resizeObserver = new ResizeObserver(setDemoSize);
  resizeObserver.observe(canvasMount);

  blackholeWindow.__BLACKHOLE_DEMO_REFRESH__ = refreshPageBindings;

  void Promise.all([
    loadTexture(
      'bg1',
      `${import.meta.env.BASE_URL}blackhole/milkyway.jpg`,
      THREE.NearestFilter,
      THREE.NearestFilter,
    ),
    loadTexture(
      'star',
      `${import.meta.env.BASE_URL}blackhole/star_noise.png`,
      THREE.LinearFilter,
      THREE.LinearFilter,
    ),
    loadTexture(
      'disk',
      `${import.meta.env.BASE_URL}blackhole/accretion_disk.png`,
      THREE.LinearFilter,
      THREE.LinearFilter,
    ),
  ]).then(() => {
    refreshPageBindings();
    state.rafId = window.requestAnimationFrame(tick);
  });

  document.addEventListener('visibilitychange', onVisibilityChange);
  document.addEventListener('astro:page-load', refreshPageBindings);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('scroll', syncScrollState, { passive: true });
  window.addEventListener('resize', setDemoSize);

  let disposed = false;
  const dispose = () => {
    if (disposed) {
      return;
    }

    disposed = true;
    window.cancelAnimationFrame(state.rafId);
    resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', onVisibilityChange);
    document.removeEventListener('astro:page-load', refreshPageBindings);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('scroll', syncScrollState);
    window.removeEventListener('resize', setDemoSize);
    renderer.dispose();
    mesh.geometry.dispose();
    material.dispose();
    textures.forEach((texture) => texture?.dispose());
    if (renderer.domElement.parentElement === canvasMount) {
      canvasMount.removeChild(renderer.domElement);
    }
    blackholeWindow.__BLACKHOLE_DEMO_INITIALIZED__ = false;
    blackholeWindow.__BLACKHOLE_DEMO_REFRESH__ = undefined;
    blackholeWindow.__BLACKHOLE_DEMO_HOST__ = null;
    blackholeWindow.__BLACKHOLE_RUNTIME_MODE__ = null;
    blackholeWindow.__BLACKHOLE_DISPOSE__ = undefined;
  };

  blackholeWindow.__BLACKHOLE_DISPOSE__ = dispose;
  window.addEventListener('pagehide', dispose, { once: true });
};
