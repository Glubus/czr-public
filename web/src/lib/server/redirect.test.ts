import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from './redirect';

describe('safeRedirectPath', () => {
	it('keeps an internal path with its query string', () => {
		expect(safeRedirectPath('/leaderboard?scope=following')).toBe('/leaderboard?scope=following');
	});

	it.each([
		'https://example.com',
		'//example.com',
		'/\\example.com',
		'/%5cexample.com',
		'javascript:alert(1)',
		'/safe\nLocation: https://example.com'
	])('rejects unsafe redirect target %s', (target) => {
		expect(safeRedirectPath(target)).toBe('/');
	});
});
