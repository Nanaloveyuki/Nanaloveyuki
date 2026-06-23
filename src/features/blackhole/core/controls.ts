import * as THREE from 'three';

import { clamp } from '@blackhole/math';
import type { ControlBasis } from '@blackhole/types';

export class CameraDragControls {
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

export class KeyboardMoveControls {
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
    basis: ControlBasis,
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
