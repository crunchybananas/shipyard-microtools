// A reading pause never overwrites an explicit speed choice.
export function createReadingClock(initial = 1) {
  let speed = initial, reading = false, returnSpeed = null;
  return {
    get speed() { return speed; },
    get held() { return returnSpeed !== null; },
    choose(value) { speed = value; returnSpeed = null; return speed; },
    reset(value) { speed = value; reading = false; returnSpeed = null; },
    observe(open) {
      if (open && !reading && speed > 0) { returnSpeed = speed; speed = 0; }
      if (!open && reading && returnSpeed !== null) { speed = returnSpeed; returnSpeed = null; }
      reading = !!open;
      return speed;
    },
  };
}
