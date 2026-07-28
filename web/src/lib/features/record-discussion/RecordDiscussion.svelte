<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { SvelteURL } from 'svelte/reactivity';
	import FormAlert from '$lib/components/atoms/FormAlert.svelte';
	import PlayerAvatar from '$lib/components/PlayerAvatar.svelte';
	import type { SubmitFunction } from '@sveltejs/kit';

	export type RecordComment = {
		id: number;
		parentId: number | null;
		body: string;
		score: number;
		viewerVote: number;
		createdAt: string;
		author: { id: string; name: string; image: string | null };
	};

	let {
		comments,
		viewer,
		submissionId,
		message
	}: {
		comments: RecordComment[];
		viewer: { id: string; name: string; image: string | null } | null;
		submissionId: number;
		message?: string;
	} = $props();

	let replyingTo = $state<number | null>(null);
	let localVotes = $state<Record<number, { viewerVote: number; score: number }>>({});
	let threads = $derived(
		comments
			.filter((comment) => comment.parentId === null)
			.map((comment) => ({
				comment,
				replies: comments.filter((reply) => reply.parentId === comment.id)
			}))
	);

	const enhanceDiscussion: SubmitFunction =
		() =>
		async ({ result, update }) => {
			await update({ reset: result.type === 'success', invalidateAll: result.type === 'success' });
		};
	const enhanceReply: SubmitFunction =
		() =>
		async ({ result, update }) => {
			await update({ reset: result.type === 'success', invalidateAll: result.type === 'success' });
			if (result.type === 'success') replyingTo = null;
		};
	const enhanceVote: SubmitFunction = ({ formData }) => {
		const commentId = Number(formData.get('commentId'));
		const nextVote = Number(formData.get('value'));
		const comment = comments.find((entry) => entry.id === commentId);
		if (!comment) return;
		const previousVote = shownVote(comment);
		localVotes = {
			...localVotes,
			[commentId]: {
				viewerVote: nextVote,
				score: shownScore(comment) + nextVote - previousVote
			}
		};
		return async ({ result, update }) => {
			await update({ reset: false, invalidateAll: result.type === 'success' });
			const next = { ...localVotes };
			delete next[commentId];
			localVotes = next;
		};
	};

	function shownVote(comment: RecordComment) {
		return localVotes[comment.id]?.viewerVote ?? comment.viewerVote;
	}

	function shownScore(comment: RecordComment) {
		return localVotes[comment.id]?.score ?? comment.score;
	}

	async function copyCommentLink(commentId: number, event: MouseEvent) {
		const url = new SvelteURL(window.location.href);
		url.hash = `comment-${commentId}`;
		await navigator.clipboard.writeText(url.toString());
		const details = (event.currentTarget as HTMLElement).closest('details');
		if (details) details.open = false;
	}
</script>

<section>
	<header>
		<div>
			<span>Discussion</span>
			<h2>Record comments</h2>
		</div>
		<strong>{comments.length}</strong>
	</header>
	{#if message}<div class="alert"><FormAlert {message} /></div>{/if}
	{#if viewer}
		<form method="POST" action="?/comment" class="comment-form" use:enhance={enhanceDiscussion}>
			<PlayerAvatar name={viewer.name} image={viewer.image} size="small" />
			<label>
				<span class="sr-only">Write a comment</span>
				<textarea
					name="body"
					maxlength="2000"
					rows="3"
					placeholder="Add something useful about this record…"
					required></textarea>
			</label>
			<button>Post comment</button>
		</form>
	{:else}
		<a
			class="login"
			href={resolve(
				`/login?next=${encodeURIComponent(`/submissions/${submissionId}`)}` as '/login'
			)}>Sign in to join the discussion →</a
		>
	{/if}
	<div class="list">
		{#each threads as thread (thread.comment.id)}
			<div class="thread">
				{@render commentItem(thread.comment)}
				{#if thread.replies.length}
					<div class="replies">
						{#each thread.replies as reply (reply.id)}{@render commentItem(reply, true)}{/each}
					</div>
				{/if}
			</div>
		{:else}
			<p class="empty">No comments yet. Start the discussion.</p>
		{/each}
	</div>
</section>

{#snippet commentItem(comment: RecordComment, isReply = false)}
	<article id={`comment-${comment.id}`} class:reply={isReply}>
		<PlayerAvatar name={comment.author.name} image={comment.author.image} size="small" />
		<div class="content">
			<header>
				<a href={resolve('/players/[id]', { id: comment.author.id })}>{comment.author.name}</a>
				<time>
					{new Intl.DateTimeFormat('en', {
						dateStyle: 'medium',
						timeStyle: 'short'
					}).format(new Date(comment.createdAt))}
				</time>
				<details class="menu">
					<summary aria-label="Comment options">⋮</summary>
					<div>
						<button type="button" onclick={(event) => copyCommentLink(comment.id, event)}
							>Copy link</button
						>
						{#if viewer?.id === comment.author.id}
							<form
								method="POST"
								action="?/deleteComment"
								use:enhance={enhanceDiscussion}
								onsubmit={(event) => {
									if (!confirm('Delete this comment? Its replies will be preserved.'))
										event.preventDefault();
								}}
							>
								<input type="hidden" name="commentId" value={comment.id} />
								<button class="danger">Delete</button>
							</form>
						{/if}
					</div>
				</details>
			</header>
			<p>{comment.body}</p>
			<div class="actions">
				{#if viewer}
					<form method="POST" action="?/voteComment" use:enhance={enhanceVote}>
						<input type="hidden" name="commentId" value={comment.id} />
						<input type="hidden" name="value" value={shownVote(comment) === 1 ? 0 : 1} />
						<button class:active={shownVote(comment) === 1} aria-label="Upvote comment">▲</button>
					</form>
				{/if}
				<strong class:positive={shownScore(comment) > 0} class:negative={shownScore(comment) < 0}
					>{shownScore(comment)}</strong
				>
				{#if viewer}
					<form method="POST" action="?/voteComment" use:enhance={enhanceVote}>
						<input type="hidden" name="commentId" value={comment.id} />
						<input type="hidden" name="value" value={shownVote(comment) === -1 ? 0 : -1} />
						<button class:active={shownVote(comment) === -1} aria-label="Downvote comment">▼</button
						>
					</form>
					<button
						type="button"
						class="reply-action"
						onclick={() => (replyingTo = replyingTo === comment.id ? null : comment.id)}
						>↪ Reply</button
					>
				{/if}
			</div>
			{#if replyingTo === comment.id}
				<form method="POST" action="?/comment" class="reply-form" use:enhance={enhanceReply}>
					<input type="hidden" name="parentId" value={comment.id} />
					<textarea
						name="body"
						maxlength="2000"
						rows="2"
						placeholder={`Reply to ${comment.author.name}…`}
						required></textarea>
					<div>
						<button type="button" onclick={() => (replyingTo = null)}>Cancel</button>
						<button>Post reply</button>
					</div>
				</form>
			{/if}
		</div>
	</article>
{/snippet}

<style>
	section {
		margin-top: 1rem;
		border: 1px solid var(--line);
		background: var(--panel);
	}
	section > header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.2rem;
		border-bottom: 1px solid var(--line);
	}
	section > header div {
		display: grid;
		gap: 0.2rem;
	}
	section > header span,
	section > header strong {
		color: var(--signal);
		font-size: 0.55rem;
		font-weight: 900;
		text-transform: uppercase;
	}
	h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-style: italic;
		text-transform: uppercase;
	}
	.alert {
		padding: 1rem 1rem 0;
	}
	.comment-form {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: start;
		gap: 0.75rem;
		padding: 1rem;
		border-bottom: 1px solid var(--line);
	}
	.comment-form label,
	.comment-form textarea {
		width: 100%;
	}
	.comment-form textarea,
	.reply-form textarea {
		resize: vertical;
		padding: 0.8rem;
		border: 1px solid var(--line-strong);
		background: var(--canvas-soft);
		color: var(--ink);
		font: inherit;
		font-size: 0.72rem;
	}
	.comment-form textarea {
		min-height: 5rem;
	}
	.comment-form button,
	.login {
		min-height: 2.8rem;
		padding: 0 1rem;
		border: 1px solid var(--signal);
		background: var(--signal);
		color: white;
		font-size: 0.56rem;
		font-weight: 900;
		text-decoration: none;
		text-transform: uppercase;
		cursor: pointer;
	}
	.login {
		display: flex;
		align-items: center;
		width: fit-content;
		margin: 1rem;
	}
	.list article {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.75rem;
		padding: 1rem;
	}
	.thread {
		border-bottom: 1px solid var(--line);
	}
	.thread:last-child {
		border-bottom: 0;
	}
	.replies {
		margin-left: 2.8rem;
		border-left: 2px solid var(--line-strong);
		background: color-mix(in srgb, var(--canvas-soft) 55%, transparent);
	}
	.replies article {
		border-top: 1px solid var(--line);
	}
	.content {
		min-width: 0;
	}
	.content > header {
		display: flex;
		position: relative;
		align-items: baseline;
		gap: 0.6rem;
	}
	.content a {
		color: var(--ink);
		font-size: 0.68rem;
		font-weight: 900;
		text-decoration: none;
	}
	time {
		color: var(--muted);
		font-size: 0.5rem;
	}
	.content > p {
		margin: 0.4rem 0 0;
		color: var(--muted);
		font-size: 0.7rem;
		line-height: 1.6;
		white-space: pre-wrap;
		word-break: break-word;
	}
	form button {
		border: 0;
		background: transparent;
		color: var(--muted);
		font-size: 0.5rem;
		text-transform: uppercase;
		cursor: pointer;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		margin-top: 0.65rem;
	}
	.actions form {
		display: flex;
	}
	.actions button {
		min-width: 1.8rem;
		min-height: 1.8rem;
		padding: 0 0.35rem;
		border-radius: 50%;
	}
	.actions button.active {
		background: color-mix(in srgb, var(--signal) 15%, transparent);
		color: var(--signal);
	}
	.actions strong {
		min-width: 1.4rem;
		font-family: monospace;
		font-size: 0.62rem;
		text-align: center;
	}
	.actions strong.positive {
		color: #63b97b;
	}
	.actions strong.negative,
	.danger {
		color: #e76655;
	}
	.actions .reply-action {
		width: auto;
		min-width: 0;
		margin-left: 0.35rem;
		padding: 0 0.55rem;
		border-radius: 999px;
		font-weight: 900;
	}
	.actions .reply-action:hover,
	.menu button:hover {
		background: var(--panel-hover);
		color: var(--ink);
	}
	.menu {
		position: relative;
		margin-left: auto;
	}
	.menu summary {
		display: grid;
		width: 1.9rem;
		height: 1.9rem;
		place-items: center;
		border-radius: 50%;
		color: var(--muted);
		font-size: 1.15rem;
		list-style: none;
		cursor: pointer;
	}
	.menu summary::-webkit-details-marker {
		display: none;
	}
	.menu summary:hover,
	.menu[open] summary {
		background: var(--panel-hover);
		color: var(--ink);
	}
	.menu > div {
		position: absolute;
		z-index: 5;
		top: 2.1rem;
		right: 0;
		display: grid;
		width: 9.5rem;
		padding: 0.35rem;
		border: 1px solid var(--line-strong);
		background: var(--panel-strong);
		box-shadow: 0 0.8rem 2rem rgba(0, 0, 0, 0.45);
	}
	.menu form {
		display: contents;
	}
	.menu button {
		width: 100%;
		min-height: 2.35rem;
		padding: 0 0.65rem;
		text-align: left;
	}
	.reply-form {
		display: grid;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}
	.reply-form textarea {
		width: 100%;
		font-size: 0.68rem;
	}
	.reply-form > div {
		display: flex;
		justify-content: flex-end;
		gap: 0.4rem;
	}
	.reply-form > div button {
		min-height: 2.2rem;
		padding: 0 0.7rem;
		border: 1px solid var(--line-strong);
	}
	.reply-form > div button:last-child {
		border-color: var(--signal);
		background: var(--signal);
		color: white;
	}
	.empty {
		padding: 2rem 1rem;
		text-align: center;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
	@media (max-width: 650px) {
		.comment-form {
			grid-template-columns: auto 1fr;
		}
		.comment-form button {
			grid-column: 2;
		}
		.replies {
			margin-left: 1rem;
		}
	}
</style>
