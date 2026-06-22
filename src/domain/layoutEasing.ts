/**
 * Frame-rate-independent exponential approach toward `target`. `tau` is the
 * approximate time (s) to close ~63% of the remaining distance; ~0.6 gives a
 * smooth settle in roughly that long. Never overshoots regardless of `dt`. Pure.
 */
export function approach(
  current: number,
  target: number,
  dt: number,
  tau: number
): number {
  if (tau <= 0) return target;
  const k = 1 - Math.exp(-dt / tau);
  return current + (target - current) * Math.min(1, Math.max(0, k));
}
