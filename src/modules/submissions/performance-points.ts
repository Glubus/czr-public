const PERFORMANCE_TOP_RECORDS = 50;

/**
 * The top fifty records decay by 2%; the remaining records can contribute at
 * most one ninth of that top block. This makes the scoring rule deterministic
 * and independent from persistence or HTTP.
 */
export function calculatePerformancePoints(recordPoints: ReadonlyArray<number>) {
  const contributions = calculatePerformancePointContributions(recordPoints);
  return Number(contributions.reduce((total, points) => total + points, 0).toFixed(2));
}

export function calculatePerformancePointContributions(recordPoints: ReadonlyArray<number>) {
  const ordered = [...recordPoints].sort((left, right) => right - left);
  const top = ordered.slice(0, PERFORMANCE_TOP_RECORDS).map(
    (points, index) => points * Math.pow(0.98, index),
  );
  const tail = ordered.slice(PERFORMANCE_TOP_RECORDS).map(
    (points, index) => points * 0.5 * Math.pow(0.9, index),
  );
  const topTotal = top.reduce((total, points) => total + points, 0);
  const tailTotal = tail.reduce((total, points) => total + points, 0);
  const tailScale = tailTotal > 0 ? Math.min(1, (topTotal / 9) / tailTotal) : 1;
  return [...top, ...tail.map((points) => points * tailScale)];
}
