import { describe, expect, it } from 'vitest';
import { classifyGameMode } from './game-modes';

describe('classifyGameMode', () => {
	it.each([
		[['Campaign Speedrun'], 'Campaign Speedrun'],
		[['SPEC OPS SPEEDRUN'], 'Spec Ops'],
		[['High Rounds (Survival)'], 'Survival'],
		[['IW Boss Speedrun'], 'Boss Fights'],
		[['Super EE Speedrun'], 'Super Easter Egg']
	])('classifies %j as %s', (categories, expected) => {
		expect(classifyGameMode(categories)).toBe(expected);
	});

	it('keeps standard map categories in the map list', () => {
		expect(classifyGameMode(['High Round', 'No Power'])).toBeNull();
	});
});
