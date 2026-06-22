import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { CopyShader } from 'three/examples/jsm/shaders/CopyShader.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
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
} from './blackhole/types';
import type {
  BlackholeWindow,
  FriendPlanet,
  FriendPlanetProfile,
  FriendPlanetType,
  PlanetEntry,
  PerformanceConfig,
  RenderQuality,
  SceneName,
  SceneTarget,
} from './blackhole/types';
import {
  clamp,
  createOrbitLine,
  DEFAULT_PERFORMANCE_CONFIG,
  getMeasuredPerformanceTarget,
  getOrbitBand,
  hashString,
  smoothstep,
} from './blackhole/math';

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
  private lookSpeed = 0.0042;
  private offsetX = 0;
  private offsetY = 0;
  private dragActive = false;
  private pointerLocked = false;
  private lastX = 0;
  private lastY = 0;
  private domElement: HTMLElement;
  enabled = true;
  yaw = 0;
  pitch = 0;

  get isCapturing() {
    return this.dragActive || this.pointerLocked;
  }

  get isPointerLocked() {
    return this.pointerLocked;
  }

  constructor(domElement: HTMLElement) {
    this.domElement = domElement;
    this.addMouseEventHandlers();
  }

  handleResize() {}

  setEnabled(next: boolean) {
    this.enabled = next;

    if (!next) {
      this.dragActive = false;
      this.resetOffsets();

      if (this.pointerLocked) {
        void document.exitPointerLock();
      }
    }
  }

  update(recenterStrength: number) {
    if (!this.enabled && this.isCapturing) {
      this.dragActive = false;
      this.resetOffsets();
    }

    if (this.enabled && this.isCapturing) {
      this.yaw += this.lookSpeed * this.offsetX;
      this.pitch -= this.lookSpeed * this.offsetY;
      this.pitch = clamp(this.pitch, -1.54, 1.54);

      this.resetOffsets();
    }

    if (!this.isCapturing && recenterStrength > 0) {
      this.yaw = THREE.MathUtils.lerp(this.yaw, 0, recenterStrength);
      this.pitch = THREE.MathUtils.lerp(this.pitch, 0, recenterStrength);
    }
  }

  dispose() {
    if (document.pointerLockElement === this.domElement) {
      void document.exitPointerLock();
    }

    window.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('pointerdown', this.onPointerDown, true);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
  }

  private resetOffsets() {
    this.offsetX = 0;
    this.offsetY = 0;
  }

  private isInteractiveTarget(target: EventTarget | null) {
    return (
      target instanceof Element &&
      Boolean(
        target.closest('a, button, input, textarea, select, summary, [data-no-blackhole-drag]'),
      )
    );
  }

  private isInsideViewport(clientX: number, clientY: number) {
    const bounds = this.domElement.getBoundingClientRect();

    return (
      clientX >= bounds.left &&
      clientX <= bounds.right &&
      clientY >= bounds.top &&
      clientY <= bounds.bottom
    );
  }

  private togglePointerLock() {
    if (document.pointerLockElement === this.domElement) {
      void document.exitPointerLock();
      return;
    }

    void this.domElement.requestPointerLock();
  }

  private addMouseEventHandlers() {
    window.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('pointerdown', this.onPointerDown, true);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
  }

  private onContextMenu = (event: MouseEvent) => {
    if (!this.pointerLocked && !this.isInsideViewport(event.clientX, event.clientY)) {
      return;
    }

    event.preventDefault();
  };

  private onPointerDown = (event: PointerEvent) => {
    if (
      !this.enabled ||
      event.altKey ||
      !this.isInsideViewport(event.clientX, event.clientY) ||
      this.isInteractiveTarget(event.target)
    ) {
      return;
    }

    if (event.button === 2) {
      event.preventDefault();
      this.dragActive = false;
      this.resetOffsets();
      this.togglePointerLock();
      return;
    }

    if (event.button !== 0 || this.pointerLocked) {
      return;
    }

    event.preventDefault();
    this.dragActive = true;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
  };

  private onPointerMove = (event: PointerEvent) => {
    if (!this.enabled) return;

    if (this.pointerLocked) {
      this.offsetX += event.movementX;
      this.offsetY += event.movementY;
      return;
    }

    if (!this.dragActive) return;

    const nextX = event.clientX;
    const nextY = event.clientY;

    this.offsetX += nextX - this.lastX;
    this.offsetY += nextY - this.lastY;
    this.lastX = nextX;
    this.lastY = nextY;
  };

  private onPointerUp = (event: PointerEvent) => {
    if (event.button !== 0) {
      return;
    }

    this.dragActive = false;
    this.resetOffsets();
  };

  private onPointerLockChange = () => {
    const isLocked = document.pointerLockElement === this.domElement;

    this.pointerLocked = isLocked;
    this.dragActive = false;
    this.resetOffsets();
    this.domElement.style.cursor = isLocked ? 'none' : '';
  };

  private onBlur = () => {
    this.dragActive = false;
    this.resetOffsets();
  };
}

class KeyboardMoveControls {
  private activeKeys = new Set<string>();
  offset = new THREE.Vector3();
  velocity = new THREE.Vector3();

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.clear);
  }

  update(
    delta: number,
    distance: number,
    allowInput: boolean,
    recenterStrength: number,
    basis: { forward: THREE.Vector3; right: THREE.Vector3; up: THREE.Vector3 },
  ) {
    const acceleration = clamp(distance * 2.9, 2.4, 10.5);
    const damping = Math.exp(-delta * 3.1);
    const accelerationStep = acceleration * delta;

    if (allowInput) {
      if (this.activeKeys.has('KeyW')) {
        this.velocity.addScaledVector(basis.forward, accelerationStep);
      }
      if (this.activeKeys.has('KeyS')) {
        this.velocity.addScaledVector(basis.forward, -accelerationStep);
      }
      if (this.activeKeys.has('KeyA')) {
        this.velocity.addScaledVector(basis.right, -accelerationStep);
      }
      if (this.activeKeys.has('KeyD')) {
        this.velocity.addScaledVector(basis.right, accelerationStep);
      }
      if (this.activeKeys.has('Space')) {
        this.velocity.addScaledVector(basis.up, accelerationStep);
      }
      if (this.activeKeys.has('ShiftLeft') || this.activeKeys.has('ShiftRight')) {
        this.velocity.addScaledVector(basis.up, -accelerationStep);
      }
    }

    this.velocity.multiplyScalar(damping);
    this.offset.addScaledVector(this.velocity, delta);

    const maxOffset = THREE.MathUtils.lerp(32, 84, clamp((distance - 1.52) / 8.48, 0, 1));
    if (this.offset.length() > maxOffset) {
      this.offset.setLength(maxOffset);
      this.velocity.multiplyScalar(0.86);
    }

    if (!allowInput && recenterStrength > 0) {
      this.offset.lerp(new THREE.Vector3(0, 0, 0), recenterStrength);
      this.velocity.multiplyScalar(1 - clamp(recenterStrength * 1.4, 0, 0.92));
    }
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.clear);
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (!['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight'].includes(event.code))
      return;

    this.activeKeys.add(event.code);
    event.preventDefault();
  };

  private onKeyUp = (event: KeyboardEvent) => {
    if (!['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight'].includes(event.code))
      return;

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
  const friendTooltip = document.querySelector<HTMLElement>(FRIEND_TOOLTIP_SELECTOR);
  const friendTooltipType = friendTooltip?.querySelector<HTMLElement>(
    '[data-blackhole-friend-tooltip-type]',
  );
  const friendTooltipName = friendTooltip?.querySelector<HTMLElement>(
    '[data-blackhole-friend-tooltip-name]',
  );
  const friendTooltipDescription = friendTooltip?.querySelector<HTMLElement>(
    '[data-blackhole-friend-tooltip-description]',
  );
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
  const glowTextures = new Map<FriendPlanetType, THREE.Texture>();
  const planetGroup = new THREE.Group();
  const orbitGroup = new THREE.Group();
  overlayScene.add(planetGroup);
  orbitScene.add(orbitGroup);

  const friendPlanets: PlanetEntry[] = [];
  const clickablePlanetMeshes: THREE.Mesh[] = [];
  let hoveredFriendPlanet: FriendPlanet | null = null;
  let selectedPlanetEntry: PlanetEntry | null = null;
  let detailPlanetEntry: PlanetEntry | null = null;
  let focusPlanetEntry: PlanetEntry | null = null;
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
    const response = await fetch(`${import.meta.env.BASE_URL}friend.json`);

    if (!response.ok) {
      throw new Error(`Failed to load friend planets: ${response.status}`);
    }

    return (await response.json()) as FriendPlanet[];
  };

  const getPlanetGlowTexture = (type: FriendPlanetType) => {
    const existing = glowTextures.get(type);
    if (existing) {
      return existing;
    }

    const palette: Record<FriendPlanetType, string> = {
      cold: '#cfe9ff',
      cool: '#ffc28d',
      warm: '#9fd2ff',
      hot: '#ffb067',
    };

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;

    const context = canvas.getContext('2d');
    if (!context) {
      const fallback = new THREE.Texture();
      glowTextures.set(type, fallback);
      return fallback;
    }

    const gradient = context.createRadialGradient(64, 64, 8, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,255,255,0.85)');
    gradient.addColorStop(0.36, `${palette[type]}cc`);
    gradient.addColorStop(0.68, `${palette[type]}40`);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');

    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    glowTextures.set(type, texture);
    return texture;
  };

  const getPlanetRadius = (friend: FriendPlanet, fallbackRadius: number) => {
    const explicitRadius = friend.planet?.radius;

    if (
      typeof explicitRadius === 'number' &&
      Number.isFinite(explicitRadius) &&
      explicitRadius > 0
    ) {
      return THREE.MathUtils.clamp(explicitRadius / 22000, 0.16, 0.88);
    }

    return fallbackRadius;
  };

  const getPlanetColor = (value: string | undefined, fallback: string | THREE.Color) => {
    const color = fallback instanceof THREE.Color ? fallback.clone() : new THREE.Color(fallback);

    if (!value) {
      return color;
    }

    try {
      color.set(value);
    } catch {
      color.set(fallback);
    }

    return color;
  };

  const getPlanetTemperatureBand = (profile?: FriendPlanetProfile) => {
    const min = profile?.temperature?.min;
    const max = profile?.temperature?.max;
    const unit = profile?.temperature?.unit ?? 'C';

    if (typeof min !== 'number' || typeof max !== 'number') {
      return null;
    }

    const minKelvin = unit === 'K' ? min : min + 273.15;
    const maxKelvin = unit === 'K' ? max : max + 273.15;

    return {
      minKelvin,
      maxKelvin,
      averageKelvin: (minKelvin + maxKelvin) * 0.5,
    };
  };

  const colorToRgba = (color: THREE.Color, alpha: number) => {
    const normalizedAlpha = clamp(alpha, 0, 1);
    const r = Math.round(clamp(color.r, 0, 1) * 255);
    const g = Math.round(clamp(color.g, 0, 1) * 255);
    const b = Math.round(clamp(color.b, 0, 1) * 255);

    return `rgba(${r}, ${g}, ${b}, ${normalizedAlpha.toFixed(3)})`;
  };

  const formatPercent = (value: number) => `${Math.round(clamp(value, 0, 1) * 100)}%`;

  const getPlanetAppearanceProfile = (friend: FriendPlanet) => {
    const defaults: Record<
      FriendPlanetType,
      {
        surfaceBase: string;
        surfaceShadow: string;
        water: string;
        land: string;
        landSecondary: string;
        clouds: string;
        atmosphere: string;
        poles: string;
        equator: string;
        waterVisible: boolean;
      }
    > = {
      cold: {
        surfaceBase: '#d8ecff',
        surfaceShadow: '#173252',
        water: '#91cbff',
        land: '#b8d7f2',
        landSecondary: '#eef8ff',
        clouds: '#f6fbff',
        atmosphere: '#d7efff',
        poles: '#ffffff',
        equator: '#d6ebff',
        waterVisible: true,
      },
      cool: {
        surfaceBase: '#cd8c5d',
        surfaceShadow: '#30160f',
        water: '#6ca0c9',
        land: '#93573c',
        landSecondary: '#e0b182',
        clouds: '#fff1e1',
        atmosphere: '#ffd4a6',
        poles: '#fff4e8',
        equator: '#f0bb8a',
        waterVisible: false,
      },
      warm: {
        surfaceBase: '#5f8fe5',
        surfaceShadow: '#102040',
        water: '#86bcff',
        land: '#446cab',
        landSecondary: '#a8c6ff',
        clouds: '#f3f7ff',
        atmosphere: '#a9d0ff',
        poles: '#dde9ff',
        equator: '#9dc1ff',
        waterVisible: true,
      },
      hot: {
        surfaceBase: '#ff9158',
        surfaceShadow: '#280904',
        water: '#ac6550',
        land: '#bf3f21',
        landSecondary: '#ffd06a',
        clouds: '#ffe7cf',
        atmosphere: '#ffb172',
        poles: '#ffe6c7',
        equator: '#ffb26b',
        waterVisible: false,
      },
    };

    const palette = defaults[friend.type];
    const profile = friend.planet;
    const appearance = profile?.appearance;
    const surface = appearance?.surface;
    const water = appearance?.water;
    const land = appearance?.land;
    const clouds = appearance?.clouds;
    const atmosphereVisual = appearance?.atmosphere_visual;
    const poles = appearance?.poles;
    const equator = appearance?.equator;

    const baseColor = getPlanetColor(surface?.base_color ?? profile?.color, palette.surfaceBase);
    const shadowColor = getPlanetColor(
      surface?.shadow_color ?? profile?.background,
      palette.surfaceShadow,
    );
    const waterVisible = water?.is_show ?? palette.waterVisible;
    const waterColor = getPlanetColor(
      water?.color,
      baseColor.clone().lerp(new THREE.Color(palette.water), 0.64),
    );
    const landColor = getPlanetColor(
      land?.color,
      baseColor.clone().lerp(new THREE.Color(palette.land), 0.56),
    );
    const landSecondaryColor = getPlanetColor(
      land?.secondary_color,
      landColor.clone().lerp(new THREE.Color(palette.landSecondary), 0.42),
    );
    const cloudVisible = clouds?.is_show ?? profile?.atmosphere?.is_show ?? waterVisible;
    const cloudColor = getPlanetColor(clouds?.color, palette.clouds);
    const atmosphereVisible = atmosphereVisual?.is_show ?? profile?.atmosphere?.is_show ?? false;
    const atmosphereColor = getPlanetColor(atmosphereVisual?.color, palette.atmosphere);
    const poleVisible = poles?.is_show ?? friend.type !== 'hot';
    const poleColor = getPlanetColor(poles?.color, palette.poles);
    const equatorVisible = equator?.is_show ?? true;
    const equatorColor = getPlanetColor(equator?.color, palette.equator);

    return {
      baseColor,
      shadowColor,
      waterVisible,
      waterColor,
      waterCoverage: clamp(water?.coverage ?? 0.44, 0.05, 0.92),
      waterGloss: clamp(water?.gloss ?? 0.72, 0, 1),
      landColor,
      landSecondaryColor,
      landCoverage: clamp(land?.coverage ?? 0.58, 0.08, 0.96),
      terrainScale: clamp(surface?.terrain_scale ?? 6.4, 2, 18),
      terrainContrast: clamp(surface?.terrain_contrast ?? 0.42, 0.05, 0.95),
      cloudVisible,
      cloudColor,
      cloudOpacity: clamp(clouds?.opacity ?? 0.28, 0, 0.9),
      cloudCoverage: clamp(clouds?.coverage ?? 0.46, 0.08, 0.96),
      cloudSpeed: clamp(clouds?.speed ?? 0.18, 0, 1.5),
      atmosphereVisible,
      atmosphereColor,
      atmosphereIntensity: clamp(atmosphereVisual?.intensity ?? 0.56, 0, 1),
      atmosphereRimPower: clamp(atmosphereVisual?.rim_power ?? 2.8, 1.2, 6),
      poleVisible,
      poleColor,
      poleSize: clamp(poles?.size ?? 0.16, 0.03, 0.42),
      equatorVisible,
      equatorColor,
      equatorWidth: clamp(equator?.width ?? 0.08, 0.02, 0.24),
      equatorIntensity: clamp(equator?.intensity ?? 0.32, 0, 1),
    };
  };

  const getPlanetOrbitRadius = (friend: FriendPlanet, fallbackOrbitRadius: number) => {
    const distance = friend.planet?.orbit?.distance_from_star;
    const unit = friend.planet?.orbit?.distance_unit ?? 'AU';

    if (typeof distance !== 'number' || !Number.isFinite(distance) || distance <= 0) {
      return fallbackOrbitRadius;
    }

    const normalizedAu = unit === 'km' ? distance / 149_597_870.7 : distance;
    return clamp(3.9 + normalizedAu * 1.95, 4.2, 11.8);
  };

  const getPlanetOrbitSpeed = (friend: FriendPlanet, fallbackOrbitSpeed: number) => {
    const period = friend.planet?.orbit?.period;
    const unit = friend.planet?.orbit?.period_unit ?? 'days';

    if (typeof period !== 'number' || !Number.isFinite(period) || period <= 0) {
      return fallbackOrbitSpeed;
    }

    const periodDays = unit === 'years' ? period * 365 : period;
    const normalizedDays = clamp(periodDays, 40, 5000);
    return clamp(0.012 * Math.pow(365 / normalizedDays, 0.34), 0.0032, 0.0135);
  };

  const getPlanetRotationSpeed = (friend: FriendPlanet, fallbackRotationSpeed: number) => {
    const value = friend.planet?.physics?.rotation_speed;
    const unit = friend.planet?.physics?.rotation_unit ?? 'hours';

    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      return fallbackRotationSpeed;
    }

    const periodSeconds =
      unit === 'days' ? value * 86400 : unit === 'seconds' ? value : value * 3600;

    return clamp(((Math.PI * 2) / periodSeconds) * 1200, 0.02, 0.45);
  };

  const getPlanetAxialTilt = (friend: FriendPlanet) => {
    const axialTilt = friend.planet?.physics?.axial_tilt;

    if (typeof axialTilt !== 'number' || !Number.isFinite(axialTilt)) {
      return 0;
    }

    return THREE.MathUtils.degToRad(clamp(axialTilt, -65, 65));
  };

  const getPlanetShellAppearance = (friend: FriendPlanet, type: FriendPlanetType) => {
    const defaultShellColors: Record<FriendPlanetType, string> = {
      cold: '#e6f4ff',
      cool: '#ffd3ae',
      warm: '#d9efff',
      hot: '#ffd4aa',
    };

    const appearance = getPlanetAppearanceProfile(friend);
    const surfaceColor = getPlanetColor(friend.planet?.color, defaultShellColors[type]);
    const atmosphereVisible = appearance.atmosphereVisible;
    const pressure = friend.planet?.atmosphere?.pressure ?? 0;
    const shellOpacity = atmosphereVisible
      ? clamp(0.08 + pressure * 0.025 + appearance.atmosphereIntensity * 0.12, 0.1, 0.28)
      : 0.05;
    const glowOpacity = clamp(
      0.15 +
        (atmosphereVisible ? appearance.atmosphereIntensity * 0.16 : 0) +
        (type === 'hot' ? 0.06 : 0),
      0.16,
      0.38,
    );

    return {
      color: appearance.atmosphereColor.clone().lerp(surfaceColor, atmosphereVisible ? 0.36 : 0.62),
      shellOpacity,
      glowOpacity,
    };
  };

  const formatPlanetTemperature = (profile?: FriendPlanetProfile) => {
    const min = profile?.temperature?.min;
    const max = profile?.temperature?.max;
    const unit = profile?.temperature?.unit ?? 'C';

    if (typeof min === 'number' && typeof max === 'number') {
      return `${min} ~ ${max} ${unit}`;
    }

    return 'Unknown';
  };

  const formatPlanetAtmosphere = (profile?: FriendPlanetProfile) => {
    if (!profile?.atmosphere?.is_show) {
      return 'None';
    }

    const composition = profile.atmosphere.composition ?? 'Unknown';
    const pressure = profile.atmosphere.pressure;
    const pressureUnit = profile.atmosphere.pressure_unit ?? 'atm';

    if (typeof pressure === 'number') {
      return `${composition} / ${pressure} ${pressureUnit}`;
    }

    return composition;
  };

  const formatPlanetOrbit = (profile?: FriendPlanetProfile) => {
    if (!profile?.orbit?.is_show) {
      return 'Hidden';
    }

    const distance = profile.orbit.distance_from_star;
    const distanceUnit = profile.orbit.distance_unit ?? 'AU';
    const period = profile.orbit.period;
    const periodUnit = profile.orbit.period_unit ?? 'days';

    if (typeof distance === 'number' && typeof period === 'number') {
      return `${distance} ${distanceUnit} / ${period} ${periodUnit}`;
    }

    if (typeof distance === 'number') {
      return `${distance} ${distanceUnit}`;
    }

    return 'Unknown';
  };

  const formatPlanetWeight = (profile?: FriendPlanetProfile) => {
    const value = profile?.weight?.value;
    const unit = profile?.weight?.unit ?? 'kg';
    const scientificNotation = profile?.weight?.scientific_notation;

    if (typeof value === 'number' && scientificNotation) {
      return `${value} x ${scientificNotation} ${unit}`;
    }

    if (typeof value === 'number') {
      return `${value} ${unit}`;
    }

    return 'Unknown';
  };

  const formatPlanetRotation = (profile?: FriendPlanetProfile) => {
    const rotationSpeed = profile?.physics?.rotation_speed;
    const unit = profile?.physics?.rotation_unit ?? 'hours';

    if (typeof rotationSpeed !== 'number') {
      return 'Unknown';
    }

    return `${rotationSpeed} ${unit} / rotation`;
  };

  const formatPlanetTilt = (profile?: FriendPlanetProfile) => {
    const tilt = profile?.physics?.axial_tilt;

    if (typeof tilt !== 'number') {
      return '0°';
    }

    return `${tilt}°`;
  };

  const formatPlanetPoles = (friend: FriendPlanet) => {
    const appearance = getPlanetAppearanceProfile(friend);

    if (!appearance.poleVisible) {
      return 'Hidden';
    }

    return `${formatPercent(appearance.poleSize)} cap band`;
  };

  const formatPlanetEquator = (friend: FriendPlanet) => {
    const appearance = getPlanetAppearanceProfile(friend);

    if (!appearance.equatorVisible) {
      return 'None';
    }

    return `${formatPercent(appearance.equatorWidth)} width / ${formatPercent(appearance.equatorIntensity)} glow`;
  };

  const formatPlanetClouds = (friend: FriendPlanet) => {
    const appearance = getPlanetAppearanceProfile(friend);

    if (!appearance.cloudVisible || appearance.cloudOpacity <= 0.01) {
      return 'Clear';
    }

    return `${formatPercent(appearance.cloudCoverage)} cover / ${formatPercent(appearance.cloudOpacity)} opacity`;
  };

  const formatPlanetSurface = (friend: FriendPlanet) => {
    const appearance = getPlanetAppearanceProfile(friend);
    const waterSummary = appearance.waterVisible
      ? `water ${formatPercent(appearance.waterCoverage)}`
      : 'dry crust';

    return `${waterSummary} / land ${formatPercent(appearance.landCoverage)}`;
  };

  const getPlanetPreviewBackground = (friend: FriendPlanet) => {
    const appearance = getPlanetAppearanceProfile(friend);
    const background = colorToRgba(appearance.shadowColor, 0.96);
    const color = colorToRgba(appearance.baseColor, 0.92);
    const atmosphereGlow = colorToRgba(
      appearance.atmosphereColor,
      0.22 + appearance.atmosphereIntensity * 0.18,
    );

    return `radial-gradient(circle at 72% 28%, rgba(255,255,255,0.26), transparent 24%), radial-gradient(circle at 44% 38%, ${atmosphereGlow}, transparent 26%), linear-gradient(145deg, ${color}, ${background})`;
  };

  const applyPlanetPreviewAppearance = (friend: FriendPlanet) => {
    const appearance = getPlanetAppearanceProfile(friend);
    const axialTilt = friend.planet?.physics?.axial_tilt ?? 0;

    if (planetPanelPreviewAtmosphere) {
      planetPanelPreviewAtmosphere.style.background = `radial-gradient(circle at 50% 50%, ${colorToRgba(appearance.atmosphereColor, 0.08 + appearance.atmosphereIntensity * 0.08)}, transparent 58%), radial-gradient(circle at 50% 50%, ${colorToRgba(appearance.atmosphereColor, 0.18 + appearance.atmosphereIntensity * 0.22)}, transparent 72%)`;
      planetPanelPreviewAtmosphere.style.boxShadow = `0 0 28px ${colorToRgba(appearance.atmosphereColor, 0.12 + appearance.atmosphereIntensity * 0.16)}`;
      planetPanelPreviewAtmosphere.style.transform = `rotate(${axialTilt * 0.2}deg)`;
    }

    if (planetPanelPreviewPlanet) {
      planetPanelPreviewPlanet.style.background = `radial-gradient(circle at 34% 24%, ${colorToRgba(appearance.landSecondaryColor, 0.38)}, transparent 26%), linear-gradient(160deg, ${colorToRgba(appearance.baseColor, 1)}, ${colorToRgba(appearance.shadowColor, 1)})`;
      planetPanelPreviewPlanet.style.transform = `rotate(${axialTilt * 0.3}deg)`;
    }

    if (planetPanelPreviewWater) {
      planetPanelPreviewWater.style.background = `radial-gradient(circle at 30% 26%, ${colorToRgba(appearance.waterColor.clone().lerp(new THREE.Color('#ffffff'), appearance.waterGloss * 0.22), 0.84)}, transparent 28%), linear-gradient(150deg, ${colorToRgba(appearance.waterColor, appearance.waterVisible ? 0.94 : 0.2)}, ${colorToRgba(appearance.shadowColor, 0.82)})`;
      planetPanelPreviewWater.style.opacity = appearance.waterVisible ? '1' : '0.22';
    }

    if (planetPanelPreviewLand) {
      planetPanelPreviewLand.style.background = `radial-gradient(circle at 24% 36%, ${colorToRgba(appearance.landSecondaryColor, 0.95)}, transparent 38%), radial-gradient(circle at 72% 68%, ${colorToRgba(appearance.landColor, 0.92)}, transparent 34%), linear-gradient(135deg, ${colorToRgba(appearance.landColor, 0.98)}, ${colorToRgba(appearance.landSecondaryColor, 0.88)})`;
      planetPanelPreviewLand.style.opacity = appearance.landCoverage.toFixed(2);
    }

    if (planetPanelPreviewClouds) {
      planetPanelPreviewClouds.style.background = `radial-gradient(circle at 22% 44%, ${colorToRgba(appearance.cloudColor, 0.92)}, transparent 20%), radial-gradient(circle at 54% 28%, ${colorToRgba(appearance.cloudColor, 0.86)}, transparent 18%), radial-gradient(circle at 76% 64%, ${colorToRgba(appearance.cloudColor, 0.74)}, transparent 17%)`;
      planetPanelPreviewClouds.style.opacity = appearance.cloudVisible
        ? appearance.cloudOpacity.toFixed(2)
        : '0';
      planetPanelPreviewClouds.style.display = appearance.cloudVisible ? '' : 'none';
    }

    if (planetPanelPreviewEquator) {
      planetPanelPreviewEquator.style.background = `linear-gradient(90deg, transparent, ${colorToRgba(appearance.equatorColor, 0.28 + appearance.equatorIntensity * 0.42)}, transparent)`;
      planetPanelPreviewEquator.style.height = `${Math.max(6, appearance.equatorWidth * 28)}px`;
      planetPanelPreviewEquator.style.display = appearance.equatorVisible ? '' : 'none';
    }

    if (planetPanelPreviewPoleNorth) {
      planetPanelPreviewPoleNorth.style.background = `radial-gradient(circle at 50% 24%, ${colorToRgba(appearance.poleColor, 0.96)}, ${colorToRgba(appearance.poleColor.clone().lerp(appearance.shadowColor, 0.26), 0.52)})`;
      planetPanelPreviewPoleNorth.style.width = `${Math.max(18, appearance.poleSize * 84)}px`;
      planetPanelPreviewPoleNorth.style.display = appearance.poleVisible ? '' : 'none';
    }

    if (planetPanelPreviewPoleSouth) {
      planetPanelPreviewPoleSouth.style.background = `radial-gradient(circle at 50% 24%, ${colorToRgba(appearance.poleColor, 0.96)}, ${colorToRgba(appearance.poleColor.clone().lerp(appearance.shadowColor, 0.26), 0.52)})`;
      planetPanelPreviewPoleSouth.style.width = `${Math.max(18, appearance.poleSize * 84)}px`;
      planetPanelPreviewPoleSouth.style.display = appearance.poleVisible ? '' : 'none';
    }

    if (planetPanelPreviewRing) {
      const ringColor = getPlanetColor(friend.planet?.ring?.color, '#d7d1c4');
      planetPanelPreviewRing.style.borderColor = colorToRgba(ringColor, 0.46);
      planetPanelPreviewRing.style.boxShadow = `0 0 16px ${colorToRgba(ringColor, 0.12)}`;
      planetPanelPreviewRing.style.display = friend.planet?.ring?.is_show ? '' : 'none';
    }
  };

  const lerpAngle = (current: number, target: number, alpha: number) => {
    const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
    return current + delta * alpha;
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

  const syncPlanetDetailResolution = () => {
    let nextBoost = 1;
    const inspectionPlanet = detailPlanetEntry ?? focusPlanetEntry;

    if (getSceneName() === 'home' && inspectionPlanet && performanceConfig.quality === 'medium') {
      const inspectionPosition = inspectionPlanet.mesh.getWorldPosition(new THREE.Vector3());
      const inspectionDistance = observer.position.distanceTo(inspectionPosition);
      const inspectionThreshold = Math.max(inspectionPlanet.radius * 10, 3.4);

      if (inspectionDistance <= inspectionThreshold) {
        nextBoost = performanceConfig.resolution >= 1 ? 1.25 : 1.1;
      }
    }

    if (Math.abs(state.detailResolutionBoost - nextBoost) >= 0.01) {
      state.detailResolutionBoost = nextBoost;
      setDemoSize();
    }
  };

  const closePlanetInspection = () => {
    detailPlanetEntry = null;
    focusPlanetEntry = null;
    syncPlanetDetailResolution();
  };

  const setSelectedPlanet = (planetEntry: PlanetEntry | null) => {
    if (selectedPlanetEntry === planetEntry) {
      return;
    }

    if (detailPlanetEntry && detailPlanetEntry !== planetEntry) {
      closePlanetInspection();
      planetPanel?.setAttribute('hidden', '');
      planetPanel?.removeAttribute('data-active-planet');
    }

    selectedPlanetEntry = planetEntry;
  };

  const closePlanetPanel = () => {
    closePlanetInspection();
    selectedPlanetEntry = null;
    planetPanel?.setAttribute('hidden', '');
    planetPanel?.removeAttribute('data-active-planet');
  };

  const openPlanetInspection = (planetEntry: PlanetEntry) => {
    setSelectedPlanet(planetEntry);
    detailPlanetEntry = planetEntry;
    focusPlanetEntry = planetEntry;
    keyboardMoveControl.velocity.multiplyScalar(0.2);
    openPlanetPanel(planetEntry.data);
    syncPlanetDetailResolution();
  };

  const openPlanetPanel = (friend: FriendPlanet) => {
    if (!planetPanel) {
      return;
    }

    if (planetPanel.dataset.activePlanet === friend.name && !planetPanel.hasAttribute('hidden')) {
      return;
    }

    planetPanel.dataset.activePlanet = friend.name;

    planetPanel.removeAttribute('hidden');

    if (planetPanelType) {
      planetPanelType.textContent = `${friend.type} world`;
    }
    if (planetPanelName) {
      planetPanelName.textContent = friend.name;
    }
    if (planetPanelDescription) {
      planetPanelDescription.textContent = friend.description;
    }
    if (planetPanelStatType) {
      planetPanelStatType.textContent = friend.type;
    }
    if (planetPanelStatRadius) {
      planetPanelStatRadius.textContent = `${friend.planet?.radius ?? 'Unknown'} km`;
    }
    if (planetPanelStatTemperature) {
      planetPanelStatTemperature.textContent = formatPlanetTemperature(friend.planet);
    }
    if (planetPanelStatAtmosphere) {
      planetPanelStatAtmosphere.textContent = formatPlanetAtmosphere(friend.planet);
    }
    if (planetPanelStatOrbit) {
      planetPanelStatOrbit.textContent = formatPlanetOrbit(friend.planet);
    }
    if (planetPanelStatWeight) {
      planetPanelStatWeight.textContent = formatPlanetWeight(friend.planet);
    }
    if (planetPanelStatRotation) {
      planetPanelStatRotation.textContent = formatPlanetRotation(friend.planet);
    }
    if (planetPanelStatTilt) {
      planetPanelStatTilt.textContent = formatPlanetTilt(friend.planet);
    }
    if (planetPanelStatPoles) {
      planetPanelStatPoles.textContent = formatPlanetPoles(friend);
    }
    if (planetPanelStatEquator) {
      planetPanelStatEquator.textContent = formatPlanetEquator(friend);
    }
    if (planetPanelStatClouds) {
      planetPanelStatClouds.textContent = formatPlanetClouds(friend);
    }
    if (planetPanelStatSurface) {
      planetPanelStatSurface.textContent = formatPlanetSurface(friend);
    }
    if (planetPanelPreview) {
      planetPanelPreview.style.background = getPlanetPreviewBackground(friend);
    }
    applyPlanetPreviewAppearance(friend);
    if (planetPanelPreviewCopy) {
      planetPanelPreviewCopy.textContent = `${friend.name} overview`;
    }
    if (planetPanelLink) {
      planetPanelLink.href = friend.url;
    }
  };

  const createPlanetMaterial = (friend: FriendPlanet) => {
    const type = friend.type;
    const palettes: Record<
      FriendPlanetType,
      {
        dayA: string;
        dayB: string;
        night: string;
        rim: string;
        detailA: string;
        detailB: string;
        emission: string;
        emissionStrength: number;
      }
    > = {
      cold: {
        dayA: '#d8ecff',
        dayB: '#89b8df',
        night: '#0f1f38',
        rim: '#edf7ff',
        detailA: '#f6fbff',
        detailB: '#5e86ab',
        emission: '#99d9ff',
        emissionStrength: 0.02,
      },
      cool: {
        dayA: '#c88455',
        dayB: '#7a4026',
        night: '#1f0f0a',
        rim: '#ffd1a6',
        detailA: '#eab37f',
        detailB: '#5f2d1f',
        emission: '#ffb36b',
        emissionStrength: 0.03,
      },
      warm: {
        dayA: '#2f79d7',
        dayB: '#2f8a58',
        night: '#071526',
        rim: '#dff2ff',
        detailA: '#f6f2dc',
        detailB: '#1d5f43',
        emission: '#7ec8ff',
        emissionStrength: 0.01,
      },
      hot: {
        dayA: '#ff8f4a',
        dayB: '#71190f',
        night: '#220804',
        rim: '#ffd9a8',
        detailA: '#ffe16a',
        detailB: '#c2371e',
        emission: '#ff7a2f',
        emissionStrength: 0.18,
      },
    };

    const palette = palettes[type];
    const appearance = getPlanetAppearanceProfile(friend);
    const surfaceColor = appearance.baseColor;
    const shadowColor = appearance.shadowColor;
    const atmosphereVisible = appearance.atmosphereVisible;
    const temperatureBand = getPlanetTemperatureBand(friend.planet);
    const heatMix = temperatureBand
      ? clamp((temperatureBand.averageKelvin - 240) / 1200, 0, 1)
      : type === 'hot'
        ? 1
        : type === 'warm'
          ? 0.3
          : 0.12;
    const emissionStrength = clamp(
      palette.emissionStrength + heatMix * 0.12 + (atmosphereVisible ? 0.01 : 0),
      0.005,
      0.22,
    );
    const dayColorA = appearance.waterVisible
      ? appearance.waterColor
          .clone()
          .lerp(new THREE.Color('#ffffff'), 0.18 + appearance.waterGloss * 0.12)
      : surfaceColor.clone().lerp(new THREE.Color('#ffffff'), 0.18);
    const dayColorB = appearance.landColor.clone().lerp(shadowColor, 0.22);
    const nightColor = shadowColor.clone().multiplyScalar(0.96);
    const rimColor = appearance.atmosphereColor
      .clone()
      .lerp(
        new THREE.Color('#ffffff'),
        atmosphereVisible ? 0.32 + appearance.atmosphereIntensity * 0.3 : 0.14,
      );
    const detailColorA = appearance.landSecondaryColor
      .clone()
      .lerp(new THREE.Color('#fff4d6'), 0.12 + heatMix * 0.1);
    const detailColorB = shadowColor.clone().lerp(appearance.landColor, 0.26);
    const emissionColor = getPlanetColor(friend.planet?.ring?.color, palette.emission).lerp(
      surfaceColor,
      0.34,
    );

    return new THREE.ShaderMaterial({
      transparent: false,
      uniforms: {
        lightDirection: { value: new THREE.Vector3(0, 0, -1) },
        time: { value: 0 },
        dayColorA: { value: dayColorA },
        dayColorB: { value: dayColorB },
        nightColor: { value: nightColor },
        rimColor: { value: rimColor },
        detailColorA: { value: detailColorA },
        detailColorB: { value: detailColorB },
        emissionColor: { value: emissionColor },
        emissionStrength: { value: emissionStrength },
        waterColor: { value: appearance.waterColor },
        landColor: { value: appearance.landColor },
        landSecondaryColor: { value: appearance.landSecondaryColor },
        cloudColor: { value: appearance.cloudColor },
        atmosphereColor: { value: appearance.atmosphereColor },
        poleColor: { value: appearance.poleColor },
        equatorColor: { value: appearance.equatorColor },
        terrainScale: { value: appearance.terrainScale },
        terrainContrast: { value: appearance.terrainContrast },
        waterCoverage: { value: appearance.waterCoverage },
        waterGloss: { value: appearance.waterGloss },
        waterVisible: { value: appearance.waterVisible ? 1 : 0 },
        landCoverage: { value: appearance.landCoverage },
        cloudCoverage: { value: appearance.cloudCoverage },
        cloudOpacity: { value: appearance.cloudOpacity },
        cloudSpeed: { value: appearance.cloudSpeed },
        cloudVisible: { value: appearance.cloudVisible ? 1 : 0 },
        atmosphereIntensity: { value: appearance.atmosphereIntensity },
        atmosphereRimPower: { value: appearance.atmosphereRimPower },
        poleSize: { value: appearance.poleSize },
        poleVisible: { value: appearance.poleVisible ? 1 : 0 },
        equatorWidth: { value: appearance.equatorWidth },
        equatorIntensity: { value: appearance.equatorIntensity },
        equatorVisible: { value: appearance.equatorVisible ? 1 : 0 },
      },
      vertexShader: `
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        varying vec2 vUv;

        void main() {
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        varying vec2 vUv;

        uniform vec3 lightDirection;
        uniform float time;
        uniform vec3 dayColorA;
        uniform vec3 dayColorB;
        uniform vec3 nightColor;
        uniform vec3 rimColor;
        uniform vec3 detailColorA;
        uniform vec3 detailColorB;
        uniform vec3 emissionColor;
        uniform float emissionStrength;
        uniform vec3 waterColor;
        uniform vec3 landColor;
        uniform vec3 landSecondaryColor;
        uniform vec3 cloudColor;
        uniform vec3 atmosphereColor;
        uniform vec3 poleColor;
        uniform vec3 equatorColor;
        uniform float terrainScale;
        uniform float terrainContrast;
        uniform float waterCoverage;
        uniform float waterGloss;
        uniform float waterVisible;
        uniform float landCoverage;
        uniform float cloudCoverage;
        uniform float cloudOpacity;
        uniform float cloudSpeed;
        uniform float cloudVisible;
        uniform float atmosphereIntensity;
        uniform float atmosphereRimPower;
        uniform float poleSize;
        uniform float poleVisible;
        uniform float equatorWidth;
        uniform float equatorIntensity;
        uniform float equatorVisible;

        float hash(vec2 point) {
          return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float noise(vec2 point) {
          vec2 i = floor(point);
          vec2 f = fract(point);
          vec2 u = f * f * (3.0 - 2.0 * f);

          return mix(
            mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }

        float fbm(vec2 point) {
          float value = 0.0;
          float amplitude = 0.5;

          for (int i = 0; i < 5; i += 1) {
            value += noise(point) * amplitude;
            point = point * 2.03 + vec2(17.0, 9.0);
            amplitude *= 0.52;
          }

          return value;
        }

        void main() {
          vec3 normal = normalize(vWorldNormal);
          vec3 lightDir = normalize(lightDirection);
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          float diffuse = max(dot(normal, lightDir), 0.0);
          float wrappedLight = smoothstep(-0.18, 0.92, dot(normal, lightDir));
          float ambientFloor = 0.18;
          float litMix = ambientFloor + wrappedLight * (1.0 - ambientFloor);
          vec2 terrainUv = vec2(vUv.x * terrainScale, vUv.y * terrainScale * 1.24);
          float continentNoise = fbm(terrainUv + vec2(time * 0.003, 0.0));
          float detailNoise = fbm(vUv * (terrainScale * 2.7) + vec2(0.0, time * 0.002));
          float cloudNoise = fbm(vUv * (terrainScale * 1.45) + vec2(time * cloudSpeed * 0.08, time * cloudSpeed * 0.03));
          float bandNoise = sin(vUv.y * 18.0 + time * 0.3) * 0.5 + 0.5;
          float craterMask = smoothstep(0.62, 0.88, noise(vUv * 28.0));
          float waterMask = waterVisible * (1.0 - smoothstep(waterCoverage - 0.15, waterCoverage + terrainContrast * 0.25, continentNoise));
          float landMask = smoothstep(landCoverage - terrainContrast * 0.22, landCoverage + 0.08, continentNoise + detailNoise * 0.18);
          float poleMask = poleVisible * max(
            smoothstep(1.0 - poleSize * 1.35, 1.0 - poleSize * 0.22, abs(vUv.y - 0.5) * 2.0),
            0.0
          );
          float equatorMask = equatorVisible * (1.0 - smoothstep(equatorWidth, equatorWidth + 0.12, abs(vUv.y - 0.5)));
          float cloudMask = cloudVisible * smoothstep(cloudCoverage - 0.22, cloudCoverage + 0.12, cloudNoise) * cloudOpacity;
          vec3 oceanColor = mix(dayColorA, waterColor, 0.74);
          vec3 landBase = mix(landColor, landSecondaryColor, detailNoise);
          vec3 baseDay = mix(oceanColor, landBase, max(landMask, 1.0 - waterMask));
          vec3 detailColor = mix(detailColorA, detailColorB, detailNoise);
          vec3 dayColor = mix(baseDay, detailColor, 0.24 + terrainContrast * 0.26);
          dayColor = mix(dayColor, landSecondaryColor, bandNoise * equatorIntensity * 0.1);
          dayColor = mix(dayColor, detailColorB, craterMask * 0.18);
          dayColor = mix(dayColor, poleColor, poleMask * 0.78);
          dayColor = mix(dayColor, equatorColor, equatorMask * equatorIntensity * 0.46);
          dayColor = mix(dayColor, cloudColor, cloudMask * 0.68);
          vec3 litColor = mix(nightColor, dayColor, litMix);
          float silhouette = pow(1.0 - max(dot(normal, viewDir), 0.0), atmosphereRimPower);
          float terminator = pow(1.0 - wrappedLight, 1.8) * diffuse;
          float specular = pow(max(dot(reflect(-lightDir, normal), viewDir), 0.0), 18.0) * waterMask * waterGloss;
          vec3 emissionGlow = emissionColor * emissionStrength * (0.45 + bandNoise * 0.55) * (0.35 + diffuse * 0.65);
          vec3 finalColor = litColor + atmosphereColor * silhouette * atmosphereIntensity * 0.34 + rimColor * terminator * 0.08 + emissionGlow + waterColor * specular * 0.34;
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
    });
  };

  const createPlanetRing = (friend: FriendPlanet, planetRadius: number) => {
    const ring = friend.planet?.ring;

    if (!ring?.is_show) {
      return null;
    }

    const sourceRadius = friend.planet?.radius;
    const radiusRatio =
      typeof sourceRadius === 'number' && sourceRadius > 0
        ? 1 / sourceRadius
        : 1 / Math.max(planetRadius, 1);
    const innerScale = clamp((ring.inner_radius ?? 0) * radiusRatio || 1.28, 1.1, 2.8);
    const outerScale = clamp(
      (ring.outer_radius ?? 0) * radiusRatio || 1.62,
      innerScale + 0.08,
      3.4,
    );
    const ringColor = getPlanetColor(ring.color, '#d7d1c4');
    const geometry = new THREE.RingGeometry(
      planetRadius * innerScale,
      planetRadius * outerScale,
      96,
    );
    const material = new THREE.MeshBasicMaterial({
      color: ringColor,
      transparent: true,
      opacity: 0.48,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = Math.PI / 2;
    mesh.rotation.z = Math.PI * 0.18;
    mesh.renderOrder = 3;
    mesh.userData.baseOpacity = material.opacity;

    return mesh;
  };

  const buildFriendPlanetSystem = async () => {
    const friends = await loadFriendPlanets();
    const orbitBaseRadii = [4.8, 5.8, 6.9, 8.1];
    const orbitBandOffsets = [0, 0, 0, 0];

    friends.forEach((friend, index) => {
      const hash = hashString(friend.name);
      const band = getOrbitBand(friend.name);
      const fallbackOrbitRadius =
        orbitBaseRadii[band] + orbitBandOffsets[band] * 0.48 + ((hash % 11) / 10) * 0.12;
      orbitBandOffsets[band] += 1;
      const fallbackOrbitSpeed = 0.008 + (hash % 5) * 0.0016 + band * 0.0012;
      const defaultSize = 0.2 + ((hash >> 3) % 6) * 0.024 + (friend.type === 'hot' ? 0.03 : 0);
      const size = getPlanetRadius(friend, defaultSize);
      const orbitRadius = getPlanetOrbitRadius(friend, fallbackOrbitRadius);
      const orbitSpeed = getPlanetOrbitSpeed(friend, fallbackOrbitSpeed);
      const rotationSpeed = getPlanetRotationSpeed(friend, 0.06 + ((hash >> 2) % 7) * 0.018);
      const axialTilt = getPlanetAxialTilt(friend);
      const inclination = ((hash % 9) - 4) * 0.015;
      const initialAngle = THREE.MathUtils.lerp(Math.PI * 0.28, Math.PI * 0.56, (hash % 101) / 100);
      const hueShift = ((hash % 19) - 9) * 0.01;

      const pivot = new THREE.Group();
      pivot.rotation.z = inclination;
      planetGroup.add(pivot);

      const orbitPivot = new THREE.Group();
      orbitPivot.rotation.z = inclination;
      orbitGroup.add(orbitPivot);

      const anchor = new THREE.Group();
      pivot.add(anchor);

      const tiltGroup = new THREE.Group();
      tiltGroup.rotation.z = axialTilt;
      anchor.add(tiltGroup);

      const planetMaterial = createPlanetMaterial(friend);
      const planet = new THREE.Mesh(new THREE.SphereGeometry(size, 40, 40), planetMaterial);
      const shellAppearance = getPlanetShellAppearance(friend, friend.type);
      const shellMaterial = new THREE.MeshBasicMaterial({
        color: shellAppearance.color,
        transparent: true,
        opacity: shellAppearance.shellOpacity,
        depthWrite: false,
        side: THREE.BackSide,
      });
      const shell = new THREE.Mesh(new THREE.SphereGeometry(size * 1.04, 32, 32), shellMaterial);
      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: getPlanetGlowTexture(friend.type),
          color: shellAppearance.color.clone().lerp(new THREE.Color('#ffffff'), 0.3),
          transparent: true,
          opacity: shellAppearance.glowOpacity,
          depthWrite: false,
          depthTest: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      glow.scale.setScalar(size * 4.6);
      const ring = createPlanetRing(friend, size);
      const initialPosition = new THREE.Vector3(
        Math.cos(initialAngle) * orbitRadius,
        0,
        Math.sin(initialAngle) * orbitRadius,
      );
      planet.userData.friendPlanet = friend;
      planet.userData.tidalLocked = false;
      anchor.position.copy(initialPosition);
      planet.position.set(0, 0, 0);
      tiltGroup.add(planet);
      shell.position.set(0, 0, 0);
      anchor.add(shell);
      glow.position.set(0, 0, 0);
      anchor.add(glow);
      if (ring) {
        ring.position.set(0, 0, 0);
        tiltGroup.add(ring);
      }

      const orbitLine = createOrbitLine(orbitRadius);
      orbitLine.renderOrder = 2;
      orbitLine.frustumCulled = false;
      orbitLine.visible = friend.planet?.orbit?.is_show ?? true;
      orbitPivot.add(orbitLine);
      const orbitOccluder = new THREE.Mesh(
        new THREE.SphereGeometry(size * 1.02, 24, 24),
        new THREE.MeshBasicMaterial({ color: 0x000000 }),
      );
      orbitOccluder.material.colorWrite = false;
      orbitOccluder.renderOrder = 1;
      orbitOccluder.frustumCulled = false;
      orbitPivot.add(orbitOccluder);

      friendPlanets.push({
        data: friend,
        pivot,
        anchor,
        tiltGroup,
        mesh: planet,
        shell,
        glow,
        ring,
        orbitOccluder,
        shellBaseColor: shellAppearance.color,
        shellBaseOpacity: shellAppearance.shellOpacity,
        glowBaseOpacity: shellAppearance.glowOpacity,
        radius: size,
        orbitRadius,
        orbitSpeed,
        rotationSpeed,
        axialTilt,
        hueShift,
        phase: initialAngle + index * 0.18,
      });
      clickablePlanetMeshes.push(planet);
    });
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
  const homeBasePosition = new THREE.Vector3();
  const homeForward = new THREE.Vector3();
  const currentCameraPosition = new THREE.Vector3();
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
  const cameraLookTarget = new THREE.Vector3();
  const yawAdjustedLookTarget = new THREE.Vector3();
  const yawAdjustedRight = new THREE.Vector3();
  const pitchAxis = new THREE.Vector3();
  const focusPlanetPosition = new THREE.Vector3();
  const focusOutward = new THREE.Vector3();
  const focusDesiredPosition = new THREE.Vector3();
  const focusDesiredForward = new THREE.Vector3();
  const shellScaleTarget = new THREE.Vector3();

  const initialHomeForward = origin.clone().sub(observer.position).normalize();
  cameraControl.yaw = Math.atan2(initialHomeForward.x, -initialHomeForward.z);
  cameraControl.pitch = Math.asin(clamp(initialHomeForward.y, -1, 1));

  const getSceneTarget = (): SceneTarget => {
    const sceneName = getSceneName();

    if (sceneName === 'blog') {
      return {
        distance: 7.2,
        fov: 58,
        orbit: true,
        dragEnabled: false,
        dragRecenter: 0.18,
        keyboardRecenter: 0,
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
        keyboardRecenter: 0,
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
    const starfieldRotation = Math.max(emergeProgress, smoothstep(0.8, 1, state.scrollProgress));

    return {
      distance: THREE.MathUtils.lerp(10, 1.52, approachProgress),
      fov: THREE.MathUtils.lerp(90, 104, approachProgress * (1 - emergeProgress * 0.5)),
      orbit: false,
      dragEnabled: true,
      dragRecenter: 0,
      keyboardRecenter: 0,
      keyboardEnabled: true,
      autoYaw: 0,
      autoPitch: 0,
      forwardOffset: THREE.MathUtils.lerp(0, 14, emergeProgress),
      verticalOffset: THREE.MathUtils.lerp(0, -0.85, emergeProgress),
      rightOffset: 0,
      driftAmplitude: 0.72 * starfieldRotation,
      starYawSpeed: 0,
      storyReveal: smoothstep(0.72, 0.96, state.scrollProgress),
      riskVisibility:
        smoothstep(0.22, 0.38, state.scrollProgress) *
        (1 - smoothstep(0.56, 0.72, state.scrollProgress)),
    };
  };

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

    if (sceneName === 'home') {
      homeBasePosition.copy(homeBaseDirection).multiplyScalar(cameraConfig.distance);
      const isPlanetFocusTransitionActive = focusPlanetEntry !== null;

      cameraControl.setEnabled(target.dragEnabled && !isPlanetFocusTransitionActive);
      cameraControl.update(target.dragRecenter);

      homeForward.set(
        Math.sin(cameraControl.yaw) * Math.cos(cameraControl.pitch),
        Math.sin(cameraControl.pitch),
        -Math.cos(cameraControl.yaw) * Math.cos(cameraControl.pitch),
      );
      homeForward.normalize();

      right.crossVectors(homeForward, worldUp);
      if (right.lengthSq() <= 1e-6) {
        right.set(1, 0, 0);
      } else {
        right.normalize();
      }
      upVector.crossVectors(right, homeForward).normalize();

      currentCameraPosition.copy(homeBasePosition).add(keyboardMoveControl.offset);
      keyboardMoveControl.update(
        delta,
        currentCameraPosition.length(),
        target.keyboardEnabled && !isPlanetFocusTransitionActive,
        0,
        {
          forward: homeForward,
          right,
          up: worldUp,
        },
      );

      currentCameraPosition.copy(homeBasePosition).add(keyboardMoveControl.offset);
      friendPlanets.forEach((planetEntry) => {
        const worldPlanetPosition = planetEntry.mesh.getWorldPosition(new THREE.Vector3());
        const minimumDistance = planetEntry.radius + 0.72;
        const distanceToPlanet = currentCameraPosition.distanceTo(worldPlanetPosition);

        if (distanceToPlanet < minimumDistance) {
          const pushDirection = currentCameraPosition.clone().sub(worldPlanetPosition);

          if (pushDirection.lengthSq() <= 1e-6) {
            pushDirection.copy(homeForward).negate();
          }

          pushDirection.normalize();
          currentCameraPosition.copy(
            worldPlanetPosition.add(pushDirection.multiplyScalar(minimumDistance)),
          );
          keyboardMoveControl.velocity.multiplyScalar(0.24);
          openPlanetInspection(planetEntry);
        }
      });

      if (focusPlanetEntry) {
        const focusBlend = clamp(1 - Math.exp(-delta * 4.6), 0.08, 0.24);
        const focusDistance = clamp(focusPlanetEntry.radius * 2.9 + 0.64, 1.2, 2.2);

        focusPlanetEntry.mesh.getWorldPosition(focusPlanetPosition);
        focusOutward.copy(focusPlanetPosition);

        if (focusOutward.lengthSq() <= 1e-6) {
          focusOutward.copy(homeForward).negate();
        } else {
          focusOutward.normalize();
        }

        focusDesiredPosition
          .copy(focusPlanetPosition)
          .addScaledVector(focusOutward, focusDistance)
          .addScaledVector(worldUp, Math.max(0.08, focusPlanetEntry.radius * 0.2));

        currentCameraPosition.lerp(focusDesiredPosition, focusBlend);
        keyboardMoveControl.velocity.multiplyScalar(0.72);

        focusDesiredForward.copy(focusPlanetPosition).sub(currentCameraPosition);
        if (focusDesiredForward.lengthSq() > 1e-6) {
          focusDesiredForward.normalize();
          cameraControl.yaw = lerpAngle(
            cameraControl.yaw,
            Math.atan2(focusDesiredForward.x, -focusDesiredForward.z),
            focusBlend,
          );
          cameraControl.pitch = THREE.MathUtils.lerp(
            cameraControl.pitch,
            Math.asin(clamp(focusDesiredForward.y, -1, 1)),
            focusBlend,
          );
        }

        if (
          currentCameraPosition.distanceToSquared(focusDesiredPosition) <= 0.01 &&
          focusDesiredForward.angleTo(homeForward) <= 0.04
        ) {
          focusPlanetEntry = null;
        }
      }

      if (currentCameraPosition.lengthSq() > 0) {
        if (currentCameraPosition.length() < 2.1) {
          currentCameraPosition.setLength(2.1);
        } else if (currentCameraPosition.length() > 96) {
          currentCameraPosition.setLength(96);
        }
      }
      keyboardMoveControl.offset.copy(currentCameraPosition).sub(homeBasePosition);

      observer.position.copy(currentCameraPosition);
      observer.velocity.set(0, 0, 0);
      observer.up.copy(upVector);
      observer.direction.copy(homeForward);
      cameraLookTarget.copy(observer.position).add(observer.direction);
      observer.lookAt(cameraLookTarget);
      observer.updateMatrixWorld();
      syncPlanetDetailResolution();

      moveAnchor.copy(keyboardMoveControl.offset);
      pageHost?.style.setProperty('--story-reveal', target.storyReveal.toFixed(4));
      pageHost?.style.setProperty('--risk-visibility', target.riskVisibility.toFixed(4));
      return;
    }

    observer.distance = cameraConfig.distance;

    orbitUpAxis.copy(observerBaseUp).normalize();
    rotatedPosition.copy(observer.position);
    rotatedVelocity.copy(observer.velocity);

    orbitYawQuaternion.setFromAxisAngle(orbitUpAxis, target.autoYaw);
    rotatedPosition.applyQuaternion(orbitYawQuaternion);
    rotatedVelocity.applyQuaternion(orbitYawQuaternion);

    orbitPitchAxis.crossVectors(orbitUpAxis, rotatedPosition).normalize();
    if (orbitPitchAxis.lengthSq() > 0) {
      orbitPitchQuaternion.setFromAxisAngle(orbitPitchAxis, target.autoPitch);
      rotatedPosition.applyQuaternion(orbitPitchQuaternion);
      rotatedVelocity.applyQuaternion(orbitPitchQuaternion);
    }

    observer.position.copy(rotatedPosition);
    observer.velocity.copy(rotatedVelocity);
    observer.up.copy(observerBaseUp).applyQuaternion(orbitYawQuaternion);
    if (orbitPitchAxis.lengthSq() > 0) {
      observer.up.applyQuaternion(orbitPitchQuaternion);
    }

    rotatedPosition.add(keyboardMoveControl.offset);
    observer.position.copy(rotatedPosition);

    upVector.copy(observer.up).normalize();
    baseForward.copy(origin).sub(observer.position).normalize();
    right.crossVectors(baseForward, upVector).normalize();

    cameraControl.setEnabled(target.dragEnabled);
    cameraControl.update(target.dragRecenter);

    const driftOffset = target.rightOffset + Math.sin(state.time * 0.18) * target.driftAmplitude;
    const starYawOffset = state.time * target.starYawSpeed;
    const yawInfluence = target.dragEnabled ? 1 : 0;
    const yawOffset = cameraControl.yaw * yawInfluence;
    const pitchOffset = cameraControl.pitch * yawInfluence;

    lookTarget.copy(origin);
    lookTarget.addScaledVector(baseForward, target.forwardOffset);
    lookTarget.addScaledVector(upVector, target.verticalOffset);
    lookTarget.addScaledVector(right, driftOffset);
    lookTarget.add(moveAnchor);

    lookTarget.sub(observer.position);

    const yawQuaternion = new THREE.Quaternion().setFromAxisAngle(
      upVector,
      yawOffset + starYawOffset,
    );
    yawAdjustedLookTarget.copy(lookTarget).applyQuaternion(yawQuaternion);
    yawAdjustedRight.copy(right).applyQuaternion(yawQuaternion).normalize();
    pitchAxis.copy(yawAdjustedRight);
    const pitchQuaternion = new THREE.Quaternion().setFromAxisAngle(pitchAxis, pitchOffset);

    lookTarget.copy(yawAdjustedLookTarget);
    if (pitchAxis.lengthSq() > 0) {
      lookTarget.applyQuaternion(pitchQuaternion);
    }

    observer.direction.copy(lookTarget.normalize());
    cameraLookTarget.copy(observer.position).add(observer.direction);
    observer.lookAt(cameraLookTarget);
    observer.updateMatrixWorld();

    keyboardMoveControl.update(
      delta,
      observer.distance,
      target.keyboardEnabled,
      target.keyboardRecenter,
      {
        forward: observer.direction,
        right,
        up: upVector,
      },
    );
    moveAnchor.copy(keyboardMoveControl.offset);
    pageHost?.style.setProperty('--story-reveal', target.storyReveal.toFixed(4));
    pageHost?.style.setProperty('--risk-visibility', target.riskVisibility.toFixed(4));
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

    friendPlanets.forEach((planetEntry) => {
      const planetMaterial = planetEntry.mesh.material;

      if (!(planetMaterial instanceof THREE.ShaderMaterial)) {
        return;
      }

      const lightDirection = origin
        .clone()
        .sub(planetEntry.mesh.getWorldPosition(new THREE.Vector3()))
        .normalize();
      planetMaterial.uniforms.lightDirection.value.copy(lightDirection);
      planetMaterial.uniforms.time.value = state.time + planetEntry.hueShift * 20;
    });
  };

  const updateFriendPlanetSystem = (delta: number) => {
    if (getSceneName() !== 'home') {
      orbitGroup.visible = false;
      return;
    }

    orbitGroup.visible = true;

    friendPlanets.forEach((planetEntry) => {
      const angle = state.time * planetEntry.orbitSpeed + planetEntry.phase;

      planetEntry.anchor.position.set(
        Math.cos(angle) * planetEntry.orbitRadius,
        0,
        Math.sin(angle) * planetEntry.orbitRadius,
      );
      planetEntry.mesh.rotation.y += delta * planetEntry.rotationSpeed;
      planetEntry.shell.position.set(0, 0, 0);
      planetEntry.glow.position.set(0, 0, 0);
      planetEntry.ring?.position.set(0, 0, 0);
      planetEntry.orbitOccluder.position.copy(planetEntry.anchor.position);

      const shellMaterial = planetEntry.shell.material;
      const glowMaterial = planetEntry.glow.material;
      const isSelected = planetEntry === selectedPlanetEntry;

      shellScaleTarget.setScalar(isSelected ? 1.1 : 1);
      planetEntry.shell.scale.lerp(shellScaleTarget, isSelected ? 0.2 : 0.14);

      if (shellMaterial instanceof THREE.MeshBasicMaterial) {
        shellMaterial.color.copy(
          isSelected
            ? planetEntry.shellBaseColor.clone().lerp(new THREE.Color('#ffffff'), 0.5)
            : planetEntry.shellBaseColor,
        );
        shellMaterial.opacity = THREE.MathUtils.lerp(
          shellMaterial.opacity,
          isSelected
            ? Math.max(0.28, planetEntry.shellBaseOpacity + 0.08)
            : planetEntry.shellBaseOpacity,
          isSelected ? 0.2 : 0.14,
        );
      }

      if (glowMaterial instanceof THREE.SpriteMaterial) {
        glowMaterial.opacity = THREE.MathUtils.lerp(
          glowMaterial.opacity,
          isSelected
            ? Math.max(0.18, planetEntry.glowBaseOpacity - 0.06)
            : planetEntry.glowBaseOpacity,
          isSelected ? 0.18 : 0.12,
        );
      }

      const ringMaterial = planetEntry.ring?.material;
      if (ringMaterial instanceof THREE.MeshBasicMaterial) {
        const baseOpacity = (planetEntry.ring?.userData.baseOpacity as number | undefined) ?? 0.48;
        ringMaterial.opacity = THREE.MathUtils.lerp(
          ringMaterial.opacity,
          isSelected ? Math.min(baseOpacity + 0.14, 0.72) : baseOpacity,
          isSelected ? 0.16 : 0.12,
        );
      }
    });
  };

  const updatePlanetInteractivity = (event?: PointerEvent) => {
    const isHome = getSceneName() === 'home';

    if (cameraControl.isPointerLocked) {
      hoveredFriendPlanet = null;
      canvasMount.style.cursor = 'none';
      friendTooltip?.setAttribute('hidden', '');
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

    if (!friendTooltip || !hoveredFriendPlanet) {
      friendTooltip?.setAttribute('hidden', '');
      return;
    }

    if (friendTooltipType) {
      friendTooltipType.textContent = hoveredFriendPlanet.type;
    }
    if (friendTooltipName) {
      friendTooltipName.textContent = hoveredFriendPlanet.name;
    }
    if (friendTooltipDescription) {
      friendTooltipDescription.textContent = hoveredFriendPlanet.description;
    }

    if (!event) {
      friendTooltip.setAttribute('hidden', '');
      return;
    }

    friendTooltip.removeAttribute('hidden');

    const tooltipOffsetX = 18;
    const tooltipOffsetY = 18;
    friendTooltip.style.left = `${Math.min(window.innerWidth - 320, Math.max(16, event.clientX + tooltipOffsetX))}px`;
    friendTooltip.style.top = `${Math.min(window.innerHeight - 180, Math.max(16, event.clientY + tooltipOffsetY))}px`;
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
    friendTooltip?.setAttribute('hidden', '');
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
      setSelectedPlanet(null);
      return;
    }

    if (selectedPlanetEntry !== clickedPlanetEntry) {
      setSelectedPlanet(clickedPlanetEntry);
      return;
    }

    openPlanetInspection(clickedPlanetEntry);
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
  planetPanelClose?.addEventListener('click', closePlanetPanel);
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
      window.removeEventListener('pointermove', onPointerCanvasMove);
      window.removeEventListener('click', onCanvasClick);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('scroll', syncScrollState);
      window.removeEventListener('resize', onViewportChange);
      nightWarningConfirm?.removeEventListener('click', dismissNightWarning);
      planetPanelClose?.removeEventListener('click', closePlanetPanel);
      cameraControl.dispose();
      keyboardMoveControl.dispose();
      renderer.dispose();
      mesh.geometry.dispose();
      material.dispose();
      textures.forEach((texture) => texture?.dispose());
      glowTextures.forEach((texture) => texture.dispose());
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
