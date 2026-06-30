import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { CopyShader } from 'three/examples/jsm/shaders/CopyShader.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { CameraDragControls, KeyboardMoveControls } from '@blackhole/core/controls';
import { Observer } from '@blackhole/core/observer';
import { getBlackholeSceneTarget } from '@blackhole/scenes/homeSceneMath';
import { createHomePresentationController } from '@blackhole/scenes/homePresentationController';
import { createBodyDomBridge } from '@blackhole/systems/bodies/bodyDomBridge';
import { createOrbitPresentationController } from '@blackhole/scenes/orbitPresentationController';
import { createBodyInteractionController } from '@blackhole/systems/bodies/bodyInteractionController';
import { createBodySystem } from '@blackhole/systems/bodies/bodySystem';
import { adaptBodySourcesToBodyDefinitions } from '@blackhole/systems/bodies/bodyFactories';
import {
  BLACKHOLE_BODY_CLASS,
  BODY_PANEL_CLOSE_SELECTOR,
  BODY_PANEL_SELECTOR,
  FRIEND_TOOLTIP_SELECTOR,
  HEADER_SELECTOR,
  HOST_SELECTOR,
  NIGHT_WARNING_CONFIRM_SELECTOR,
  NIGHT_WARNING_SELECTOR,
  PAGE_SELECTOR,
  SCROLL_TRACK_SELECTOR,
} from '@blackhole/types';
import type {
  BodyPanelElements,
  BodySource,
  BodySourceSetMap,
  BodyTooltipElements,
  BlackholeWindow,
  PerformanceConfig,
  SceneName,
} from '@blackhole/types';
import type { BodyPresentationSource } from '@blackhole/systems/bodies/bodyPresentation';
import type { BodyDefinition } from '@blackhole/systems/bodies/bodyTypes';
import {
  blackholeFragmentShader,
  blackholeVertexShader,
  getBlackholeShaderDefines,
} from '@blackhole/shaders/blackholeBackground';
import {
  clamp,
  DEFAULT_PERFORMANCE_CONFIG,
  getMeasuredPerformanceTarget,
  smoothstep,
} from '@blackhole/math';

export const bootBlackholeDemo = () => {
  const BODY_SET_QUERY_KEYS = ['bodySet', 'body-set'] as const;

  const resolveRequestedBodySourceSetKey = () => {
    const searchParams = new URLSearchParams(window.location.search);

    for (const queryKey of BODY_SET_QUERY_KEYS) {
      const queryValue = searchParams.get(queryKey)?.trim();
      if (queryValue) {
        return queryValue;
      }
    }

    return null;
  };

  const resolvePreloadedBodySources = (
    bodySources: BodySource[] | undefined,
    bodySourceSets: BodySourceSetMap | undefined,
    defaultSetKey: string,
  ) => {
    const requestedSetKey = resolveRequestedBodySourceSetKey();

    if (requestedSetKey && bodySourceSets) {
      const requestedSources = bodySourceSets[requestedSetKey];
      if (Array.isArray(requestedSources) && requestedSources.length > 0) {
        return {
          bodySources: requestedSources,
          bodySetKey: requestedSetKey,
        };
      }
    }

    if (Array.isArray(bodySources)) {
      return {
        bodySources,
        bodySetKey: defaultSetKey,
      };
    }

    if (bodySourceSets) {
      const fallbackSources = bodySourceSets[defaultSetKey];
      if (Array.isArray(fallbackSources)) {
        return {
          bodySources: fallbackSources,
          bodySetKey: defaultSetKey,
        };
      }
    }

    throw new Error('Missing preloaded body sources');
  };

  const blackholeWindow = window as BlackholeWindow;
  const defaultBodySourceSetKey =
    blackholeWindow.__BLACKHOLE_DEFAULT_BODY_SOURCE_SET__ ?? 'default';
  if (
    blackholeWindow.__BLACKHOLE_RUNTIME_MODE__ &&
    blackholeWindow.__BLACKHOLE_RUNTIME_MODE__ !== 'home'
  ) {
    blackholeWindow.__BLACKHOLE_DISPOSE__?.();
  }

  const host = document.querySelector<HTMLElement>(HOST_SELECTOR);

  if (!host) {
    blackholeWindow.__BLACKHOLE_ACTIVE_BODY_SOURCE_SET__ = null;
    blackholeWindow.__BLACKHOLE_DEMO_INITIALIZED__ = false;
    blackholeWindow.__BLACKHOLE_DEMO_HOST__ = null;
    return;
  }

  const selectedBodySourceSet = resolvePreloadedBodySources(
    blackholeWindow.__BLACKHOLE_BODY_SOURCES__,
    blackholeWindow.__BLACKHOLE_BODY_SOURCE_SETS__,
    defaultBodySourceSetKey,
  );

  const canvasAlreadyMounted = !!host.querySelector('canvas');
  const bodySourceSetChanged =
    blackholeWindow.__BLACKHOLE_ACTIVE_BODY_SOURCE_SET__ !== selectedBodySourceSet.bodySetKey;

  if (
    blackholeWindow.__BLACKHOLE_DEMO_INITIALIZED__ &&
    blackholeWindow.__BLACKHOLE_DEMO_HOST__ === host &&
    canvasAlreadyMounted &&
    !bodySourceSetChanged
  ) {
    blackholeWindow.__BLACKHOLE_DEMO_REFRESH__?.();
    return;
  }

  if (
    blackholeWindow.__BLACKHOLE_DEMO_INITIALIZED__ &&
    blackholeWindow.__BLACKHOLE_DEMO_HOST__ === host &&
    canvasAlreadyMounted &&
    bodySourceSetChanged
  ) {
    blackholeWindow.__BLACKHOLE_DISPOSE__?.();
  }

  blackholeWindow.__BLACKHOLE_DEMO_INITIALIZED__ = true;
  blackholeWindow.__BLACKHOLE_DEMO_HOST__ = host;
  blackholeWindow.__BLACKHOLE_RUNTIME_MODE__ = 'home';
  blackholeWindow.__BLACKHOLE_ACTIVE_BODY_SOURCE_SET__ = selectedBodySourceSet.bodySetKey;

  const canvasMount = host.querySelector<HTMLElement>('[data-blackhole-canvas]');
  let pageHost = document.querySelector<HTMLElement>(PAGE_SELECTOR);
  let scrollTrack = pageHost?.querySelector<HTMLElement>(SCROLL_TRACK_SELECTOR) ?? null;
  let siteHeader = document.querySelector<HTMLElement>(HEADER_SELECTOR);
  const nightWarning = document.querySelector<HTMLElement>(NIGHT_WARNING_SELECTOR);
  const nightWarningConfirm = nightWarning?.querySelector<HTMLButtonElement>(
    NIGHT_WARNING_CONFIRM_SELECTOR,
  );
  const friendTooltip = document.querySelector<HTMLElement>(FRIEND_TOOLTIP_SELECTOR);
  const friendTooltipName = friendTooltip?.querySelector<HTMLElement>(
    '[data-blackhole-friend-tooltip-name]',
  );
  const bodySetDebug = document.querySelector<HTMLElement>('[data-blackhole-body-set-debug]');
  const bodySetDebugValue = bodySetDebug?.querySelector<HTMLElement>(
    '[data-blackhole-body-set-debug-value]',
  );
  const bodySetDebugCount = bodySetDebug?.querySelector<HTMLElement>(
    '[data-blackhole-body-set-debug-count]',
  );
  const bodyTooltipElements: BodyTooltipElements = {
    root: friendTooltip ?? null,
    name: friendTooltipName ?? null,
  };
  const bodyPanel = document.querySelector<HTMLElement>(BODY_PANEL_SELECTOR);
  const bodyPanelClose = bodyPanel?.querySelector<HTMLButtonElement>(BODY_PANEL_CLOSE_SELECTOR);
  const bodyPanelType = bodyPanel?.querySelector<HTMLElement>('[data-blackhole-body-panel-type]');
  const bodyPanelName = bodyPanel?.querySelector<HTMLElement>('[data-blackhole-body-panel-name]');
  const bodyPanelDescription = bodyPanel?.querySelector<HTMLElement>(
    '[data-blackhole-body-panel-description]',
  );
  const bodyPanelPreview = bodyPanel?.querySelector<HTMLElement>(
    '[data-blackhole-body-panel-preview]',
  );
  const bodyPanelPreviewAtmosphere = bodyPanel?.querySelector<HTMLElement>(
    '[data-blackhole-body-panel-preview-atmosphere]',
  );
  const bodyPanelPreviewPlanet = bodyPanel?.querySelector<HTMLElement>(
    '[data-blackhole-body-panel-preview-planet]',
  );
  const bodyPanelPreviewWater = bodyPanel?.querySelector<HTMLElement>(
    '[data-blackhole-body-panel-preview-water]',
  );
  const bodyPanelPreviewLand = bodyPanel?.querySelector<HTMLElement>(
    '[data-blackhole-body-panel-preview-land]',
  );
  const bodyPanelPreviewClouds = bodyPanel?.querySelector<HTMLElement>(
    '[data-blackhole-body-panel-preview-clouds]',
  );
  const bodyPanelPreviewEquator = bodyPanel?.querySelector<HTMLElement>(
    '[data-blackhole-body-panel-preview-equator]',
  );
  const bodyPanelPreviewPoleNorth = bodyPanel?.querySelector<HTMLElement>(
    '[data-blackhole-body-panel-preview-pole-north]',
  );
  const bodyPanelPreviewPoleSouth = bodyPanel?.querySelector<HTMLElement>(
    '[data-blackhole-body-panel-preview-pole-south]',
  );
  const bodyPanelPreviewRing = bodyPanel?.querySelector<HTMLElement>(
    '[data-blackhole-body-panel-preview-ring]',
  );
  const bodyPanelPreviewCopy = bodyPanel?.querySelector<HTMLElement>(
    '[data-blackhole-body-panel-preview-copy]',
  );
  const bodyPanelLink = bodyPanel?.querySelector<HTMLAnchorElement>(
    '[data-blackhole-body-panel-link]',
  );
  const bodyPanelStatType = bodyPanel?.querySelector<HTMLElement>(
    '[data-blackhole-body-panel-stat-type]',
  );
  const bodyPanelStatRadius = bodyPanel?.querySelector<HTMLElement>(
    '[data-blackhole-body-panel-stat-radius]',
  );
  const bodyPanelStatTemperature = bodyPanel?.querySelector<HTMLElement>(
    '[data-blackhole-body-panel-stat-temperature]',
  );
  const bodyPanelStatAtmosphere = bodyPanel?.querySelector<HTMLElement>(
    '[data-blackhole-body-panel-stat-atmosphere]',
  );
  const bodyPanelStatOrbit = bodyPanel?.querySelector<HTMLElement>(
    '[data-blackhole-body-panel-stat-orbit]',
  );
  const bodyPanelStatOrbitParent = bodyPanel?.querySelector<HTMLElement>(
    '[data-blackhole-body-panel-stat-orbit-parent]',
  );
  const bodyPanelStatOrbitSource = bodyPanel?.querySelector<HTMLElement>(
    '[data-blackhole-body-panel-stat-orbit-source]',
  );
  const bodyPanelStatHierarchy = bodyPanel?.querySelector<HTMLElement>(
    '[data-blackhole-body-panel-stat-hierarchy]',
  );
  const bodyPanelStatWeight = bodyPanel?.querySelector<HTMLElement>(
    '[data-blackhole-body-panel-stat-weight]',
  );
  const bodyPanelStatDensity = bodyPanel?.querySelector<HTMLElement>(
    '[data-blackhole-body-panel-stat-density]',
  );
  const bodyPanelStatGravity = bodyPanel?.querySelector<HTMLElement>(
    '[data-blackhole-body-panel-stat-gravity]',
  );
  const bodyPanelStatPhysics = bodyPanel?.querySelector<HTMLElement>(
    '[data-blackhole-body-panel-stat-physics]',
  );
  const bodyPanelStatScaleRadius = bodyPanel?.querySelector<HTMLElement>(
    '[data-blackhole-body-panel-stat-scale-radius]',
  );
  const bodyPanelStatScaleOrbit = bodyPanel?.querySelector<HTMLElement>(
    '[data-blackhole-body-panel-stat-scale-orbit]',
  );
  const bodyPanelStatScaleMotion = bodyPanel?.querySelector<HTMLElement>(
    '[data-blackhole-body-panel-stat-scale-motion]',
  );
  const bodyPanelStatInputState = bodyPanel?.querySelector<HTMLElement>(
    '[data-blackhole-body-panel-stat-input-state]',
  );
  const bodyPanelStatDerivedState = bodyPanel?.querySelector<HTMLElement>(
    '[data-blackhole-body-panel-stat-derived-state]',
  );
  const bodyPanelStatRotation = bodyPanel?.querySelector<HTMLElement>(
    '[data-blackhole-body-panel-stat-rotation]',
  );
  const bodyPanelStatTilt = bodyPanel?.querySelector<HTMLElement>(
    '[data-blackhole-body-panel-stat-tilt]',
  );
  const bodyPanelStatPoles = bodyPanel?.querySelector<HTMLElement>(
    '[data-blackhole-body-panel-stat-poles]',
  );
  const bodyPanelStatEquator = bodyPanel?.querySelector<HTMLElement>(
    '[data-blackhole-body-panel-stat-equator]',
  );
  const bodyPanelStatClouds = bodyPanel?.querySelector<HTMLElement>(
    '[data-blackhole-body-panel-stat-clouds]',
  );
  const bodyPanelStatSurface = bodyPanel?.querySelector<HTMLElement>(
    '[data-blackhole-body-panel-stat-surface]',
  );
  const bodyPanelElements: BodyPanelElements = {
    panel: bodyPanel ?? null,
    close: bodyPanelClose ?? null,
    type: bodyPanelType ?? null,
    name: bodyPanelName ?? null,
    description: bodyPanelDescription ?? null,
    preview: bodyPanelPreview ?? null,
    previewAtmosphere: bodyPanelPreviewAtmosphere ?? null,
    previewPlanet: bodyPanelPreviewPlanet ?? null,
    previewWater: bodyPanelPreviewWater ?? null,
    previewLand: bodyPanelPreviewLand ?? null,
    previewClouds: bodyPanelPreviewClouds ?? null,
    previewEquator: bodyPanelPreviewEquator ?? null,
    previewPoleNorth: bodyPanelPreviewPoleNorth ?? null,
    previewPoleSouth: bodyPanelPreviewPoleSouth ?? null,
    previewRing: bodyPanelPreviewRing ?? null,
    previewCopy: bodyPanelPreviewCopy ?? null,
    link: bodyPanelLink ?? null,
    statType: bodyPanelStatType ?? null,
    statRadius: bodyPanelStatRadius ?? null,
    statTemperature: bodyPanelStatTemperature ?? null,
    statAtmosphere: bodyPanelStatAtmosphere ?? null,
    statOrbit: bodyPanelStatOrbit ?? null,
    statOrbitParent: bodyPanelStatOrbitParent ?? null,
    statOrbitSource: bodyPanelStatOrbitSource ?? null,
    statHierarchy: bodyPanelStatHierarchy ?? null,
    statWeight: bodyPanelStatWeight ?? null,
    statDensity: bodyPanelStatDensity ?? null,
    statGravity: bodyPanelStatGravity ?? null,
    statPhysics: bodyPanelStatPhysics ?? null,
    statScaleRadius: bodyPanelStatScaleRadius ?? null,
    statScaleOrbit: bodyPanelStatScaleOrbit ?? null,
    statScaleMotion: bodyPanelStatScaleMotion ?? null,
    statInputState: bodyPanelStatInputState ?? null,
    statDerivedState: bodyPanelStatDerivedState ?? null,
    statRotation: bodyPanelStatRotation ?? null,
    statTilt: bodyPanelStatTilt ?? null,
    statPoles: bodyPanelStatPoles ?? null,
    statEquator: bodyPanelStatEquator ?? null,
    statClouds: bodyPanelStatClouds ?? null,
    statSurface: bodyPanelStatSurface ?? null,
  };
  const bodyDomBridge = createBodyDomBridge({
    panel: bodyPanelElements,
    tooltip: bodyTooltipElements,
  });

  if (!canvasMount) {
    throw new Error('Missing blackhole demo mount points');
  }

  const syncBodySourceSetDebug = () => {
    document.body.dataset.blackholeBodySourceSet = selectedBodySourceSet.bodySetKey;

    if (!bodySetDebug) {
      return;
    }

    const isDefaultBodySet = selectedBodySourceSet.bodySetKey === defaultBodySourceSetKey;
    bodySetDebug.hidden = isDefaultBodySet;

    if (bodySetDebugValue) {
      bodySetDebugValue.textContent = selectedBodySourceSet.bodySetKey;
    }

    if (bodySetDebugCount) {
      const bodyCount = selectedBodySourceSet.bodySources.length;
      bodySetDebugCount.textContent = `${bodyCount} bod${bodyCount === 1 ? 'y' : 'ies'}`;
    }
  };

  syncBodySourceSetDebug();

  blackholeWindow.__BLACKHOLE_DEMO_REFRESH__ = () => {
    pageHost = document.querySelector<HTMLElement>(PAGE_SELECTOR);
    scrollTrack = pageHost?.querySelector<HTMLElement>(SCROLL_TRACK_SELECTOR) ?? null;
    siteHeader = document.querySelector<HTMLElement>(HEADER_SELECTOR);
    syncBodySourceSetDebug();
    setDemoSize();
  };

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setClearColor(0x000000, 1.0);
  renderer.autoClear = false;
  canvasMount.append(renderer.domElement);

  const scene = new THREE.Scene();
  const overlayScene = new THREE.Scene();
  const orbitScene = new THREE.Scene();
  const screenCamera = new THREE.Camera();
  screenCamera.position.z = 1;

  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, screenCamera);
  const overlayRenderPass = new RenderPass(overlayScene, screenCamera);
  overlayRenderPass.clear = false;
  const orbitRenderPass = new RenderPass(orbitScene, screenCamera);
  orbitRenderPass.clear = false;
  orbitRenderPass.clearDepth = true;
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(128, 128), 1.0, 0.5, 0.6);
  const shaderPass = new ShaderPass(CopyShader);
  shaderPass.renderToScreen = true;
  composer.addPass(renderPass);
  composer.addPass(overlayRenderPass);
  composer.addPass(orbitRenderPass);
  composer.addPass(bloomPass);
  composer.addPass(shaderPass);

  const textureLoader = new THREE.TextureLoader();
  const textures = new Map<string, THREE.Texture | null>();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const bodySystem = createBodySystem(overlayScene, orbitScene);
  const { orbitGroup } = bodySystem;

  const bodyEntries = bodySystem.bodyEntries;
  const clickableBodies = bodySystem.clickableBodies;
  let hoveredBodyPresentation: BodyPresentationSource | null = null;
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
          texture.wrapT = THREE.ClampToEdgeWrapping;
          texture.wrapS = THREE.ClampToEdgeWrapping;
          textures.set(name, texture);
          resolve();
        },
        undefined,
        reject,
      );
    });

  const loadPreloadedBodySources = async (): Promise<BodySource[]> => {
    return selectedBodySourceSet.bodySources;
  };

  const loadPreloadedBodyDefinitions = async (): Promise<BodyDefinition[]> => {
    const preloadedBodySources = await loadPreloadedBodySources();
    return adaptBodySourcesToBodyDefinitions(preloadedBodySources);
  };

  const getBodyEntryByMesh = (mesh?: THREE.Mesh) => bodySystem.getEntryByMesh(mesh);

  const isPointerInsideBlackholeViewport = (clientX: number, clientY: number) => {
    const bounds = renderer.domElement.getBoundingClientRect();

    return (
      clientX >= bounds.left &&
      clientX <= bounds.right &&
      clientY >= bounds.top &&
      clientY <= bounds.bottom
    );
  };

  const isInteractiveUiTarget = (target: EventTarget | null) =>
    target instanceof Element &&
    Boolean(
      target.closest(
        'a, button, input, textarea, select, summary, .site-header, .site-footer, [data-blackhole-body-panel], [data-blackhole-night-warning]',
      ),
    );

  const syncPointerFromClientPosition = (clientX: number, clientY: number) => {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((clientY - bounds.top) / bounds.height) * 2 + 1;
  };

  const buildBodySystem = async () => {
    const bodyDefinitions = await loadPreloadedBodyDefinitions();
    bodySystem.buildBodies(bodyDefinitions);
  };

  const performanceConfig = { ...DEFAULT_PERFORMANCE_CONFIG };

  const bloomConfig = {
    strength: 0.78,
    radius: 0.34,
    threshold: 0.72,
  };

  const cameraConfig = {
    distance: 10,
    orbit: true,
    fov: 90.0,
  };

  const effectConfig = {
    lorentz_transform: true,
    accretion_disk: true,
    use_disk_texture: true,
    doppler_shift: true,
    beaming: true,
  };

  const uniforms = {
    time: { value: 0.0 },
    resolution: { value: new THREE.Vector2() },
    accretion_disk: { value: false },
    use_disk_texture: { value: true },
    lorentz_transform: { value: false },
    doppler_shift: { value: false },
    beaming: { value: false },
    cam_pos: { value: new THREE.Vector3() },
    cam_vel: { value: new THREE.Vector3() },
    cam_dir: { value: new THREE.Vector3() },
    cam_up: { value: new THREE.Vector3() },
    fov: { value: 0.0 },
    bg_texture: { value: null as THREE.Texture | null },
    star_texture: { value: null as THREE.Texture | null },
    disk_texture: { value: null as THREE.Texture | null },
  };

  let material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: blackholeVertexShader,
    fragmentShader: `${getBlackholeShaderDefines(performanceConfig.quality)}${blackholeFragmentShader}`,
    depthTest: false,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(mesh);

  const blackholeOccluder = new THREE.Mesh(
    new THREE.SphereGeometry(1.03, 48, 48),
    new THREE.MeshBasicMaterial({ color: 0x000000 }),
  );
  blackholeOccluder.material.colorWrite = false;
  blackholeOccluder.renderOrder = 0;
  blackholeOccluder.frustumCulled = false;
  orbitScene.add(blackholeOccluder);

  const observer = new Observer(60.0, 1, 1, 80000);
  observer.distance = cameraConfig.distance;
  observer.moving = cameraConfig.orbit;
  observer.fov = cameraConfig.fov;
  observer.up.applyMatrix4(new THREE.Matrix4().makeRotationZ(observer.incline));
  scene.add(observer);
  const observerBaseUp = observer.up.clone();
  const homeBaseDirection = observer.position.clone().normalize();
  const homePresentationController = createHomePresentationController();
  const orbitPresentationController = createOrbitPresentationController();

  const cameraControl = new CameraDragControls(renderer.domElement);
  const keyboardMoveControl = new KeyboardMoveControls();
  const getSceneName = () => (pageHost?.dataset.blackholeScene as SceneName | undefined) ?? 'home';

  const state = {
    lastFrame: 0,
    time: 0,
    rafId: 0,
    renderPaused: false,
    scrollProgress: 0,
    readabilityMix: 0,
    lastScrollY: window.scrollY,
    headerPinned: true,
    performanceSampleTime: 0,
    performanceSampleFrames: 0,
    performanceSettled: false,
    detailResolutionBoost: 1,
  };
  const origin = new THREE.Vector3(0, 0, 0);
  const worldUp = new THREE.Vector3(0, 1, 0);
  const moveAnchor = new THREE.Vector3(0, 0, 0);
  const initialHomeForward = origin.clone().sub(observer.position).normalize();
  cameraControl.yaw = Math.atan2(initialHomeForward.x, -initialHomeForward.z);
  cameraControl.pitch = Math.asin(clamp(initialHomeForward.y, -1, 1));

  const setDemoSize = () => {
    const width = Math.max(canvasMount.clientWidth, 1);
    const height = Math.max(canvasMount.clientHeight, 1);
    const resolutionScale = performanceConfig.resolution * state.detailResolutionBoost;
    renderer.setPixelRatio(window.devicePixelRatio * resolutionScale);
    renderer.setSize(width, height, false);
    composer.setSize(width * resolutionScale, height * resolutionScale);
    observer.aspect = width / height;
    observer.updateProjectionMatrix();

    uniforms.resolution.value.set(width * resolutionScale, height * resolutionScale);
  };
  const bodyInteractionController = createBodyInteractionController({
    bodyDomBridge,
    keyboardMoveControl,
    observer,
    performanceConfig,
    getSceneName,
    getDetailResolutionBoost: () => state.detailResolutionBoost,
    setDetailResolutionBoost: (boost) => {
      state.detailResolutionBoost = boost;
    },
    onDetailResolutionBoostChange: setDemoSize,
  });

  const applyPerformanceConfig = (nextConfig: PerformanceConfig) => {
    const qualityChanged = performanceConfig.quality !== nextConfig.quality;
    const resolutionChanged = performanceConfig.resolution !== nextConfig.resolution;

    if (!qualityChanged && !resolutionChanged) {
      state.performanceSettled = true;
      return;
    }

    performanceConfig.quality = nextConfig.quality;
    performanceConfig.resolution = nextConfig.resolution;

    if (qualityChanged) {
      const nextMaterial = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: blackholeVertexShader,
        fragmentShader: `${getBlackholeShaderDefines(performanceConfig.quality)}${blackholeFragmentShader}`,
        depthTest: false,
        depthWrite: false,
      });

      mesh.material = nextMaterial;
      material.dispose();
      material = nextMaterial;
    }

    if (qualityChanged || resolutionChanged) {
      setDemoSize();
    }

    state.performanceSettled = true;
  };

  const samplePerformance = (delta: number) => {
    if (state.performanceSettled) {
      return;
    }

    state.performanceSampleTime += delta;
    state.performanceSampleFrames += 1;

    if (state.performanceSampleTime < 5) {
      return;
    }

    const averageFps = state.performanceSampleFrames / state.performanceSampleTime;
    applyPerformanceConfig(getMeasuredPerformanceTarget(averageFps));
  };

  const syncScrollState = () => {
    if (scrollTrack) {
      const maxTravel = Math.max(scrollTrack.offsetHeight - window.innerHeight, 1);
      const scrolled = clamp(-scrollTrack.getBoundingClientRect().top, 0, maxTravel);
      state.scrollProgress = scrolled / maxTravel;
    } else {
      state.scrollProgress = 0;
    }

    pageHost?.style.setProperty(
      '--story-reveal',
      smoothstep(0.72, 0.96, state.scrollProgress).toFixed(4),
    );
    pageHost?.style.setProperty(
      '--risk-visibility',
      (
        smoothstep(0.22, 0.38, state.scrollProgress) *
        (1 - smoothstep(0.56, 0.72, state.scrollProgress))
      ).toFixed(4),
    );

    if (siteHeader) {
      const currentScrollY = window.scrollY;
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

  const onWheel = (event: WheelEvent) => {
    if (getSceneName() !== 'home') return;

    if (event.ctrlKey) return;

    const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);
    if (maxScroll <= 0) return;

    const distanceFactor = clamp((observer.distance - 1.52) / (10 - 1.52), 0, 1);
    const horizonBoost = THREE.MathUtils.lerp(1, 2.8, smoothstep(0.12, 0.88, state.scrollProgress));
    const storyProgressBoost = THREE.MathUtils.lerp(
      0.9,
      2.2,
      smoothstep(0.52, 0.94, state.scrollProgress),
    );
    const baseScrollMultiplier = THREE.MathUtils.lerp(0.42, 1.18, Math.sqrt(distanceFactor));
    const scrollMultiplier = baseScrollMultiplier * storyProgressBoost * horizonBoost;
    const nextScroll = clamp(window.scrollY + event.deltaY * scrollMultiplier, 0, maxScroll);

    if (nextScroll === window.scrollY) return;

    event.preventDefault();
    window.scrollTo({ top: nextScroll, behavior: 'auto' });
  };

  const updatePresentation = (delta: number) => {
    const sceneName = getSceneName();
    const target = getBlackholeSceneTarget(sceneName, state.scrollProgress);
    const homeTransitionBoost =
      sceneName === 'home'
        ? THREE.MathUtils.lerp(1, 3.2, smoothstep(0.08, 0.88, state.scrollProgress))
        : 1;
    const distanceGapBoost =
      sceneName === 'home'
        ? THREE.MathUtils.lerp(
            1,
            1.8,
            clamp(Math.abs(cameraConfig.distance - target.distance) / 4.5, 0, 1),
          )
        : 1;
    const sceneBlend = clamp(
      (1 - Math.exp(-delta * 5.2)) * homeTransitionBoost * distanceGapBoost,
      0.045,
      sceneName === 'home' ? 0.38 : 0.2,
    );

    cameraConfig.distance = THREE.MathUtils.lerp(
      cameraConfig.distance,
      target.distance,
      sceneBlend,
    );
    cameraConfig.fov = THREE.MathUtils.lerp(cameraConfig.fov, target.fov, sceneBlend);
    cameraConfig.orbit = target.orbit;

    observer.distance = cameraConfig.distance;
    observer.fov = cameraConfig.fov;

    if (sceneName === 'home') {
      bodyInteractionController.setFocusBody(
        homePresentationController.update({
          delta,
          target,
          scrollProgress: state.scrollProgress,
          pageHost,
          observer,
          homeBaseDirection,
          origin,
          worldUp,
          moveAnchor,
          cameraControl,
          keyboardMoveControl,
          bodyEntries,
          focusBodyEntry: bodyInteractionController.getFocusBody(),
          openBodyInspection: bodyInteractionController.openInspection,
          syncBodyDetailResolution: bodyInteractionController.syncDetailResolution,
          cameraDistance: cameraConfig.distance,
        }),
      );
      return;
    }

    observer.distance = cameraConfig.distance;
    orbitPresentationController.update({
      delta,
      time: state.time,
      target,
      pageHost,
      observer,
      observerBaseUp,
      origin,
      moveAnchor,
      cameraControl,
      keyboardMoveControl,
    });
  };

  const updateUniforms = () => {
    observer.moving = cameraConfig.orbit;
    observer.fov = cameraConfig.fov;
    overlayRenderPass.camera = observer;
    orbitRenderPass.camera = observer;

    uniforms.time.value = state.time;
    uniforms.cam_pos.value.copy(observer.position);
    uniforms.cam_dir.value.copy(observer.direction);
    uniforms.cam_up.value.copy(observer.up);
    uniforms.cam_vel.value.copy(getSceneName() === 'home' ? origin : observer.velocity);
    uniforms.fov.value = observer.fov;
    uniforms.bg_texture.value = textures.get('bg1') ?? null;
    uniforms.star_texture.value = textures.get('star') ?? null;
    uniforms.disk_texture.value = textures.get('disk') ?? null;
    uniforms.lorentz_transform.value = effectConfig.lorentz_transform;
    uniforms.accretion_disk.value = effectConfig.accretion_disk;
    uniforms.use_disk_texture.value = effectConfig.use_disk_texture;
    uniforms.doppler_shift.value = effectConfig.doppler_shift;
    uniforms.beaming.value = effectConfig.beaming;

    bloomPass.strength = bloomConfig.strength;
    bloomPass.radius = bloomConfig.radius;
    bloomPass.threshold = bloomConfig.threshold;

    bodySystem.updateUniforms(state.time, origin);
  };

  const updateBodySystem = (delta: number) => {
    if (getSceneName() !== 'home') {
      orbitGroup.visible = false;
      return;
    }

    orbitGroup.visible = true;
    bodySystem.update(delta, bodyInteractionController.getSelectedBody());
  };

  const updateBodyInteractivity = (event?: PointerEvent) => {
    const isHome = getSceneName() === 'home';

    if (cameraControl.isPointerLocked) {
      hoveredBodyPresentation = null;
      canvasMount.style.cursor = 'none';
      bodyDomBridge.clearTooltip();
      return;
    }

    canvasMount.style.cursor = isHome ? 'auto' : '';
    if (!isHome || clickableBodies.length === 0) {
      return;
    }

    raycaster.setFromCamera(pointer, observer);
    const intersections = raycaster.intersectObjects(clickableBodies, false);
    const hoveredBody = intersections[0]?.object as THREE.Mesh | undefined;
    hoveredBodyPresentation =
      (hoveredBody?.userData.bodyPresentation as BodyPresentationSource | undefined) ?? null;
    canvasMount.style.cursor = hoveredBody ? 'pointer' : 'auto';

    if (!hoveredBodyPresentation) {
      bodyDomBridge.clearTooltip();
      return;
    }

    if (!event) {
      return;
    }

    bodyDomBridge.syncTooltip(hoveredBodyPresentation, event.clientX, event.clientY);
  };

  const onPointerCanvasMove = (event: PointerEvent) => {
    if (cameraControl.isPointerLocked) {
      pointer.set(0, 0);
      return;
    }

    if (!isPointerInsideBlackholeViewport(event.clientX, event.clientY)) {
      onCanvasPointerLeave();
      return;
    }

    syncPointerFromClientPosition(event.clientX, event.clientY);
    updateBodyInteractivity(event);
  };

  const onCanvasPointerLeave = () => {
    hoveredBodyPresentation = null;
    canvasMount.style.cursor = 'auto';
    bodyDomBridge.clearTooltip();
  };

  const onCanvasClick = (event: MouseEvent) => {
    if (
      getSceneName() !== 'home' ||
      cameraControl.isPointerLocked ||
      isInteractiveUiTarget(event.target) ||
      !isPointerInsideBlackholeViewport(event.clientX, event.clientY)
    ) {
      return;
    }

    syncPointerFromClientPosition(event.clientX, event.clientY);

    raycaster.setFromCamera(pointer, observer);
    const intersections = raycaster.intersectObjects(clickableBodies, false);
    const clickedBody = intersections[0]?.object as THREE.Mesh | undefined;
    const clickedBodyEntry = getBodyEntryByMesh(clickedBody);

    if (!clickedBodyEntry) {
      bodyInteractionController.setSelectedBody(null);
      return;
    }

    if (bodyInteractionController.getSelectedBody() !== clickedBodyEntry) {
      bodyInteractionController.setSelectedBody(clickedBodyEntry);
      return;
    }

    bodyInteractionController.openInspection(clickedBodyEntry);
  };

  const updateReadableContrast = () => {
    const sceneName = getSceneName();
    const horizonExposure = smoothstep(0.12, 0.72, state.scrollProgress);
    const starfieldExposure = smoothstep(0.74, 0.96, state.scrollProgress);
    const lateralGlow = clamp(
      (Math.abs(keyboardMoveControl.offset.x) + Math.abs(cameraControl.yaw) * 0.4) / 1.2,
      0,
      1,
    );
    const pitchGlow = clamp(Math.abs(cameraControl.pitch) / 0.9, 0, 1);
    const targetMix =
      sceneName === 'home'
        ? clamp(
            horizonExposure * 0.72 +
              starfieldExposure * 0.2 +
              lateralGlow * 0.18 +
              pitchGlow * 0.24,
            0,
            1,
          )
        : clamp(0.34 + lateralGlow * 0.22 + pitchGlow * 0.28, 0.28, 0.92);

    state.readabilityMix = THREE.MathUtils.lerp(
      state.readabilityMix,
      targetMix,
      sceneName === 'home' ? 0.14 : 0.18,
    );
    pageHost?.style.setProperty('--story-contrast', state.readabilityMix.toFixed(4));
  };

  const refreshPageBindings = () => {
    const wantsBlackholeShell = document.body.classList.contains(BLACKHOLE_BODY_CLASS);

    if (!wantsBlackholeShell) {
      document.body.classList.add(BLACKHOLE_BODY_CLASS);
    }

    blackholeWindow.__BLACKHOLE_DEMO_REFRESH__?.();
    syncScrollState();
    updateReadableContrast();
    setDemoSize();
  };

  const isNightHours = () => {
    const currentHour = new Date().getHours();
    return currentHour >= 19 || currentHour < 6;
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

  const dismissNightWarning = () => {
    if (!nightWarning) return;

    nightWarning.hidden = true;
    document.body.removeAttribute('data-blackhole-night-locked');
    resumeRendering();
  };

  const showNightWarningIfNeeded = () => {
    if (!nightWarning || !isNightHours()) {
      dismissNightWarning();
      return;
    }

    nightWarning.hidden = false;
    document.body.setAttribute('data-blackhole-night-locked', 'true');
    pauseRendering();
    nightWarningConfirm?.focus();
  };

  const tick = (timestamp: number) => {
    if (!state.lastFrame) {
      state.lastFrame = timestamp;
    }

    const delta = Math.min((timestamp - state.lastFrame) / 1000, 0.05);
    state.time += delta;
    state.lastFrame = timestamp;

    observer.update(delta);
    updatePresentation(delta);
    updateBodySystem(delta);
    updateUniforms();
    composer.render();
    updateReadableContrast();
    updateBodyInteractivity();
    samplePerformance(delta);

    state.rafId = window.requestAnimationFrame(tick);
  };

  const onVisibilityChange = () => {
    if (state.renderPaused) {
      return;
    }

    if (document.hidden) {
      window.cancelAnimationFrame(state.rafId);
      return;
    }

    state.lastFrame = 0;
    state.rafId = window.requestAnimationFrame(tick);
  };

  const selectionGuard = (event: MouseEvent) => {
    const allowed = event.altKey && event.button === 0;
    document.documentElement.classList.toggle('selection-allowed', allowed);
  };

  const clearSelectionGuard = () => {
    document.documentElement.classList.remove('selection-allowed');
  };

  const onViewportChange = () => {
    setDemoSize();
    cameraControl.handleResize();
    syncScrollState();
  };

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
    buildBodySystem(),
  ]).then(() => {
    setDemoSize();
    cameraControl.handleResize();
    syncScrollState();
    updatePresentation(0);
    updateUniforms();
    updateReadableContrast();
    showNightWarningIfNeeded();

    if (!state.renderPaused) {
      state.rafId = window.requestAnimationFrame(tick);
    }
  });

  const resizeObserver = new ResizeObserver(setDemoSize);
  resizeObserver.observe(canvasMount);

  document.addEventListener('visibilitychange', onVisibilityChange);
  document.addEventListener('mousedown', selectionGuard, true);
  document.addEventListener('mouseup', clearSelectionGuard, true);
  document.addEventListener('astro:page-load', refreshPageBindings);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointermove', onPointerCanvasMove, { passive: true });
  window.addEventListener('click', onCanvasClick);
  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('scroll', syncScrollState, { passive: true });
  window.addEventListener('resize', onViewportChange);
  nightWarningConfirm?.addEventListener('click', dismissNightWarning);
  bodyPanelClose?.addEventListener('click', bodyInteractionController.closePanel);
  document.addEventListener('dragstart', (event) => {
    if (!(event.altKey && event instanceof MouseEvent && event.button === 0)) {
      event.preventDefault();
    }
  });

  let disposed = false;
  const dispose = () => {
    if (disposed) {
      return;
    }

    disposed = true;
    window.cancelAnimationFrame(state.rafId);
    resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', onVisibilityChange);
    document.removeEventListener('mousedown', selectionGuard, true);
    document.removeEventListener('mouseup', clearSelectionGuard, true);
    document.removeEventListener('astro:page-load', refreshPageBindings);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointermove', onPointerCanvasMove);
    window.removeEventListener('click', onCanvasClick);
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('scroll', syncScrollState);
    window.removeEventListener('resize', onViewportChange);
    nightWarningConfirm?.removeEventListener('click', dismissNightWarning);
    bodyPanelClose?.removeEventListener('click', bodyInteractionController.closePanel);
    cameraControl.dispose();
    keyboardMoveControl.dispose();
    renderer.dispose();
    mesh.geometry.dispose();
    material.dispose();
    textures.forEach((texture) => texture?.dispose());
    bodySystem.dispose();
    if (renderer.domElement.parentElement === canvasMount) {
      canvasMount.removeChild(renderer.domElement);
    }
    blackholeWindow.__BLACKHOLE_DEMO_INITIALIZED__ = false;
    blackholeWindow.__BLACKHOLE_DEMO_REFRESH__ = undefined;
    blackholeWindow.__BLACKHOLE_DEMO_HOST__ = null;
    blackholeWindow.__BLACKHOLE_RUNTIME_MODE__ = null;
    blackholeWindow.__BLACKHOLE_ACTIVE_BODY_SOURCE_SET__ = null;
    blackholeWindow.__BLACKHOLE_DISPOSE__ = undefined;
  };

  blackholeWindow.__BLACKHOLE_DISPOSE__ = dispose;

  window.addEventListener('pagehide', dispose, { once: true });
};
