<script lang="ts">
	let { value = '' }: { value?: string } = $props();
</script>

<form method="GET">
	<span aria-hidden="true">⌕</span><label class="sr-only" for="archive-search">Search records</label
	><input
		id="archive-search"
		name="q"
		{value}
		type="search"
		minlength="2"
		placeholder="Player, map or game…"
	/><button type="submit">Search <span>↗</span></button>
</form>

<style>
	form {
		display: flex;
		min-height: 5rem;
		align-items: center;
		gap: 1rem;
		padding: 0.8rem;
		border: 1px solid var(--line-strong);
		background: var(--panel);
	}
	form > span {
		margin-left: 0.6rem;
		color: var(--signal);
		font-family: var(--font-display);
		font-size: 2rem;
	}
	input {
		min-width: 0;
		flex: 1;
		border: 0;
		outline: 0;
		background: transparent;
		color: var(--ink);
		font-size: clamp(0.9rem, 1.5vw, 1.15rem);
	}
	button {
		align-self: stretch;
		padding: 0 1.4rem;
		border: 0;
		background: var(--signal);
		color: #10120e;
		font-size: 0.7rem;
		font-weight: 900;
		text-transform: uppercase;
		cursor: pointer;
	}
	@media (max-width: 500px) {
		form {
			min-height: 4rem;
		}
		button {
			padding: 0 1rem;
		}
	}
</style>
