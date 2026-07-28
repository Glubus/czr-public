<script lang="ts">
	import { resolve } from '$app/paths';
	let {
		basePath,
		selected,
		assignmentId
	}: { basePath: string; selected: number; assignmentId?: number } = $props();
	const link = (count: number) =>
		resolve(
			`${basePath}?player_count=${count}${assignmentId ? `&assignment_id=${assignmentId}` : ''}` as '/'
		);
</script>

<nav aria-label="Player count">
	{#each [1, 2, 3, 4] as count (count)}
		<a class:active={selected === count} href={link(count)}>{count}P</a>
	{/each}
</nav>

<style>
	nav {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		margin-top: 1rem;
		border: 1px solid var(--line);
		background: var(--canvas-soft);
	}
	a {
		display: grid;
		min-height: 3.6rem;
		place-items: center;
		border-right: 1px solid var(--line);
		color: var(--muted);
		font-family: var(--font-display);
		font-size: 1rem;
		font-weight: 800;
		text-decoration: none;
	}
	a:last-child {
		border-right: 0;
	}
	a:hover,
	a.active {
		background: var(--signal);
		color: #10120e;
	}
</style>
