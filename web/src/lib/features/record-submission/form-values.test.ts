import { describe, expect, it } from 'vitest';
import { isHttpProofUrl, parseRunDuration } from './form-values';

describe('record submission form values', () => {
	it.each([
		['31:15', 1_875_000],
		['1:02:03', 3_723_000],
		['45', 45_000]
	])('parses %s as milliseconds', (value, expected) => {
		expect(parseRunDuration(value)).toBe(expected);
	});

	it.each(['', '0', '1:60', '1:2:3:4', '-1', 'not-a-duration'])(
		'rejects invalid duration %s',
		(value) => {
			expect(parseRunDuration(value)).toBeNull();
		}
	);

	it('only accepts HTTP proof URLs', () => {
		expect(isHttpProofUrl('https://youtube.com/watch?v=test')).toBe(true);
		expect(isHttpProofUrl('http://example.test/proof')).toBe(true);
		expect(isHttpProofUrl('javascript:alert(1)')).toBe(false);
		expect(isHttpProofUrl('not a url')).toBe(false);
	});
});
