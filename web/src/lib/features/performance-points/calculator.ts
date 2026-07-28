export type RankingDirection = 'higher_is_better' | 'lower_is_better';

export type PointEstimate = { points: number; position: number };

export type PointCurve = {
	path: string;
	markers: Array<{ x: number; y: number; round: number; points: number }>;
	maximumRound: number;
	maxPoints: number;
	left: number;
	right: number;
	top: number;
	bottom: number;
	targetX: number;
	targetY: number;
};

export function worldRecordScore(scores: number[], direction: RankingDirection): number {
	if (!scores.length) return 1;
	return direction === 'higher_is_better' ? Math.max(...scores) : Math.min(...scores);
}

export function estimateRecordPoints(
	score: number,
	pool: number | null,
	scores: number[],
	direction: RankingDirection
): PointEstimate | null {
	if (pool === null) return null;
	const normalized = Math.max(1, score);
	const position =
		1 +
		scores.filter((existing) =>
			direction === 'higher_is_better' ? existing > normalized : existing < normalized
		).length;
	const currentWorldRecord = worldRecordScore(scores, direction);
	const worldRecord =
		direction === 'higher_is_better'
			? Math.max(currentWorldRecord, normalized)
			: Math.min(currentWorldRecord, normalized);
	const proximity =
		direction === 'higher_is_better'
			? normalized / Math.max(1, worldRecord)
			: Math.max(1, worldRecord) / Math.max(1, normalized);
	return {
		points: Number((pool * Math.pow(proximity, 3) * Math.pow(position, -0.15)).toFixed(2)),
		position
	};
}

export function buildRoundPointCurve(
	targetScore: number,
	pool: number | null,
	scores: number[],
	direction: RankingDirection
): PointCurve | null {
	if (pool === null) return null;
	const currentWorldRecord = worldRecordScore(scores, direction);
	const maximumRound = Math.max(1, currentWorldRecord, targetScore);
	const left = 58;
	const right = 512;
	const top = 18;
	const bottom = 220;
	const sampleCount = Math.min(maximumRound, 240);
	const values = Array.from({ length: sampleCount }, (_, index) => {
		const round = Math.max(
			1,
			Math.round(1 + ((maximumRound - 1) * index) / Math.max(1, sampleCount - 1))
		);
		return {
			round,
			points: estimateRecordPoints(round, pool, scores, direction)?.points ?? 0
		};
	});
	const maxPoints = Math.max(1, ...values.map((value) => value.points));
	const coordinates = (round: number, points: number) => ({
		x: left + ((round - 1) / Math.max(1, maximumRound - 1)) * (right - left),
		y: top + (1 - points / maxPoints) * (bottom - top)
	});
	const path = values
		.map((value, index) => {
			const point = coordinates(value.round, value.points);
			return `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
		})
		.join(' ');
	const markerStride = Math.max(1, Math.ceil(values.length / 18));
	const markers = values
		.filter((_, index) => index % markerStride === 0 || index === values.length - 1)
		.map((value) => ({ ...coordinates(value.round, value.points), ...value }));
	const target = estimateRecordPoints(targetScore, pool, scores, direction)?.points ?? 0;
	const targetPoint = coordinates(Math.max(1, targetScore), target);
	return {
		path,
		markers,
		maximumRound,
		maxPoints,
		left,
		right,
		top,
		bottom,
		targetX: targetPoint.x,
		targetY: targetPoint.y
	};
}
