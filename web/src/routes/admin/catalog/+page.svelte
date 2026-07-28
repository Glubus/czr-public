<script lang="ts">
	import { resolve } from '$app/paths';
	import FormAlert from '$lib/components/atoms/FormAlert.svelte';
	import AdminCatalogCreate from '$lib/components/organisms/AdminCatalogCreate.svelte';
	import AdminCatalogManage from '$lib/components/organisms/AdminCatalogManage.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><title>Catalogue administration - Zombies Records</title></svelte:head>

<div class="catalog-page">
	<a class="back" href={resolve('/admin')}>← Moderation</a>
	<header>
		<span>Data administration</span>
		<h1>CATALOGUE.</h1>
		<p>Create, update, archive, and safely remove catalogue data.</p>
	</header>

	{#if data.apiUnavailable}<FormAlert
			message="Some catalogue data is temporarily unavailable."
		/>{/if}
	{#if form?.message}<FormAlert
			message={form.message}
			kind={form.success ? 'success' : 'error'}
		/>{/if}

	<section class="block">
		<div class="section-heading">
			<span>Creation</span>
			<h2>Add catalogue data</h2>
		</div>
		<AdminCatalogCreate games={data.games} maps={data.maps} categories={data.categories} />
	</section>

	<section class="block">
		<div class="section-heading">
			<span>Maintenance</span>
			<h2>Manage existing data</h2>
		</div>
		<AdminCatalogManage
			games={data.games}
			maps={data.maps}
			categories={data.categories}
			assignments={data.assignments}
		/>
	</section>
</div>

<style>
	.catalog-page {
		padding: clamp(1rem, 4vw, 4rem);
	}
	.back {
		color: var(--muted);
		font-size: 0.6rem;
		font-weight: 900;
		text-decoration: none;
		text-transform: uppercase;
	}
	.catalog-page > header {
		padding: 3rem 0 2rem;
	}
	.catalog-page > header span,
	.section-heading span {
		color: var(--signal);
		font-family: monospace;
		font-size: 0.58rem;
		font-weight: 900;
		letter-spacing: 0.13em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0.55rem 0;
		font-family: var(--font-display);
		font-size: clamp(3rem, 7vw, 6rem);
		font-style: italic;
		line-height: 0.85;
	}
	.catalog-page > header p {
		color: var(--muted);
		font-size: 0.7rem;
	}
	.block {
		margin-top: 2.5rem;
	}
	.section-heading {
		margin-bottom: 1rem;
	}
	.section-heading h2 {
		margin: 0.35rem 0 0;
		font-family: var(--font-display);
		font-size: clamp(1.8rem, 4vw, 2.8rem);
		font-style: italic;
		text-transform: uppercase;
	}
	@media (max-width: 550px) {
		.catalog-page {
			padding-bottom: 6rem;
		}
	}
</style>
