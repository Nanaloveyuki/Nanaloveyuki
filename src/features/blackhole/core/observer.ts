import * as THREE from 'three';

export class Observer extends THREE.PerspectiveCamera {
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
