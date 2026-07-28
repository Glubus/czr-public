<script lang="ts">
	import { resolve } from '$app/paths';
	import Eyebrow from '$lib/components/atoms/Eyebrow.svelte';
	import type { UserRecords } from '$lib/types';

	let { data }: { data: UserRecords['mostPlayed'] } = $props();
	type Tab = 'games' | 'maps' | 'categories';
	const tabs: Tab[] = ['games', 'maps', 'categories'];
	let tab = $state<Tab>('games');
	let entries = $derived(data[tab]);
	let total = $derived(Math.max(1, data.totalPlayCount));
	let overview = $derived(
		tabs.map((type) => ({
			type,
			entry: data[type][0],
			share: data[type][0] ? (data[type][0].playCount / total) * 100 : 0
		}))
	);
	const number = new Intl.NumberFormat('en-US');
	const percent = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
	const singular = (type: Tab) => (type === 'categories' ? 'category' : type.slice(0, -1));
	function href(entry: (typeof entries)[number]) {
		if (tab === 'games' && 'slug' in entry) return resolve(`/games/${entry.slug}` as '/');
		if (tab === 'maps') return resolve(`/maps/${entry.id}` as '/');
		return null;
	}
</script>

<section>
	<header>
		<div>
			<Eyebrow>Activity breakdown</Eyebrow>
			<h2>MOST PLAYED</h2>
		</div>
		<span>{number.format(data.totalPlayCount)} VERIFIED PLAYS</span>
	</header>
	<div class="overview" aria-label="Play rate overview">
		{#each overview as item (item.type)}
			<button
				type="button"
				class:active={tab === item.type}
				onclick={() => (tab = item.type)}
				style:--rate={`${item.share}%`}
			>
				<span class="ring"><b>{percent.format(item.share)}%</b></span>
				<span class="overview-copy">
					<small>Top {singular(item.type)}</small>
					<strong>{item.entry?.name ?? 'No data'}</strong>
					<em>{item.entry ? `${number.format(item.entry.playCount)} plays` : '-'}</em>
				</span>
			</button>
		{/each}
	</div>
	<nav aria-label="Most played type">
		{#each tabs as item (item)}
			<button class:active={tab === item} type="button" onclick={() => (tab = item)}>{item}</button>
		{/each}
	</nav>
	{#if entries.length}
		<ol>
			{#each entries as entry, index (entry.id)}
				<li style:--activity-share={`${(entry.playCount / total) * 100}%`}>
					<span class="rank">0{index + 1}</span>
					<div>
						{#if href(entry)}<a href={href(entry) ?? undefined}>{entry.name}</a>{:else}<strong
								>{entry.name}</strong
							>{/if}
						<small>{tab === 'maps' && 'gameName' in entry ? entry.gameName : singular(tab)}</small>
					</div>
					<p>
						<b>{percent.format((entry.playCount / total) * 100)}%</b>
						<span>{number.format(entry.playCount)} {entry.playCount === 1 ? 'play' : 'plays'}</span>
					</p>
				</li>
			{/each}
		</ol>
	{:else}
		<p class="empty">No verified plays yet.</p>
	{/if}
</section>

<style>
	section {
		margin-top: 1rem;
		border: 1px solid var(--line);
		background: var(--panel);
	}
	header {
		display: flex;
		min-height: 6.5rem;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.3rem 1.5rem;
	}
	h2 {
		margin: 0.45rem 0 0;
		font-family: var(--font-display);
		font-size: 1.6rem;
		font-style: italic;
	}
	header > span {
		color: var(--muted);
		font-family: monospace;
		font-size: 0.6rem;
	}
	.overview {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1px;
		border-top: 1px solid var(--line);
		background: var(--line);
	}
	.overview > button {
		display: grid;
		min-width: 0;
		grid-template-columns: 4.5rem minmax(0, 1fr);
		align-items: center;
		gap: 1rem;
		padding: 1.25rem;
		border: 0;
		background: var(--panel);
		color: var(--ink);
		text-align: left;
		cursor: pointer;
	}
	.overview > button:hover,
	.overview > button.active {
		background: var(--panel-hover);
	}
	.overview > button.active {
		box-shadow: inset 0 -2px var(--signal);
	}
	.ring {
		display: grid;
		position: relative;
		width: 4.5rem;
		aspect-ratio: 1;
		place-items: center;
		border-radius: 50%;
		background: conic-gradient(var(--signal) var(--rate), var(--canvas-soft) 0);
	}
	.ring::after {
		position: absolute;
		width: 3.35rem;
		aspect-ratio: 1;
		border-radius: 50%;
		background: var(--panel);
		content: '';
	}
	.ring b {
		z-index: 1;
		font-family: var(--font-display);
		font-size: 0.72rem;
	}
	.overview-copy {
		display: grid;
		min-width: 0;
		gap: 0.28rem;
	}
	.overview-copy small,
	.overview-copy em {
		color: var(--muted);
		font-size: 0.55rem;
		font-style: normal;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.overview-copy strong {
		overflow: hidden;
		font-family: var(--font-display);
		font-size: 1rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	nav {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		border-top: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
	}
	nav button {
		height: 3.1rem;
		border: 0;
		border-right: 1px solid var(--line);
		background: var(--canvas-soft);
		color: var(--muted);
		font-size: 0.64rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		cursor: pointer;
	}
	nav button:last-child {
		border-right: 0;
	}
	nav button.active {
		background: var(--signal);
		color: #10120e;
	}
	ol {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: grid;
		position: relative;
		min-height: 4.8rem;
		grid-template-columns: 4rem 1fr auto;
		align-items: center;
		border-bottom: 1px solid var(--line);
		isolation: isolate;
	}
	li::before {
		position: absolute;
		z-index: -1;
		inset: 0 auto 0 0;
		width: var(--activity-share);
		background: linear-gradient(
			90deg,
			color-mix(in srgb, var(--signal) 12%, transparent),
			transparent
		);
		content: '';
		transition: width 180ms ease;
	}
	li:last-child {
		border: 0;
	}
	li:hover {
		background: var(--panel-hover);
	}
	.rank {
		color: var(--signal);
		font-family: var(--font-display);
		font-size: 1rem;
		text-align: center;
	}
	li > div {
		display: grid;
		gap: 0.25rem;
		padding: 0.75rem 1rem;
		border-left: 1px solid var(--line);
	}
	li a,
	li strong {
		color: var(--ink);
		font-family: var(--font-display);
		font-size: 1.05rem;
		text-decoration: none;
	}
	li small {
		color: var(--muted);
		font-size: 0.58rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	li p {
		display: grid;
		min-width: 6rem;
		justify-items: end;
		margin: 0;
		padding-right: 1.3rem;
	}
	li p b {
		color: var(--signal);
		font-family: var(--font-display);
		font-size: 1.3rem;
	}
	li p span {
		color: var(--muted);
		font-size: 0.55rem;
		font-weight: 800;
		text-transform: uppercase;
	}
	.empty {
		margin: 0;
		padding: 4rem 1.5rem;
		color: var(--muted);
		text-align: center;
	}
	@media (max-width: 850px) {
		.overview {
			grid-template-columns: 1fr;
		}
	}
</style>
