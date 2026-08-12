import * as THREE from "three";
import { assertNever, type BotState, type Expression } from "./state";
import type { EyeMark, ParsedMark } from "./mark";
import { createPebbleGeometry, surfacePoint } from "./pebbleGeometry";

const HEAD_COLOR = 0x0a0a0a;
const DEPTH_RATIO = 0.92;

type EyeRig = {
  group: THREE.Group;
  mesh: THREE.Mesh;
  rest: THREE.Vector3;
  normal: THREE.Vector3;
  tangentX: THREE.Vector3;
  tangentY: THREE.Vector3;
};

export class GrokBot {
  readonly group = new THREE.Group();
  readonly minY: number;

  private readonly bounce = new THREE.Group();
  private readonly pose = new THREE.Group();
  private readonly motion = new THREE.Group();
  private readonly squash = new THREE.Group();
  private readonly leftEye: EyeRig;
  private readonly rightEye: EyeRig;

  private time = 0;
  private spinYaw = 0;
  private nodT = -1;
  private waveT = -1;
  private blinkT = -1;
  private lastNod = 0;
  private lastWave = 0;
  private lastBlink = 0;
  private openness = 1;
  private lookX = 0;
  private lookY = 0;

  private nextAutoBlink = 2.6;

  constructor(mark: ParsedMark) {
    const pebble = createPebbleGeometry({
      points: mark.headPoints,
      depthRatio: DEPTH_RATIO,
    });

    const head = new THREE.Mesh(
      pebble.geometry,
      new THREE.MeshPhysicalMaterial({
        color: HEAD_COLOR,
        roughness: 0.48,
        metalness: 0.04,
        clearcoat: 0.28,
        clearcoatRoughness: 0.42,
        sheen: 0.35,
        sheenRoughness: 0.55,
        sheenColor: new THREE.Color("#2a2a2a"),
        envMapIntensity: 0.7,
      }),
    );
    head.castShadow = true;
    head.receiveShadow = true;

    this.leftEye = this.createEye(mark.eyes[0], head, pebble.lut, pebble.depth);
    this.rightEye = this.createEye(mark.eyes[1], head, pebble.lut, pebble.depth);

    this.squash.add(head, this.leftEye.group, this.rightEye.group);
    this.motion.add(this.squash);
    this.pose.add(this.motion);
    this.bounce.add(this.pose);
    this.group.add(this.bounce);

    const bounds = new THREE.Box3().setFromObject(this.group);
    this.minY = bounds.min.y;
  }

  update(dt: number, state: BotState): void {
    this.time += dt;
    this.consumeTokens(state);

    if (this.nodT >= 0) {
      this.nodT += dt / 0.58;
      if (this.nodT >= 1) {
        this.nodT = -1;
      }
    }
    if (this.waveT >= 0) {
      this.waveT += dt / 0.72;
      if (this.waveT >= 1) {
        this.waveT = -1;
      }
    }
    if (this.blinkT >= 0) {
      this.blinkT += dt / 0.28;
      if (this.blinkT >= 1) {
        this.blinkT = -1;
      }
    }

    if (state.spin) {
      this.spinYaw += dt * 1.15;
    }

    if (state.expression === "idle" && this.blinkT < 0) {
      this.nextAutoBlink -= dt;
      if (this.nextAutoBlink <= 0) {
        this.blinkT = 0;
        this.nextAutoBlink = 2.7 + (this.time % 1.4);
      }
    }

    const expression = eyeTargets(state.expression);
    const oneShotBlink = this.blinkAmount();
    const targetOpen = Math.min(expression.openness, 1 - oneShotBlink * 0.94);
    this.openness += (targetOpen - this.openness) * Math.min(1, dt * 14);

    const look = lookOffset(state.expression, this.time);
    this.lookX += (look.x - this.lookX) * Math.min(1, dt * 4.2);
    this.lookY += (look.y - this.lookY) * Math.min(1, dt * 4.2);

    this.applyEyes(expression.squintRot);

    const breath = 1 + 0.016 * Math.sin(this.time * 1.35);
    const happySquash = state.expression === "happy" ? 0.955 : 1;
    const happyStretch = state.expression === "happy" ? 1.05 : 1;
    this.squash.scale.set(
      breath * happyStretch,
      breath * happySquash,
      breath,
    );

    const wobbleX = 0.028 * Math.sin(this.time * 0.72);
    const wobbleZ = 0.02 * Math.sin(this.time * 0.91 + 0.8);
    const nod = this.nodAmount();
    const wave = this.waveAmount();

    this.motion.rotation.set(
      wobbleX + nod.pitch + look.headPitch,
      look.headYaw,
      wobbleZ + wave.roll,
    );
    this.motion.position.y = wave.hop;

    this.pose.rotation.set(state.pitch, state.yaw + this.spinYaw, 0);
    this.pose.scale.setScalar(state.scale);

    const bounce = state.bounce ? Math.abs(Math.sin(this.time * 3.15)) * 0.14 : 0;
    this.bounce.position.y = bounce;
  }

  resetMotion(): void {
    this.spinYaw = 0;
    this.nodT = -1;
    this.waveT = -1;
    this.blinkT = -1;
    this.time = 0;
    this.openness = 1;
    this.lookX = 0;
    this.lookY = 0;
    this.nextAutoBlink = 2.6;
  }

  private consumeTokens(state: BotState): void {
    if (state.nodToken !== this.lastNod) {
      this.lastNod = state.nodToken;
      this.nodT = 0;
    }
    if (state.waveToken !== this.lastWave) {
      this.lastWave = state.waveToken;
      this.waveT = 0;
    }
    if (state.blinkToken !== this.lastBlink) {
      this.lastBlink = state.blinkToken;
      this.blinkT = 0;
    }
  }

  private applyEyes(squintRot: number): void {
    this.placeEye(this.leftEye, squintRot);
    this.placeEye(this.rightEye, -squintRot * 0.15);
  }

  private placeEye(eye: EyeRig, extraRot: number): void {
    eye.group.position.copy(eye.rest);
    eye.group.position.addScaledVector(eye.tangentX, this.lookX);
    eye.group.position.addScaledVector(eye.tangentY, this.lookY);
    eye.mesh.scale.set(this.openness, 1, 1);
    eye.mesh.rotation.z = extraRot;
  }

  private nodAmount(): { pitch: number } {
    if (this.nodT < 0) {
      return { pitch: 0 };
    }
    const envelope = Math.sin(this.nodT * Math.PI);
    return { pitch: -0.3 * Math.sin(this.nodT * Math.PI * 2.2) * envelope };
  }

  private waveAmount(): { roll: number; hop: number } {
    if (this.waveT < 0) {
      return { roll: 0, hop: 0 };
    }
    const envelope = Math.sin(this.waveT * Math.PI);
    return {
      roll: 0.38 * Math.sin(this.waveT * Math.PI * 3) * envelope,
      hop: 0.07 * envelope,
    };
  }

  private blinkAmount(): number {
    if (this.blinkT < 0) {
      return 0;
    }
    const t = this.blinkT;
    if (t < 0.35) {
      return t / 0.35;
    }
    if (t < 0.5) {
      return 1;
    }
    if (t < 0.85) {
      return 1 - (t - 0.5) / 0.35;
    }
    return 0;
  }

  private createEye(
    mark: EyeMark,
    head: THREE.Mesh,
    lut: Float32Array,
    depth: number,
  ): EyeRig {
    head.updateMatrixWorld(true);
    const raycaster = new THREE.Raycaster();
    raycaster.set(
      new THREE.Vector3(mark.centroid.x, mark.centroid.y, 5),
      new THREE.Vector3(0, 0, -1),
    );
    const hit = raycaster.intersectObject(head)[0];
    const analytic = surfacePoint(lut, depth, mark.centroid.x, mark.centroid.y);
    const position = hit?.point.clone() ?? analytic.position;
    const normal = hit?.normal?.clone().normalize() ?? analytic.normal;

    const radius = Math.max(0.088, mark.width * 0.54);
    const shaft = Math.max(0.1, mark.length - mark.width * 0.88);
    const geometry = new THREE.CapsuleGeometry(radius, shaft, 10, 24);
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.28,
        metalness: 0,
        emissive: 0xffffff,
        emissiveIntensity: 0.62,
        clearcoat: 0.15,
        clearcoatRoughness: 0.4,
        toneMapped: false,
      }),
    );
    mesh.castShadow = true;
    mesh.renderOrder = 2;

    const tilt = Math.atan2(mark.axis.y, mark.axis.x) - Math.PI / 2;
    const tangentY = new THREE.Vector3(mark.axis.x, mark.axis.y, 0).normalize();
    const tangentX = new THREE.Vector3(-mark.axis.y, mark.axis.x, 0).normalize();
    const rest = position.addScaledVector(normal, radius * 0.72);

    const group = new THREE.Group();
    group.position.copy(rest);
    group.rotation.z = tilt;
    group.add(mesh);

    return { group, mesh, rest, normal, tangentX, tangentY };
  }
}

function eyeTargets(expression: Expression): { openness: number; squintRot: number } {
  switch (expression) {
    case "idle":
      return { openness: 1, squintRot: 0 };
    case "happy":
      return { openness: 0.36, squintRot: 0.16 };
    case "blink":
      return { openness: 0.08, squintRot: 0 };
    case "look-around":
      return { openness: 1, squintRot: 0 };
    default:
      return assertNever(expression);
  }
}

function lookOffset(
  expression: Expression,
  time: number,
): { x: number; y: number; headYaw: number; headPitch: number } {
  if (expression !== "look-around") {
    return { x: 0, y: 0, headYaw: 0, headPitch: 0 };
  }
  const x = Math.sin(time * 0.85) * 0.075;
  const y = Math.sin(time * 0.52 + 1.1) * 0.05;
  return {
    x,
    y,
    headYaw: x * 1.6,
    headPitch: -y * 1.1,
  };
}
