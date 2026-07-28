<script lang="ts">
	import { resolve } from '$app/paths';
	import PointsValue from '$lib/components/atoms/PointsValue.svelte';
	import PlayerAvatar from '$lib/components/PlayerAvatar.svelte';
	import { formatRecordScore } from '$lib/display';
	import type { SubmissionDetail } from '$lib/types';
	let { detail }: { detail: SubmissionDetail } = $props();
	const date = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' });
	function score() {
		const run = detail.submission;
		return formatRecordScore(run.scoreValue, detail.category.scoreType, run.runDurationMs);
	}
</script>

<aside>
	<div class="score"><span>RESULT</span><strong>{score()}</strong></div>
	<div class="pp">
		<span>PERFORMANCE POINTS</span><PointsValue value={detail.points} size="large" />
	</div>
	<dl>
		<div>
			<dt>Game</dt>
			<dd>{detail.game.name}</dd>
		</div>
		<div>
			<dt>Category</dt>
			<dd>{detail.category.name}</dd>
		</div>
		<div>
			<dt>Players</dt>
			<dd>{detail.submission.playerCount}P</dd>
		</div>
		<div>
			<dt>Platform</dt>
			<dd>{detail.submission.platform ?? 'Not specified'}</dd>
		</div>
		<div>
			<dt>Submitted</dt>
			<dd>{date.format(new Date(detail.submission.submittedAt))}</dd>
		</div>
		<div>
			<dt>Verified</dt>
			<dd>
				{detail.submission.verifiedAt ? date.format(new Date(detail.submission.verifiedAt)) : '-'}
			</dd>
		</div>
	</dl>
	<div class="players">
		<span>PLAYERS</span>{#each detail.participants as participant (participant.user.id)}<a
				href={resolve('/players/[id]', { id: participant.user.id })}
				><PlayerAvatar
					name={participant.user.name}
					image={participant.user.image}
					size="small"
				/><strong>{participant.user.name}</strong><small>{participant.role}</small></a
			>{/each}
	</div>
</aside>

<style>
	aside {
		padding: 1.4rem;
		border: 1px solid var(--line);
		background: var(--panel);
	}
	.score,
	.pp {
		padding: 1rem 0 1.3rem;
		border-bottom: 1px solid var(--line);
	}
	.score > span,
	.pp > span,
	.players > span {
		display: block;
		margin-bottom: 0.5rem;
		color: var(--muted);
		font-size: 0.58rem;
		font-weight: 900;
		text-transform: uppercase;
	}
	.score strong {
		display: block;
		font-family: var(--font-display);
		font-size: 2.2rem;
	}
	dl {
		margin: 0;
	}
	dl div {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.85rem 0;
		border-bottom: 1px solid var(--line);
	}
	dt {
		color: var(--muted);
		font-size: 0.62rem;
	}
	dd {
		margin: 0;
		font-size: 0.68rem;
		font-weight: 800;
		text-align: right;
	}
	.players {
		display: grid;
		gap: 0.5rem;
		padding-top: 1.2rem;
	}
	.players > a {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.65rem;
		color: var(--ink);
		font-size: 0.7rem;
		text-decoration: none;
	}
	.players small {
		color: var(--muted);
		font-size: 0.55rem;
		text-transform: uppercase;
	}
</style>
