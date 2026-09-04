const SMALL_STEP = 500_000_00;
const LARGE_STEP = 1_000_000_00;
const SMALL_LIMIT = 5_000_000_00;

function stepAt(cents: number): number {
  return cents < SMALL_LIMIT ? SMALL_STEP : LARGE_STEP;
}

export function nextMilestone(cents: number): number {
  const step = stepAt(cents);
  return (Math.floor(cents / step) + 1) * step;
}

export function crossedMilestones(previous: number, current: number): number[] {
  const crossed: number[] = [];
  let m = nextMilestone(previous);
  while (m <= current) {
    crossed.push(m);
    m = nextMilestone(m);
  }
  return crossed;
}
