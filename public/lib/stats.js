// Stage statistics worked out on the screen from the frames it gets: top speed, highest g-force,
// average speed, a 0–100 km/h timer and a short speed history. A new stage (the clock going back,
// or a gap in the data) starts them over.

const HISTORY_S = 30;

export function createStats() {
  let st;
  const reset = () => {
    st = { top: 0, maxG: 0, avg: 0, sprint: null, sprintFrom: null, armed: true, last: -1, history: [] };
  };
  reset();

  return {
    /** Feed a frame; returns the current statistics. */
    update(f) {
      if (f.lapTime < st.last - 0.5) reset();
      st.last = f.lapTime;
      st.top = Math.max(st.top, f.speedKmh);
      st.maxG = Math.max(st.maxG, Math.hypot(f.gLat, f.gLon));
      st.avg = f.lapTime > 1 ? (f.lapDistance / f.lapTime) * 3.6 : 0;

      // 0–100 km/h: armed when (almost) stopped, timed from the moment the car moves
      if (f.speedKmh < 1) {
        st.armed = true;
        st.sprintFrom = null;
      } else if (st.armed && st.sprintFrom === null) {
        st.sprintFrom = f.lapTime;
      }
      if (st.armed && st.sprintFrom !== null && f.speedKmh >= 100) {
        st.sprint = f.lapTime - st.sprintFrom;
        st.armed = false;
      }

      const hist = st.history;
      if (!hist.length || f.lapTime - hist[hist.length - 1].t >= 0.2) hist.push({ t: f.lapTime, v: f.speedKmh });
      while (hist.length && f.lapTime - hist[0].t > HISTORY_S) hist.shift();
      return st;
    },
    reset,
  };
}
