import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { CopyShader } from 'three/examples/jsm/shaders/CopyShader.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {
  BLACKHOLE_BODY_CLASS,
  HEADER_SELECTOR,
  HOST_SELECTOR,
  PAGE_SELECTOR,
} from './blackhole/types';
import type { BlackholeWindow, SceneName } from './blackhole/types';
import { clamp, smoothstep } from './blackhole/math';

class Observer extends THREE.PerspectiveCamera {
  time = 0;
  theta = 0;
  angularVelocity = 0;
  maxAngularVelocity = 0;
  velocity = new THREE.Vector3();
  direction = new THREE.Vector3();
  moving = true;
  timeDilation = false;
  incline = (-5 * Math.PI) / 180;
  private r = 10;

  constructor(fov: number, ratio: number, near: number, far: number) {
    super(fov, ratio, near, far);
    this.position.set(0, 0, 1);
  }

  set distance(r: number) {
    this.r = r;
    this.maxAngularVelocity = 1 / Math.sqrt(2.0 * (r - 1.0)) / this.r;
    this.position.normalize().multiplyScalar(r);
  }

  get distance() {
    return this.r;
  }

  update(delta: number) {
    const adjustedDelta = this.timeDilation
      ? Math.sqrt(
          (delta * delta * (1.0 - this.angularVelocity * this.angularVelocity)) /
            (1 - 1.0 / this.r),
        )
      : delta;

    this.theta += this.angularVelocity * adjustedDelta;
    const cos = Math.cos(this.theta);
    const sin = Math.sin(this.theta);

    this.position.set(this.r * sin, 0, this.r * cos);
    this.velocity.set(cos * this.angularVelocity, 0, -sin * this.angularVelocity);

    const inclineMatrix = new THREE.Matrix4().makeRotationX(this.incline);
    this.position.applyMatrix4(inclineMatrix);
    this.velocity.applyMatrix4(inclineMatrix);

    if (this.moving) {
      if (this.angularVelocity < this.maxAngularVelocity) {
        this.angularVelocity += adjustedDelta / this.r;
      } else {
        this.angularVelocity = this.maxAngularVelocity;
      }
    } else if (this.angularVelocity > 0.0) {
      this.angularVelocity -= adjustedDelta / this.r;
    } else {
      this.angularVelocity = 0;
      this.velocity.set(0.0, 0.0, 0.0);
    }

    this.time += adjustedDelta;
  }
}

const fragmentShader = `
#define PI 3.141592653589793238462643383279
#define DEG_TO_RAD (PI/180.0)
#define ROT_Z(a) mat3(cos(a), -sin(a), 0, sin(a), cos(a), 0, 0, 0, 1)

uniform float time;
uniform vec2 resolution;
uniform vec3 cam_pos;
uniform vec3 cam_dir;
uniform vec3 cam_up;
uniform float fov;
uniform vec3 cam_vel;
uniform bool accretion_disk;
uniform bool use_disk_texture;
uniform bool doppler_shift;
uniform bool lorentz_transform;
uniform bool beaming;
uniform sampler2D bg_texture;
uniform sampler2D star_texture;
uniform sampler2D disk_texture;

const float MIN_TEMPERATURE = 1000.0;
const float TEMPERATURE_RANGE = 39000.0;
const float DISK_IN = 2.0;
const float DISK_WIDTH = 4.0;

vec2 square_frame(vec2 screen_size){
  vec2 position = 2.0 * (gl_FragCoord.xy / screen_size.xy) - 1.0;
  return position;
}

vec2 to_spherical(vec3 cartesian_coord){
  vec2 uv = vec2(atan(cartesian_coord.z,cartesian_coord.x), asin(cartesian_coord.y));
  uv *= vec2(1.0/(2.0*PI), 1.0/PI);
  uv += 0.5;
  return uv;
}

vec3 lorentz_transform_velocity(vec3 u, vec3 v){
  float speed = length(v);
  if (speed > 0.0){
    float gamma = 1.0/sqrt(1.0-dot(v,v));
    float denominator = 1.0 - dot(v,u);
    vec3 new_u = (u/gamma - v + (gamma/(gamma+1.0)) * dot(u,v)*v)/denominator;
    return new_u;
  }
  return u;
}

vec3 temp_to_color(float temp_kelvin){
  vec3 color;
  temp_kelvin = clamp(temp_kelvin, 1000.0, 40000.0) / 100.0;
  if (temp_kelvin <= 66.0){
    color.r = 255.0;
    color.g = temp_kelvin;
    color.g = 99.4708025861 * log(color.g) - 161.1195681661;
    color.g = clamp(color.g, 0.0, 255.0);
  } else {
    color.r = temp_kelvin - 60.0;
    color.r = 329.698727446 * pow(max(color.r, 0.0), -0.1332047592);
    color.r = clamp(color.r, 0.0, 255.0);
    color.g = temp_kelvin - 60.0;
    color.g = 288.1221695283 * pow(max(color.g, 0.0), -0.0755148492);
    color.g = clamp(color.g, 0.0, 255.0);
  }
  if (temp_kelvin >= 66.0){
    color.b = 255.0;
  } else if (temp_kelvin <= 19.0){
    color.b = 0.0;
  } else {
    color.b = temp_kelvin - 10.0;
    color.b = 138.5177312231 * log(color.b) - 305.0447927307;
    color.b = clamp(color.b, 0.0, 255.0);
  }
  color /= 255.0;
  return color;
}

void main() {
  float uvfov = tan(fov / 2.0 * DEG_TO_RAD);
  vec2 uv = square_frame(resolution);
  uv *= vec2(resolution.x/resolution.y, 1.0);

  vec3 forward = normalize(cam_dir);
  vec3 up = normalize(cam_up);
  vec3 nright = normalize(cross(forward, up));
  up = cross(nright, forward);

  vec3 pixel_pos = cam_pos + forward + nright * uv.x * uvfov + up * uv.y * uvfov;
  vec3 ray_dir = normalize(pixel_pos - cam_pos);

  if (lorentz_transform) {
    ray_dir = lorentz_transform_velocity(ray_dir, cam_vel);
  }

  vec4 color = vec4(0.0,0.0,0.0,1.0);
  vec3 point = cam_pos;
  vec3 velocity = ray_dir;
  vec3 c = cross(point,velocity);
  float h2 = dot(c,c);

  float ray_gamma = 1.0/sqrt(1.0-dot(cam_vel,cam_vel));
  float ray_doppler_factor = ray_gamma * (1.0 + dot(ray_dir, -cam_vel));
  float ray_intensity = beaming ? 1.0 / pow(ray_doppler_factor, 3.0) : 1.0;

  vec3 oldpoint;
  float distance = length(point);

  for (int i=0; i<420; i++) {
    oldpoint = point;
    point += velocity * 0.05;
    vec3 accel = -1.5 * h2 * point / pow(dot(point,point),2.5);
    velocity += accel * 0.05;
    distance = length(point);

    bool horizon_mask = distance < 1.0 && length(oldpoint) > 1.0;
    if (horizon_mask) {
      break;
    }

    if (accretion_disk && oldpoint.y * point.y < 0.0) {
      float lambda = - oldpoint.y/velocity.y;
      vec3 intersection = oldpoint + lambda*velocity;
      float r = length(intersection);

      if (DISK_IN <= r && r <= DISK_IN + DISK_WIDTH) {
        float phi = atan(intersection.x, intersection.z);
        vec3 disk_velocity = vec3(-intersection.x, 0.0, intersection.z)/sqrt(2.0*(r-1.0))/(r*r);
        phi -= time;
        phi = mod(phi , PI*2.0);
        float disk_gamma = 1.0/sqrt(1.0-dot(disk_velocity, disk_velocity));
        float disk_doppler_factor = disk_gamma*(1.0+dot(ray_dir/distance, disk_velocity));

        if (use_disk_texture) {
          vec2 tex_coord = vec2(mod(phi,2.0*PI)/(2.0*PI),1.0-(r-DISK_IN)/(DISK_WIDTH));
          vec4 disk_color = texture2D(disk_texture, tex_coord) / (ray_doppler_factor * disk_doppler_factor);
          float disk_alpha = clamp(dot(disk_color,disk_color)/4.5,0.0,1.0);
          if (beaming) {
            disk_alpha /= pow(disk_doppler_factor,3.0);
          }
          color += vec4(disk_color) * disk_alpha;
        } else {
          float disk_temperature = 10000.0 * pow(r / DISK_IN, -3.0 / 4.0);
          if (doppler_shift) {
            disk_temperature /= ray_doppler_factor * disk_doppler_factor;
          }
          vec3 disk_color = temp_to_color(disk_temperature);
          float disk_alpha = clamp(dot(disk_color,disk_color)/3.0,0.0,1.0);
          if (beaming) {
            disk_alpha /= pow(disk_doppler_factor,3.0);
          }
          color += vec4(disk_color, 1.0) * disk_alpha;
        }
      }
    }
  }

  if (distance > 1.0) {
    ray_dir = normalize(point - oldpoint);
    vec2 tex_coord = to_spherical(ray_dir * ROT_Z(45.0 * DEG_TO_RAD));
    vec4 star_color = texture2D(star_texture, tex_coord);

    if (star_color.g > 0.0){
      float star_temperature = MIN_TEMPERATURE + TEMPERATURE_RANGE * star_color.r;
      float star_velocity = star_color.b - 0.5;
      float star_doppler_factor = sqrt((1.0+star_velocity)/(1.0-star_velocity));
      if (doppler_shift) {
        star_temperature /= ray_doppler_factor * star_doppler_factor;
      }
      color += vec4(temp_to_color(star_temperature),1.0) * star_color.g;
    }

    color += texture2D(bg_texture, tex_coord) * 0.25;
  }

  gl_FragColor = color * ray_intensity;
}
`;

const vertexShader = `
void main() {
  gl_Position = vec4(position, 1.0);
}
`;

const getSceneName = (): SceneName => {
  const page = document.querySelector<HTMLElement>(PAGE_SELECTOR);
  return (page?.dataset.blackholeScene as SceneName | undefined) ?? 'projects';
};

const bootBlackholeOrbit = () => {
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
    fragmentShader,
    vertexShader,
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

  const getSceneTarget = (sceneName: SceneName) => {
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootBlackholeOrbit, { once: true });
} else {
  bootBlackholeOrbit();
}
