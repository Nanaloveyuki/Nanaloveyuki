import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { CopyShader } from 'three/examples/jsm/shaders/CopyShader.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

const HOST_SELECTOR = '[data-blackhole-root]';
const PAGE_SELECTOR = '[data-blackhole-page]';
const SCROLL_TRACK_SELECTOR = '[data-blackhole-scroll-track]';
const HEADER_SELECTOR = '[data-site-header]';
const NIGHT_WARNING_SELECTOR = '[data-blackhole-night-warning]';
const NIGHT_WARNING_CONFIRM_SELECTOR = '[data-blackhole-night-warning-confirm]';
const BLACKHOLE_BODY_CLASS = 'theme-blackhole';

type SceneName = 'home' | 'projects' | 'blog' | 'tools';
type RenderQuality = 'low' | 'medium';

type PerformanceConfig = {
  resolution: number;
  quality: RenderQuality;
};

type SceneTarget = {
  distance: number;
  fov: number;
  orbit: boolean;
  dragEnabled: boolean;
  dragRecenter: number;
  keyboardRecenter: number;
  keyboardEnabled: boolean;
  autoYaw: number;
  autoPitch: number;
  forwardOffset: number;
  verticalOffset: number;
  rightOffset: number;
  driftAmplitude: number;
  starYawSpeed: number;
  storyReveal: number;
  riskVisibility: number;
};

type BlackholeWindow = Window & {
  __BLACKHOLE_DEMO_INITIALIZED__?: boolean;
  __BLACKHOLE_DEMO_REFRESH__?: () => void;
  __BLACKHOLE_DEMO_HOST__?: HTMLElement | null;
};

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

  setDirection(pitch: number, yaw: number) {
    const originalDirection = new THREE.Vector3(0, 0, -1);
    const rotation = new THREE.Euler(0, 0, 0, 'YXZ');
    rotation.set(pitch, yaw, 0);

    const newDirection = new THREE.Vector3();
    newDirection.copy(originalDirection).applyEuler(rotation);

    this.direction = newDirection.normalize();
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

class CameraDragControls {
  private lookSpeed = 0.005;
  private offsetX = 0;
  private offsetY = 0;
  private lastX = 0;
  private lastY = 0;
  private mouseDragOn = false;
  private viewHalfX = 0;
  private viewHalfY = 0;
  enabled = true;
  yaw = 0;
  pitch = 0;

  get isDragging() {
    return this.mouseDragOn;
  }

  constructor() {
    this.addMouseEventHandlers();
    this.handleResize();
  }

  handleResize() {
    this.viewHalfX = window.innerWidth / 2;
    this.viewHalfY = window.innerHeight / 2;
  }

  setEnabled(next: boolean) {
    this.enabled = next;

    if (!next) {
      this.mouseDragOn = false;
      this.offsetX = 0;
      this.offsetY = 0;
    }
  }

  update(recenterStrength: number) {
    if (!this.enabled && this.mouseDragOn) {
      this.mouseDragOn = false;
      this.offsetX = 0;
      this.offsetY = 0;
    }

    if (this.enabled && this.mouseDragOn) {
      this.yaw += this.lookSpeed * this.offsetX;
      this.pitch += this.lookSpeed * this.offsetY;
      this.pitch = clamp(this.pitch, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);

      this.offsetX *= 0.5;
      this.offsetY *= 0.5;
    }

    if (!this.mouseDragOn && recenterStrength > 0) {
      this.yaw = THREE.MathUtils.lerp(this.yaw, 0, recenterStrength);
      this.pitch = THREE.MathUtils.lerp(this.pitch, 0, recenterStrength);
    }
  }

  private addMouseEventHandlers() {
    window.addEventListener('contextmenu', (event) => {
      if (this.mouseDragOn) {
        event.preventDefault();
      }
    });

    window.addEventListener('mousemove', (event) => {
      if (!this.mouseDragOn) return;

      const newX = event.clientX - this.viewHalfX;
      const newY = event.clientY - this.viewHalfY;

      this.offsetX = newX - this.lastX;
      this.offsetY = newY - this.lastY;
      this.lastX = newX;
      this.lastY = newY;
    });

    window.addEventListener('mousedown', (event) => {
      if (!this.enabled || event.button !== 0 || event.altKey) return;

      if (
        event.target instanceof Element &&
        event.target.closest(
          'a, button, input, textarea, select, summary, [data-no-blackhole-drag]',
        )
      ) {
        return;
      }

      event.preventDefault();

      this.mouseDragOn = true;
      this.lastX = event.clientX - this.viewHalfX;
      this.lastY = event.clientY - this.viewHalfY;
    });

    window.addEventListener('mouseup', (event) => {
      if (!this.mouseDragOn) return;

      event.preventDefault();

      this.mouseDragOn = false;
      this.offsetX = 0;
      this.offsetY = 0;
    });

    window.addEventListener('mouseleave', () => {
      this.mouseDragOn = false;
      this.offsetX = 0;
      this.offsetY = 0;
    });
  }
}

class KeyboardOrbitControls {
  private activeKeys = new Set<string>();
  yaw = 0;
  pitch = 0;

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.clear);
  }

  update(delta: number, distance: number, allowInput: boolean, recenterStrength: number) {
    if (allowInput) {
      const orbitSpeed = clamp(distance * 0.07, 0.08, 0.56) * delta;

      if (this.activeKeys.has('KeyA')) {
        this.yaw += orbitSpeed;
      }
      if (this.activeKeys.has('KeyD')) {
        this.yaw -= orbitSpeed;
      }
      if (this.activeKeys.has('KeyW')) {
        this.pitch += orbitSpeed * 0.85;
      }
      if (this.activeKeys.has('KeyS')) {
        this.pitch -= orbitSpeed * 0.85;
      }

      this.pitch = clamp(this.pitch, -1.15, 1.15);
    }

    if (recenterStrength > 0) {
      this.yaw = THREE.MathUtils.lerp(this.yaw, 0, recenterStrength);
      this.pitch = THREE.MathUtils.lerp(this.pitch, 0, recenterStrength);
    }
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.clear);
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (!['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) return;

    this.activeKeys.add(event.code);
    event.preventDefault();
  };

  private onKeyUp = (event: KeyboardEvent) => {
    if (!['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) return;

    this.activeKeys.delete(event.code);
    event.preventDefault();
  };

  private clear = () => {
    this.activeKeys.clear();
  };
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

  for (int i=0; i<600; i++) {
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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const smoothstep = (start: number, end: number, value: number) => {
  const x = clamp((value - start) / (end - start), 0, 1);
  return x * x * (3 - 2 * x);
};

const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  resolution: 1.0,
  quality: 'medium',
};

const getMeasuredPerformanceTarget = (averageFps: number): PerformanceConfig => {
  if (averageFps >= 46) {
    return { resolution: 1.0, quality: 'medium' };
  }

  if (averageFps >= 32) {
    return { resolution: 0.75, quality: 'medium' };
  }

  return { resolution: 0.75, quality: 'low' };
};

const bootBlackholeDemo = () => {
  const blackholeWindow = window as BlackholeWindow;
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

  const canvasMount = host.querySelector<HTMLElement>('[data-blackhole-canvas]');
  let pageHost = document.querySelector<HTMLElement>(PAGE_SELECTOR);
  let scrollTrack = pageHost?.querySelector<HTMLElement>(SCROLL_TRACK_SELECTOR) ?? null;
  let siteHeader = document.querySelector<HTMLElement>(HEADER_SELECTOR);
  const nightWarning = document.querySelector<HTMLElement>(NIGHT_WARNING_SELECTOR);
  const nightWarningConfirm = nightWarning?.querySelector<HTMLButtonElement>(
    NIGHT_WARNING_CONFIRM_SELECTOR,
  );

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
  const screenCamera = new THREE.Camera();
  screenCamera.position.z = 1;

  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, screenCamera);
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(128, 128), 1.0, 0.5, 0.6);
  const shaderPass = new ShaderPass(CopyShader);
  shaderPass.renderToScreen = true;
  composer.addPass(renderPass);
  composer.addPass(bloomPass);
  composer.addPass(shaderPass);

  const textureLoader = new THREE.TextureLoader();
  const textures = new Map<string, THREE.Texture | null>();
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

  const getShaderDefines = (quality: RenderQuality) => {
    switch (quality) {
      case 'low':
        return '#define STEP 0.1\n#define NSTEPS 300\n';
      default:
        return '#define STEP 0.05\n#define NSTEPS 600\n';
    }
  };

  let material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader: `${getShaderDefines(performanceConfig.quality)}${fragmentShader}`,
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(mesh);

  const observer = new Observer(60.0, 1, 1, 80000);
  observer.distance = cameraConfig.distance;
  observer.moving = cameraConfig.orbit;
  observer.fov = cameraConfig.fov;
  observer.up.applyMatrix4(new THREE.Matrix4().makeRotationZ(observer.incline));
  scene.add(observer);
  const observerBaseUp = observer.up.clone();

  const cameraControl = new CameraDragControls();
  const keyboardOrbitControl = new KeyboardOrbitControls();
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
  };

  const origin = new THREE.Vector3(0, 0, 0);
  const baseForward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  const upVector = new THREE.Vector3();
  const orbitYawQuaternion = new THREE.Quaternion();
  const orbitPitchQuaternion = new THREE.Quaternion();
  const orbitUpAxis = new THREE.Vector3();
  const orbitPitchAxis = new THREE.Vector3();
  const rotatedPosition = new THREE.Vector3();
  const rotatedVelocity = new THREE.Vector3();

  const getSceneTarget = (): SceneTarget => {
    const sceneName = getSceneName();

    if (sceneName === 'blog') {
      return {
        distance: 7.2,
        fov: 58,
        orbit: true,
        dragEnabled: false,
        dragRecenter: 0.18,
        keyboardRecenter: 0.18,
        keyboardEnabled: false,
        autoYaw: Math.PI,
        autoPitch: -0.04,
        forwardOffset: -18,
        verticalOffset: 0.18,
        rightOffset: 0,
        driftAmplitude: 0.015,
        starYawSpeed: 0.015,
        storyReveal: 1,
        riskVisibility: 0,
      };
    }

    if (sceneName !== 'home') {
      return {
        distance: 2.74,
        fov: 78,
        orbit: true,
        dragEnabled: false,
        dragRecenter: 0.16,
        keyboardRecenter: 0.18,
        keyboardEnabled: false,
        autoYaw: 1.82,
        autoPitch: 0.005,
        forwardOffset: 0.08,
        verticalOffset: 0,
        rightOffset: 1.72,
        driftAmplitude: 0.035,
        starYawSpeed: 0.006,
        storyReveal: 1,
        riskVisibility: 0,
      };
    }

    const approachProgress = smoothstep(0.03, 0.68, state.scrollProgress);
    const emergeProgress = smoothstep(0.68, 0.92, state.scrollProgress);
    const recenterProgress = smoothstep(0.08, 0.34, state.scrollProgress);
    const starfieldRotation = Math.max(emergeProgress, smoothstep(0.8, 1, state.scrollProgress));
    const manualOrbitAllowed = state.scrollProgress < 0.06;
    const horizonViewProgress = smoothstep(0.14, 0.76, state.scrollProgress);

    const autoYawStart = 0.16;
    const autoYawStop = 0.44;
    const autoYawWindow =
      smoothstep(autoYawStart, autoYawStart + 0.1, state.scrollProgress) *
      (1 - smoothstep(autoYawStop - 0.08, autoYawStop, state.scrollProgress));

    return {
      distance: THREE.MathUtils.lerp(10, 1.52, approachProgress),
      fov: THREE.MathUtils.lerp(90, 104, approachProgress * (1 - emergeProgress * 0.5)),
      orbit: state.scrollProgress < 0.04,
      dragEnabled: true,
      dragRecenter: recenterProgress * 0.12,
      keyboardRecenter: manualOrbitAllowed ? 0 : recenterProgress * 0.12,
      keyboardEnabled: manualOrbitAllowed,
      autoYaw: THREE.MathUtils.lerp(0, 1.05, horizonViewProgress) * autoYawWindow,
      autoPitch: THREE.MathUtils.lerp(0, -0.2, smoothstep(0.2, 0.84, state.scrollProgress)),
      forwardOffset: THREE.MathUtils.lerp(0, 14, emergeProgress),
      verticalOffset: THREE.MathUtils.lerp(0, -0.85, emergeProgress),
      rightOffset: 0,
      driftAmplitude: 0.72 * starfieldRotation,
      starYawSpeed: 0.08 * starfieldRotation,
      storyReveal: smoothstep(0.72, 0.96, state.scrollProgress),
      riskVisibility:
        smoothstep(0.22, 0.38, state.scrollProgress) *
        (1 - smoothstep(0.56, 0.72, state.scrollProgress)),
    };
  };

  const setDemoSize = () => {
    const width = Math.max(canvasMount.clientWidth, 1);
    const height = Math.max(canvasMount.clientHeight, 1);
    const resolutionScale = performanceConfig.resolution;
    renderer.setPixelRatio(window.devicePixelRatio * resolutionScale);
    renderer.setSize(width, height, false);
    composer.setSize(width * resolutionScale, height * resolutionScale);
    observer.aspect = width / height;
    observer.updateProjectionMatrix();

    uniforms.resolution.value.set(width * resolutionScale, height * resolutionScale);
  };

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
        vertexShader,
        fragmentShader: `${getShaderDefines(performanceConfig.quality)}${fragmentShader}`,
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
    const storyProgressBoost = THREE.MathUtils.lerp(
      0.9,
      1.8,
      smoothstep(0.52, 0.94, state.scrollProgress),
    );
    const baseScrollMultiplier = THREE.MathUtils.lerp(0.34, 1.06, Math.sqrt(distanceFactor));
    const scrollMultiplier = baseScrollMultiplier * storyProgressBoost;
    const nextScroll = clamp(window.scrollY + event.deltaY * scrollMultiplier, 0, maxScroll);

    if (nextScroll === window.scrollY) return;

    event.preventDefault();
    window.scrollTo({ top: nextScroll, behavior: 'auto' });
  };

  const updatePresentation = (delta: number) => {
    const target = getSceneTarget();
    const sceneName = getSceneName();
    const sceneBlend = clamp(1 - Math.exp(-delta * 5.2), 0.045, 0.2);

    cameraConfig.distance = THREE.MathUtils.lerp(
      cameraConfig.distance,
      target.distance,
      sceneBlend,
    );
    cameraConfig.fov = THREE.MathUtils.lerp(cameraConfig.fov, target.fov, sceneBlend);
    cameraConfig.orbit = target.orbit;

    observer.distance = cameraConfig.distance;
    observer.fov = cameraConfig.fov;

    if (sceneName === 'home' && state.scrollProgress > 0.06) {
      const orbitBrake = THREE.MathUtils.lerp(
        0.18,
        0.82,
        smoothstep(0.06, 0.18, state.scrollProgress),
      );
      observer.angularVelocity = THREE.MathUtils.lerp(observer.angularVelocity, 0, orbitBrake);
    }

    cameraControl.setEnabled(target.dragEnabled);
    cameraControl.update(target.dragRecenter);
    keyboardOrbitControl.update(
      delta,
      observer.distance,
      target.keyboardEnabled,
      target.keyboardRecenter,
    );

    orbitUpAxis.copy(observerBaseUp).normalize();
    rotatedPosition.copy(observer.position);
    rotatedVelocity.copy(observer.velocity);

    orbitYawQuaternion.setFromAxisAngle(orbitUpAxis, keyboardOrbitControl.yaw + target.autoYaw);
    rotatedPosition.applyQuaternion(orbitYawQuaternion);
    rotatedVelocity.applyQuaternion(orbitYawQuaternion);

    orbitPitchAxis.crossVectors(orbitUpAxis, rotatedPosition).normalize();
    if (orbitPitchAxis.lengthSq() > 0) {
      orbitPitchQuaternion.setFromAxisAngle(
        orbitPitchAxis,
        keyboardOrbitControl.pitch + target.autoPitch,
      );
      rotatedPosition.applyQuaternion(orbitPitchQuaternion);
      rotatedVelocity.applyQuaternion(orbitPitchQuaternion);
    }

    observer.position.copy(rotatedPosition);
    observer.velocity.copy(rotatedVelocity);
    observer.up.copy(observerBaseUp).applyQuaternion(orbitYawQuaternion);
    if (orbitPitchAxis.lengthSq() > 0) {
      observer.up.applyQuaternion(orbitPitchQuaternion);
    }

    upVector.copy(observer.up).normalize();
    baseForward.copy(origin).sub(observer.position).normalize();
    right.crossVectors(baseForward, upVector).normalize();

    const driftOffset = target.rightOffset + Math.sin(state.time * 0.18) * target.driftAmplitude;
    const starYawOffset = state.time * target.starYawSpeed;
    const yawInfluence = target.dragEnabled ? 1 : 0;
    const yawOffset = cameraControl.yaw * yawInfluence;
    const pitchOffset = cameraControl.pitch * yawInfluence;

    lookTarget.copy(origin);
    lookTarget.addScaledVector(baseForward, target.forwardOffset);
    lookTarget.addScaledVector(upVector, target.verticalOffset);
    lookTarget.addScaledVector(right, driftOffset);

    lookTarget.sub(observer.position);

    const yawQuaternion = new THREE.Quaternion().setFromAxisAngle(
      upVector,
      yawOffset + starYawOffset,
    );
    const pitchAxis = new THREE.Vector3().crossVectors(lookTarget, upVector).normalize();
    const pitchQuaternion = new THREE.Quaternion().setFromAxisAngle(pitchAxis, pitchOffset);

    lookTarget.applyQuaternion(yawQuaternion);
    if (pitchAxis.lengthSq() > 0) {
      lookTarget.applyQuaternion(pitchQuaternion);
    }

    observer.direction.copy(lookTarget.normalize());
    pageHost?.style.setProperty('--story-reveal', target.storyReveal.toFixed(4));
    pageHost?.style.setProperty('--risk-visibility', target.riskVisibility.toFixed(4));
  };

  const updateUniforms = () => {
    observer.distance = cameraConfig.distance;
    observer.moving = cameraConfig.orbit;
    observer.fov = cameraConfig.fov;

    uniforms.time.value = state.time;
    uniforms.cam_pos.value.copy(observer.position);
    uniforms.cam_dir.value.copy(observer.direction);
    uniforms.cam_up.value.copy(observer.up);
    uniforms.cam_vel.value.copy(observer.velocity);
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
  };

  const updateReadableContrast = () => {
    const sceneName = getSceneName();
    const horizonExposure = smoothstep(0.12, 0.72, state.scrollProgress);
    const starfieldExposure = smoothstep(0.74, 0.96, state.scrollProgress);
    const lateralGlow = clamp(
      (Math.abs(keyboardOrbitControl.yaw) + Math.abs(cameraControl.yaw) * 0.6) / 1.4,
      0,
      1,
    );
    const pitchGlow = clamp(Math.abs(keyboardOrbitControl.pitch + cameraControl.pitch) / 0.9, 0, 1);
    const targetMix =
      sceneName === 'home'
        ? clamp(
            horizonExposure * 0.72 +
              starfieldExposure * 0.2 +
              lateralGlow * 0.36 +
              pitchGlow * 0.24,
            0,
            1,
          )
        : clamp(0.34 + lateralGlow * 0.46 + pitchGlow * 0.28, 0.28, 0.92);

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
    updateUniforms();
    composer.render();
    updateReadableContrast();
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
  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('scroll', syncScrollState, { passive: true });
  window.addEventListener('resize', onViewportChange);
  nightWarningConfirm?.addEventListener('click', dismissNightWarning);
  document.addEventListener('dragstart', (event) => {
    if (!(event.altKey && event instanceof MouseEvent && event.button === 0)) {
      event.preventDefault();
    }
  });

  window.addEventListener(
    'pagehide',
    () => {
      window.cancelAnimationFrame(state.rafId);
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('mousedown', selectionGuard, true);
      document.removeEventListener('mouseup', clearSelectionGuard, true);
      document.removeEventListener('astro:page-load', refreshPageBindings);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('scroll', syncScrollState);
      window.removeEventListener('resize', onViewportChange);
      nightWarningConfirm?.removeEventListener('click', dismissNightWarning);
      keyboardOrbitControl.dispose();
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
    },
    { once: true },
  );
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootBlackholeDemo, { once: true });
} else {
  bootBlackholeDemo();
}
