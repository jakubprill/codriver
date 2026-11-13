// Codemasters "motion" UDP telemetry (DiRT 3, DiRT Rally, GRID, F1 2010–2017 and related games).
// The packet is an array of little-endian float32. The first 38 fields are shared by the whole
// family; DiRT Rally with extradata=3 adds more (including max RPM).
// DiRT 3 indices were verified on a recorded drive – see docs/telemetry/codemasters.md.

const RAD_S_TO_RPM = 60 / (2 * Math.PI);

export const FIELDS = {
  time: 0,
  lapTime: 1,
  lapDistance: 2,
  totalDistance: 3,
  posX: 4, posY: 5, posZ: 6,
  speed: 7,                  // m/s
  wheelSpeed: [25, 26, 27, 28],
  throttle: 29,
  steer: 30,
  brake: 31,
  clutch: 32,
  gear: 33,
  gLat: 34,
  gLon: 35,                  // may be -inf at the start
  lap: 36,
  engineRate: 37,            // DiRT 3: rad/s; DiRT Rally: RPM ÷ 10 (detected below)
  // DiRT Rally / extradata=3 only (66 fields):
  maxRpm: 63,                // RPM ÷ 10
  maxGears: 65,
};

const fin = (v) => (Number.isFinite(v) ? v : 0);

/**
 * Turns a raw packet into the common telemetry frame.
 * @param {Buffer} buf
 * @returns {import('../telemetry.js').Frame}
 */
export function parse(buf) {
  const n = buf.length >> 2;
  const f = (i) => (i < n ? buf.readFloatLE(i * 4) : 0);
  const extended = n >= 64;

  // DiRT 3 reports engine rate in rad/s (idle 125.66 = 1200 RPM).
  // DiRT Rally reports RPM ÷ 10. We tell them apart by packet length.
  const rawRate = fin(f(FIELDS.engineRate));
  const rpm = extended ? rawRate * 10 : rawRate * RAD_S_TO_RPM;

  return {
    game: extended ? 'dirt-rally' : 'dirt3',
    t: fin(f(FIELDS.time)),
    lapTime: fin(f(FIELDS.lapTime)),
    lapDistance: fin(f(FIELDS.lapDistance)),
    speedKmh: fin(f(FIELDS.speed)) * 3.6,
    rpm,
    maxRpm: extended ? fin(f(FIELDS.maxRpm)) * 10 : 0,
    gear: Math.round(fin(f(FIELDS.gear))),
    throttle: fin(f(FIELDS.throttle)),
    brake: fin(f(FIELDS.brake)),
    clutch: fin(f(FIELDS.clutch)),
    steer: fin(f(FIELDS.steer)),
    gLat: fin(f(FIELDS.gLat)),
    gLon: fin(f(FIELDS.gLon)),
    lap: fin(f(FIELDS.lap)),
    wheelsKmh: FIELDS.wheelSpeed.map((i) => fin(f(i)) * 3.6),
  };
}

export default {
  id: 'codemasters',
  name: 'Codemasters (DiRT 3, DiRT Rally)',
  defaultPort: 20777,
  minPacketBytes: 38 * 4,
  parse,
};
