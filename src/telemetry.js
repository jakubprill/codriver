// Stan telemetrii: ostatnia ramka, uczenie się maksymalnych obrotów, wykrywanie przerwy.

/**
 * @typedef {object} Frame
 * @property {string} game
 * @property {number} t
 * @property {number} lapTime       s
 * @property {number} lapDistance   m
 * @property {number} speedKmh
 * @property {number} rpm
 * @property {number} maxRpm        0 = gra nie podaje
 * @property {number} gear          0 = luz; wsteczny zależy od gry
 * @property {number} throttle      0..1
 * @property {number} brake         0..1
 * @property {number} clutch        0..1
 * @property {number} steer         -1..1
 * @property {number} gLat
 * @property {number} gLon
 * @property {number} lap
 * @property {number[]} wheelsKmh
 */

const GAP_RESET_MS = 5000;   // przerwa = nowy odcinek / inne auto
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

  /** Ramka dla przeglądarki: gra podaje max obrotów → bierzemy jej, inaczej wyuczone. */
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
