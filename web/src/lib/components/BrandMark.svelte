<script lang="ts">
	let { compact = false }: { compact?: boolean } = $props();
</script>

<span class:compact class="brand-mark" aria-label="Zombies Records">
	<span class="brand-glyph" aria-hidden="true">
		<svg viewBox="0 0 34 34" fill="none">
			<path d="M7 7v20M13 6v22M19 7v20M25 6v22M4 25 29 9" stroke="currentColor" stroke-width="3" />
		</svg>
	</span>
	<span class="brand-type">
		<strong>ZOMBIES</strong>
		<small>RECORDS</small>
	</span>
</span>

<style>
	.brand-mark {
		display: inline-flex;
		align-items: center;
		gap: 0.7rem;
		color: var(--ink);
	}
	.brand-glyph {
		display: grid;
		width: 2.4rem;
		height: 2.4rem;
		place-items: center;
		border: 1px solid var(--line-strong);
		background: transparent;
		color: var(--signal);
		box-shadow: 3px 3px 0 var(--signal);
		transform: rotate(-2deg);
	}
	.brand-glyph svg {
		width: 1.45rem;
		height: 1.45rem;
	}
	.brand-type {
		display: grid;
		line-height: 0.9;
	}
	.brand-type strong {
		font-family: var(--font-display);
		font-size: 1.3rem;
		letter-spacing: 0.12em;
	}
	.brand-type small {
		margin-top: 0.3rem;
		color: var(--muted);
		font-size: 0.57rem;
		font-weight: 800;
		letter-spacing: 0.28em;
	}
	.compact .brand-type {
		display: none;
	}
</style>
