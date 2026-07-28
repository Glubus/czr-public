import { describe, expect, it } from 'vitest';
import { buildRoundPointCurve, estimateRecordPoints, worldRecordScore } from './calculator';

describe('performance point calculator', () => {
	it('finds the world record in either ranking direction', () => {
		expect(worldRecordScore([10, 20, 15], 'higher_is_better')).toBe(20);
		expect(worldRecordScore([10, 20, 15], 'lower_is_better')).toBe(10);
	});

	it('estimates position and points without UI state', () => {
		expect(estimateRecordPoints(15, 100, [20, 10], 'higher_is_better')).toEqual({
			points: 38.02,
			position: 2
		});
		expect(estimateRecordPoints(15, null, [20, 10], 'higher_is_better')).toBeNull();
	});

	it('builds a reusable SVG curve model', () => {
		const curve = buildRoundPointCurve(20, 100, [10, 20], 'higher_is_better');
		expect(curve?.path.startsWith('M')).toBe(true);
		expect(curve?.markers.length).toBeGreaterThan(1);
		expect(curve?.maximumRound).toBe(20);
	});
});
