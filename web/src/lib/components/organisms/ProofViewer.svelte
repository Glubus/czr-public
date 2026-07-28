<script lang="ts">
	let { url, level }: { url: string | null; level: string } = $props();
	let embed = $derived(resolveEmbed(url));
	function resolveEmbed(value: string | null) {
		if (!value) return null;
		try {
			const parsed = new URL(value);
			if (parsed.hostname === 'youtu.be')
				return {
					type: 'iframe',
					url: `https://www.youtube-nocookie.com/embed/${parsed.pathname.slice(1)}`
				};
			if (parsed.hostname.endsWith('youtube.com')) {
				const id =
					parsed.searchParams.get('v') ?? parsed.pathname.match(/\/(?:shorts|embed)\/([^/]+)/)?.[1];
				if (id) return { type: 'iframe', url: `https://www.youtube-nocookie.com/embed/${id}` };
			}
			if (parsed.hostname === 'clips.twitch.tv')
				return {
					type: 'iframe',
					url: `https://clips.twitch.tv/embed?clip=${parsed.pathname.slice(1)}&parent=localhost&parent=127.0.0.1`
				};
			const video =
				parsed.hostname.endsWith('twitch.tv') && parsed.pathname.match(/\/videos\/(\d+)/)?.[1];
			if (video)
				return {
					type: 'iframe',
					url: `https://player.twitch.tv/?video=${video}&parent=localhost&parent=127.0.0.1`
				};
			if (/\.(mp4|webm|ogg)(?:$|\?)/i.test(value)) return { type: 'video', url: value };
		} catch {
			return null;
		}
		return { type: 'external', url: value };
	}
</script>

<section>
	<header><span>PROOF</span><strong>{level.replaceAll('_', ' ')}</strong></header>
	<div class="embed">
		{#if embed?.type === 'iframe'}<iframe
				src={embed.url}
				title="Submission video proof"
				allow="autoplay; encrypted-media; picture-in-picture"
				allowfullscreen
			></iframe>{:else if embed?.type === 'video'}<video src={embed.url} controls preload="metadata"
				><track kind="captions" /></video
			>{:else if url}<!-- eslint-disable-next-line svelte/no-navigation-without-resolve --><a
				href={url}
				target="_blank"
				rel="noreferrer">Open external proof ↗</a
			>{:else}<p>No embeddable proof is available.</p>{/if}
	</div>
</section>

<style>
	section {
		border: 1px solid var(--line);
		background: var(--panel);
	}
	header {
		display: flex;
		min-height: 4.5rem;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.3rem;
		border-bottom: 1px solid var(--line);
	}
	header span,
	header strong {
		color: var(--muted);
		font-size: 0.58rem;
		font-weight: 900;
		text-transform: uppercase;
	}
	.embed {
		display: grid;
		min-height: 32rem;
		place-items: center;
		background: #080a09;
	}
	.embed iframe,
	.embed video {
		width: 100%;
		height: 100%;
		min-height: 32rem;
		border: 0;
		object-fit: contain;
	}
	.embed a {
		padding: 1rem 1.3rem;
		border: 1px solid var(--signal);
		color: var(--signal);
		font-size: 0.72rem;
		font-weight: 900;
		text-decoration: none;
		text-transform: uppercase;
	}
	.embed p {
		color: var(--muted);
		font-size: 0.75rem;
	}
	@media (max-width: 550px) {
		.embed,
		.embed iframe,
		.embed video {
			min-height: 18rem;
		}
	}
</style>
