// Sample data: accelerating through the gears, braking, downshifts – in a loop.
// Used to preview themes without the game (picker, ?demo).

const RATIO = [0, 69.6, 25.6, 18.1, 13.4, 10.6]; // rad/s per m/s, from a DiRT 3 recording
const MAX = 6583;
const IDLE = 1200;
const RAD = 60 / (2 * Math.PI);

export function createDemo() {
  let gear = 1;
  let speed = 0; // m/s
  let phase = 'accel';
  let t = 0;
  let dist = 0;

  return function step(dt = 1 / 30) {
    t += dt;
    let throttle = 0;
    let brake = 0;
    if (phase === 'accel') {
      throttle = 1;
      speed += (gear <= 2 ? 6 : 4.2 / (gear - 1)) * dt;
      if (speed * RATIO[gear] * RAD >= MAX * 0.985) {
        if (gear < 5) gear++;
        else phase = 'brake';
      }
    } else {
      brake = 0.85;
      speed -= 11 * dt;
      while (gear > 1 && speed * RATIO[gear - 1] * RAD < MAX * 0.7) gear--;
      if (speed <= 8) phase = 'accel';
    }
    speed = Math.max(0, speed);
    dist += speed * dt;
    const rpm = Math.max(IDLE, Math.min(MAX, speed * RATIO[gear] * RAD));
    return {
      live: true,
      game: 'demo',
      speedKmh: speed * 3.6,
      rpm,
      maxRpm: MAX,
      gear,
      throttle,
      brake,
      clutch: 0,
      steer: Math.sin(t * 0.7) * 0.3,
      gLat: Math.sin(t * 0.9) * 0.7,
      gLon: phase === 'accel' ? 0.35 : -0.9,
      lapTime: t,
      lapDistance: dist,
      lap: 0,
      wheelsKmh: [0, 0, 0, 0],
    };
  };
}
