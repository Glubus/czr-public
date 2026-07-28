<script lang="ts">
	import { resolve } from '$app/paths';
	import type { MapResult } from '$lib/types';

	let {
		maps,
		code,
		emptyMessage = 'No maps available.'
	}: { maps: MapResult[]; code: string; emptyMessage?: string } = $props();
</script>

{#if maps.length}
	<ul>
		{#each maps as map (map.id)}
			<li>
				<a href={resolve('/maps/[id]', { id: String(map.id) })}>
					<span>{code}</span>
					<strong>{map.name}</strong>
					<small>{map.status}</small>
					<b>→</b>
				</a>
			</li>
		{/each}
	</ul>
{:else}
	<p>{emptyMessage}</p>
{/if}

<style>
	ul {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		border-top: 1px solid var(--line);
		border-right: 1px solid var(--line);
	}
	li:nth-child(4n) {
		border-right: 0;
	}
	li a {
		display: flex;
		min-height: 9rem;
		align-items: flex-start;
		flex-direction: column;
		gap: 0.55rem;
		padding: 1.2rem;
		color: var(--ink);
		text-decoration: none;
	}
	li a:hover {
		background: var(--panel-hover);
	}
	li span {
		color: var(--signal);
		font-family: monospace;
		font-size: 0.62rem;
	}
	li strong {
		font-family: var(--font-display);
		font-size: 1.05rem;
		line-height: 1.15;
	}
	li small {
		color: var(--muted);
		font-size: 0.62rem;
		text-transform: uppercase;
	}
	li a > b {
		margin-top: auto;
		align-self: flex-end;
		color: var(--signal);
	}
	p {
		display: grid;
		min-height: 14rem;
		margin: 0;
		place-items: center;
		color: var(--muted);
		font-size: 0.75rem;
	}
	@media (max-width: 1000px) {
		ul {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		li:nth-child(4n) {
			border-right: 1px solid var(--line);
		}
		li:nth-child(2n) {
			border-right: 0;
		}
	}
	@media (max-width: 550px) {
		ul {
			grid-template-columns: 1fr;
		}
		li,
		li:nth-child(2n) {
			border-right: 0;
		}
	}
</style>
