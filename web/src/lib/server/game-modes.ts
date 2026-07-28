const GAME_MODE_RULES = [
	['campaign speedrun', 'Campaign Speedrun'],
	['spec ops speedrun', 'Spec Ops'],
	['onslaught', 'Onslaught'],
	['gauntlet', 'Gauntlets'],
	['dead ops arcade', 'Dead Ops Arcade'],
	['tortured path', 'The Tortured Path'],
	['high rounds (survival)', 'Survival'],
	['iw boss speedrun', 'Boss Fights'],
	['super 30 speedrun', 'Super 30 Speedrun'],
	['super ee speedrun', 'Super Easter Egg']
] as const;

export function classifyGameMode(categoryNames: readonly string[]): string | null {
	const categories = categoryNames.join(' ').toLowerCase();
	return GAME_MODE_RULES.find(([needle]) => categories.includes(needle))?.[1] ?? null;
}
