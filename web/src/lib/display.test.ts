import { describe, expect, it } from 'vitest';
import { categoryVariantLabel, formatDuration, formatRecordScore, playerInitials } from './display';

describe('playerInitials', () => {
	it('keeps the first two initials', () => {
		expect(playerInitials('Takeo Masaki')).toBe('TM');
	});

	it('handles a blank player name', () => {
		expect(playerInitials('   ')).toBe('');
	});
});

describe('categoryVariantLabel', () => {
	it('formats imported subrecord slugs', () => {
		expect(categoryVariantLabel({ zwrSubrecord: 'classic-gobblegum' })).toBe('Classic GobbleGum');
	});

	it('returns null when no subrecord exists', () => {
		expect(categoryVariantLabel({})).toBeNull();
	});

	it('hides default and malformed imported board identifiers', () => {
		expect(categoryVariantLabel({ zwrSubrecord: 'ALL' })).toBeNull();
		expect(
			categoryVariantLabel({
				zwrSubrecord: 'custom-extinct-the-last-compound-custom-ee-speedrun-bo3-ALL'
			})
		).toBeNull();
	});
});

describe('record score formatting', () => {
	it('shows minutes and seconds for imported millisecond scores', () => {
		expect(formatRecordScore(2_018_000, 'time', null)).toBe('33:38');
	});

	it('adds hours only when the duration reaches one hour', () => {
		expect(formatDuration(3_723_000)).toBe('1:02:03');
		expect(formatDuration(83_000)).toBe('1:23');
	});

	it('keeps the round label for round records', () => {
		expect(formatRecordScore(75, 'round')).toBe('Round 75');
	});
});
