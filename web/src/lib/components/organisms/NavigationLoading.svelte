<script lang="ts">
	import { navigating } from '$app/state';
</script>

{#if navigating.to}
	<div class="progress" aria-hidden="true"><span></span></div>
	<div class="loading-card" role="status" aria-live="polite">
		<span class="sr-only">Loading {navigating.to.url.pathname}</span>
		<i class="eyebrow"></i>
		<i class="title"></i>
		<i class="line"></i>
	</div>
{/if}

<style>
	.progress {
		position: fixed;
		inset: 0 0 auto;
		z-index: 200;
		height: 3px;
		overflow: hidden;
		background: color-mix(in srgb, var(--signal) 16%, transparent);
	}
	.progress span {
		display: block;
		width: 42%;
		height: 100%;
		background: var(--signal);
		box-shadow: 0 0 1rem var(--signal);
		animation: travel 1s ease-in-out infinite;
	}
	.loading-card {
		position: fixed;
		top: 5.7rem;
		right: 1.25rem;
		z-index: 100;
		display: grid;
		width: min(20rem, calc(100vw - 2rem));
		gap: 0.65rem;
		padding: 1rem;
		border: 1px solid var(--line-strong);
		background: color-mix(in srgb, var(--panel) 96%, transparent);
		box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.45);
		backdrop-filter: blur(12px);
	}
	.loading-card i {
		display: block;
		height: 0.55rem;
		background: linear-gradient(90deg, var(--panel-strong), #303832, var(--panel-strong));
		background-size: 220% 100%;
		animation: shimmer 1.1s linear infinite;
	}
	.loading-card .eyebrow {
		width: 28%;
		height: 0.4rem;
	}
	.loading-card .title {
		width: 70%;
		height: 1.05rem;
	}
	.loading-card .line {
		width: 92%;
	}
	@keyframes travel {
		from {
			transform: translateX(-110%);
		}
		to {
			transform: translateX(250%);
		}
	}
	@keyframes shimmer {
		from {
			background-position: 100% 0;
		}
		to {
			background-position: -120% 0;
		}
	}
	@media (max-width: 920px) {
		.loading-card {
			top: 5rem;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.progress span,
		.loading-card i {
			animation: none;
		}
	}
</style>
