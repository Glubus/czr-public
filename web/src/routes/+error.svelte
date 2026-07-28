<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let notFound = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{page.status} - Zombies Records</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<section class="error-page">
	<span>{page.status}</span>
	<p>{notFound ? 'Lost record' : 'System fault'}</p>
	<h1>{notFound ? 'PAGE NOT FOUND.' : 'SOMETHING BROKE.'}</h1>
	<small
		>{notFound
			? 'This route does not exist or the record is no longer available.'
			: 'The request could not be completed. Try again in a moment.'}</small
	>
	<div>
		<a class="primary-action" href={resolve('/')}>Back home</a>
		<a class="secondary-action" href={resolve('/games')}>Browse games</a>
	</div>
</section>

<style>
	.error-page {
		display: grid;
		min-height: calc(100vh - 4.8rem);
		place-content: center;
		justify-items: center;
		padding: 2rem;
		text-align: center;
	}
	.error-page > span {
		color: var(--signal);
		font-family: monospace;
		font-size: clamp(5rem, 18vw, 12rem);
		font-weight: 900;
		line-height: 0.8;
		opacity: 0.16;
	}
	.error-page p {
		margin: -1rem 0 0.5rem;
		color: var(--signal);
		font-size: 0.62rem;
		font-weight: 900;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(2.8rem, 8vw, 6rem);
		font-style: italic;
		line-height: 0.9;
	}
	small {
		max-width: 34rem;
		margin-top: 1.1rem;
		color: var(--muted);
		font-size: 0.75rem;
		line-height: 1.7;
	}
	.error-page div {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.7rem;
		margin-top: 2rem;
	}
</style>
