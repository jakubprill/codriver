// Telemetry state: the latest frame, learning max RPM, detecting gaps.

/**
 * @typedef {object} Frame
 * @property {string} game
 * @property {number} t
 * @property {number} lapTime       s
 * @property {number} lapDistance   m
 * @property {number} speedKmh
 * @property {number} rpm
 * @property {number} maxRpm        0 = not provided by the game
 * @property {number} gear          0 = neutral; reverse depends on the game
 * @property {number} throttle      0..1
 * @property {number} brake         0..1
 * @property {number} clutch        0..1
 * @property {number} steer         -1..1
 * @property {number} gLat
 * @property {number} gLon
 * @property {number} lap
 * @property {number[]} wheelsKmh
 */

const GAP_RESET_MS = 5000;   // gap = new stage / different car
const LIVE_MS = 1000;

export class TelemetryState {
  constructor(now = () => Date.now()) {
    this.now = now;
    this.latest = null;
    this.packets = 0;
    this.lastPacketAt = 0;
    this.learnedMaxRpm = 0;
  }

  /** @param {Frame} frame */
  push(frame) {
    const t = this.now();
    if (t - this.lastPacketAt > GAP_RESET_MS) this.learnedMaxRpm = 0;
    this.lastPacketAt = t;
    this.packets++;
    if (frame.rpm > this.learnedMaxRpm && frame.rpm < 25000) this.learnedMaxRpm = frame.rpm;
    this.latest = frame;
  }

  get live() {
    return this.lastPacketAt > 0 && this.now() - this.lastPacketAt < LIVE_MS;
  }

  /** Frame for the browser: use the game's max RPM if it provides one, otherwise the learned value. */
  snapshot() {
    if (!this.live || !this.latest) return { live: false };
    const maxRpm = this.latest.maxRpm || this.learnedMaxRpm;
    return { live: true, ...this.latest, maxRpm };
  }

  status() {
    return {
      packets: this.packets,
      lastPacketAgoMs: this.lastPacketAt ? this.now() - this.lastPacketAt : null,
      game: this.latest?.game ?? null,
    };
  }
}
