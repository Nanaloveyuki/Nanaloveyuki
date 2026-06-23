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
import { createOrbitPresentationController } from '@blackhole/scenes/orbitPresentationController';
import { createPlanetDomBridge } from '@blackhole/systems/planets/planetDomBridge';
import { createPlanetInteractionController } from '@blackhole/systems/planets/planetInteractionController';
import { createPlanetSystem } from '@blackhole/systems/planets/planetSystem';
import {
  BLACKHOLE_BODY_CLASS,
  FRIEND_TOOLTIP_SELECTOR,
  HEADER_SELECTOR,
  HOST_SELECTOR,
  NIGHT_WARNING_CONFIRM_SELECTOR,
  NIGHT_WARNING_SELECTOR,
  PAGE_SELECTOR,
  PLANET_PANEL_CLOSE_SELECTOR,
  PLANET_PANEL_SELECTOR,
  SCROLL_TRACK_SELECTOR,
} from '@blackhole/types';
import type {
  BlackholeWindow,
  FriendPlanet,
  FriendTooltipElements,
  PlanetPanelElements,
  PerformanceConfig,
  SceneName,
} from '@blackhole/types';
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

const bootBlackholeDemo = () => {
  const blackholeWindow = window as BlackholeWindow;
  if (
    blackholeWindow.__BLACKHOLE_RUNTIME_MODE__ &&
    blackholeWindow.__BLACKHOLE_RUNTIME_MODE__ !== 'home'
  ) {
    blackholeWindow.__BLACKHOLE_DISPOSE__?.();
  }

  const host = document.querySelector<HTMLElement>(HOST_SELECTOR);

  if (!host) {
    blackholeWindow.__BLACKHOLE_DEMO_INITIALIZED__ = false;
    blackholeWindow.__BLACKHOLE_DEMO_HOST__ = null;
    return;
  }

  const canvasAlreadyMounted = !!host.querySelector('canvas');

  if (
    blackholeWindow.__BLACKHOLE_DEMO_INITIALIZED__ &&
    blackholeWindow.__BLACKHOLE_DEMO_HOST__ === host &&
    canvasAlreadyMounted
  ) {
    blackholeWindow.__BLACKHOLE_DEMO_REFRESH__?.();
    return;
  }

  blackholeWindow.__BLACKHOLE_DEMO_INITIALIZED__ = true;
  blackholeWindow.__BLACKHOLE_DEMO_HOST__ = host;
  blackholeWindow.__BLACKHOLE_RUNTIME_MODE__ = 'home';

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
  const friendTooltipElements: FriendTooltipElements = {
    root: friendTooltip ?? null,
    name: friendTooltipName ?? null,
  };
  const planetPanel = document.querySelector<HTMLElement>(PLANET_PANEL_SELECTOR);
  const planetPanelClose = planetPanel?.querySelector<HTMLButtonElement>(
    PLANET_PANEL_CLOSE_SELECTOR,
  );
  const planetPanelType = planetPanel?.querySelector<HTMLElement>(
    '[data-blackhole-planet-panel-type]',
  );
  const planetPanelName = planetPanel?.querySelector<HTMLElement>(
    '[data-blackhole-planet-panel-name]',
  );
  const planetPanelDescription = planetPanel?.querySelector<HTMLElement>(
    '[data-blackhole-planet-panel-description]',
  );
  const planetPanelPreview = planetPanel?.querySelector<HTMLElement>(
    '[data-blackhole-planet-panel-preview]',
  );
  const planetPanelPreviewAtmosphere = planetPanel?.querySelector<HTMLElement>(
    '[data-blackhole-planet-panel-preview-atmosphere]',
  );
  const planetPanelPreviewPlanet = planetPanel?.querySelector<HTMLElement>(
    '[data-blackhole-planet-panel-preview-planet]',
  );
  const planetPanelPreviewWater = planetPanel?.querySelector<HTMLElement>(
    '[data-blackhole-planet-panel-preview-water]',
  );
  const planetPanelPreviewLand = planetPanel?.querySelector<HTMLElement>(
    '[data-blackhole-planet-panel-preview-land]',
  );
  const planetPanelPreviewClouds = planetPanel?.querySelector<HTMLElement>(
    '[data-blackhole-planet-panel-preview-clouds]',
  );
  const planetPanelPreviewEquator = planetPanel?.querySelector<HTMLElement>(
    '[data-blackhole-planet-panel-preview-equator]',
  );
  const planetPanelPreviewPoleNorth = planetPanel?.querySelector<HTMLElement>(
    '[data-blackhole-planet-panel-preview-pole-north]',
  );
  const planetPanelPreviewPoleSouth = planetPanel?.querySelector<HTMLElement>(
    '[data-blackhole-planet-panel-preview-pole-south]',
  );
  const planetPanelPreviewRing = planetPanel?.querySelector<HTMLElement>(
    '[data-blackhole-planet-panel-preview-ring]',
  );
  const planetPanelPreviewCopy = planetPanel?.querySelector<HTMLElement>(
    '[data-blackhole-planet-panel-preview-copy]',
  );
  const planetPanelLink = planetPanel?.querySelector<HTMLAnchorElement>(
    '[data-blackhole-planet-panel-link]',
  );
  const planetPanelStatType = planetPanel?.querySelector<HTMLElement>(
    '[data-blackhole-planet-panel-stat-type]',
  );
  const planetPanelStatRadius = planetPanel?.querySelector<HTMLElement>(
    '[data-blackhole-planet-panel-stat-radius]',
  );
  const planetPanelStatTemperature = planetPanel?.querySelector<HTMLElement>(
    '[data-blackhole-planet-panel-stat-temperature]',
  );
  const planetPanelStatAtmosphere = planetPanel?.querySelector<HTMLElement>(
    '[data-blackhole-planet-panel-stat-atmosphere]',
  );
  const planetPanelStatOrbit = planetPanel?.querySelector<HTMLElement>(
    '[data-blackhole-planet-panel-stat-orbit]',
  );
  const planetPanelStatWeight = planetPanel?.querySelector<HTMLElement>(
    '[data-blackhole-planet-panel-stat-weight]',
  );
  const planetPanelStatRotation = planetPanel?.querySelector<HTMLElement>(
    '[data-blackhole-planet-panel-stat-rotation]',
  );
  const planetPanelStatTilt = planetPanel?.querySelector<HTMLElement>(
    '[data-blackhole-planet-panel-stat-tilt]',
  );
  const planetPanelStatPoles = planetPanel?.querySelector<HTMLElement>(
    '[data-blackhole-planet-panel-stat-poles]',
  );
  const planetPanelStatEquator = planetPanel?.querySelector<HTMLElement>(
    '[data-blackhole-planet-panel-stat-equator]',
  );
  const planetPanelStatClouds = planetPanel?.querySelector<HTMLElement>(
    '[data-blackhole-planet-panel-stat-clouds]',
  );
  const planetPanelStatSurface = planetPanel?.querySelector<HTMLElement>(
    '[data-blackhole-planet-panel-stat-surface]',
  );
  const planetPanelElements: PlanetPanelElements = {
    panel: planetPanel ?? null,
    close: planetPanelClose ?? null,
    type: planetPanelType ?? null,
    name: planetPanelName ?? null,
    description: planetPanelDescription ?? null,
    preview: planetPanelPreview ?? null,
    previewAtmosphere: planetPanelPreviewAtmosphere ?? null,
    previewPlanet: planetPanelPreviewPlanet ?? null,
    previewWater: planetPanelPreviewWater ?? null,
    previewLand: planetPanelPreviewLand ?? null,
    previewClouds: planetPanelPreviewClouds ?? null,
    previewEquator: planetPanelPreviewEquator ?? null,
    previewPoleNorth: planetPanelPreviewPoleNorth ?? null,
    previewPoleSouth: planetPanelPreviewPoleSouth ?? null,
    previewRing: planetPanelPreviewRing ?? null,
    previewCopy: planetPanelPreviewCopy ?? null,
    link: planetPanelLink ?? null,
    statType: planetPanelStatType ?? null,
    statRadius: planetPanelStatRadius ?? null,
    statTemperature: planetPanelStatTemperature ?? null,
    statAtmosphere: planetPanelStatAtmosphere ?? null,
    statOrbit: planetPanelStatOrbit ?? null,
    statWeight: planetPanelStatWeight ?? null,
    statRotation: planetPanelStatRotation ?? null,
    statTilt: planetPanelStatTilt ?? null,
    statPoles: planetPanelStatPoles ?? null,
    statEquator: planetPanelStatEquator ?? null,
    statClouds: planetPanelStatClouds ?? null,
    statSurface: planetPanelStatSurface ?? null,
  };
  const planetDomBridge = createPlanetDomBridge({
    panel: planetPanelElements,
    tooltip: friendTooltipElements,
  });

  if (!canvasMount) {
    throw new Error('Missing blackhole demo mount points');
  }

  blackholeWindow.__BLACKHOLE_DEMO_REFRESH__ = () => {
    pageHost = document.querySelector<HTMLElement>(PAGE_SELECTOR);
    scrollTrack = pageHost?.querySelector<HTMLElement>(SCROLL_TRACK_SELECTOR) ?? null;
    siteHeader = document.querySelector<HTMLElement>(HEADER_SELECTOR);
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
  const planetSystem = createPlanetSystem(overlayScene, orbitScene);
  const { orbitGroup } = planetSystem;

  const friendPlanets = planetSystem.entries;
  const clickablePlanetMeshes = planetSystem.clickableMeshes;
  let hoveredFriendPlanet: FriendPlanet | null = null;
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

  const loadFriendPlanets = async () => {
    const friendPlanets = blackholeWindow.__BLACKHOLE_FRIEND_PLANETS__;

    if (!Array.isArray(friendPlanets)) {
      throw new Error('Missing preloaded friend planets');
    }

    return friendPlanets;
  };

  const getPlanetEntryByMesh = (mesh?: THREE.Mesh) =>
    friendPlanets.find((planetEntry) => planetEntry.mesh === mesh) ?? null;

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
        'a, button, input, textarea, select, summary, .site-header, .site-footer, [data-blackhole-planet-panel], [data-blackhole-night-warning]',
      ),
    );

  const syncPointerFromClientPosition = (clientX: number, clientY: number) => {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((clientY - bounds.top) / bounds.height) * 2 + 1;
  };

  const buildFriendPlanetSystem = async () => {
    const friends = await loadFriendPlanets();
    planetSystem.build(friends);
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
  const planetInteractionController = createPlanetInteractionController({
    planetDomBridge,
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
      planetInteractionController.setFocusPlanet(
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
          friendPlanets,
          focusPlanetEntry: planetInteractionController.getFocusPlanet(),
          openPlanetInspection: planetInteractionController.openInspection,
          syncPlanetDetailResolution: planetInteractionController.syncDetailResolution,
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

    planetSystem.updateUniforms(state.time, origin);
  };

  const updateFriendPlanetSystem = (delta: number) => {
    if (getSceneName() !== 'home') {
      orbitGroup.visible = false;
      return;
    }

    orbitGroup.visible = true;
    planetSystem.update(delta, planetInteractionController.getSelectedPlanet());
  };

  const updatePlanetInteractivity = (event?: PointerEvent) => {
    const isHome = getSceneName() === 'home';

    if (cameraControl.isPointerLocked) {
      hoveredFriendPlanet = null;
      canvasMount.style.cursor = 'none';
      planetDomBridge.clearTooltip();
      return;
    }

    canvasMount.style.cursor = isHome ? 'auto' : '';
    if (!isHome || clickablePlanetMeshes.length === 0) {
      return;
    }

    raycaster.setFromCamera(pointer, observer);
    const intersections = raycaster.intersectObjects(clickablePlanetMeshes, false);
    const hoveredPlanet = intersections[0]?.object as THREE.Mesh | undefined;
    hoveredFriendPlanet =
      (hoveredPlanet?.userData.friendPlanet as FriendPlanet | undefined) ?? null;
    canvasMount.style.cursor = hoveredPlanet ? 'pointer' : 'auto';

    if (!hoveredFriendPlanet) {
      planetDomBridge.clearTooltip();
      return;
    }

    if (!event) {
      return;
    }

    planetDomBridge.syncTooltip(hoveredFriendPlanet, event.clientX, event.clientY);
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
    updatePlanetInteractivity(event);
  };

  const onCanvasPointerLeave = () => {
    hoveredFriendPlanet = null;
    canvasMount.style.cursor = 'auto';
    planetDomBridge.clearTooltip();
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
    const intersections = raycaster.intersectObjects(clickablePlanetMeshes, false);
    const clickedPlanet = intersections[0]?.object as THREE.Mesh | undefined;
    const clickedPlanetEntry = getPlanetEntryByMesh(clickedPlanet);

    if (!clickedPlanetEntry) {
      planetInteractionController.setSelectedPlanet(null);
      return;
    }

    if (planetInteractionController.getSelectedPlanet() !== clickedPlanetEntry) {
      planetInteractionController.setSelectedPlanet(clickedPlanetEntry);
      return;
    }

    planetInteractionController.openInspection(clickedPlanetEntry);
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
    updateFriendPlanetSystem(delta);
    updateUniforms();
    composer.render();
    updateReadableContrast();
    updatePlanetInteractivity();
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
    buildFriendPlanetSystem(),
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
  planetPanelClose?.addEventListener('click', planetInteractionController.closePanel);
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
    planetPanelClose?.removeEventListener('click', planetInteractionController.closePanel);
    cameraControl.dispose();
    keyboardMoveControl.dispose();
    renderer.dispose();
    mesh.geometry.dispose();
    material.dispose();
    textures.forEach((texture) => texture?.dispose());
    planetSystem.dispose();
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootBlackholeDemo, { once: true });
} else {
  bootBlackholeDemo();
}
