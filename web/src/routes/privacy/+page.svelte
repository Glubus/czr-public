<script lang="ts">
	import LegalDocument from '$lib/components/organisms/LegalDocument.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let contact = $derived(data.legalContactEmail);
</script>

<svelte:head>
	<title>Privacy Policy - Zombies Records</title>
	<meta
		name="description"
		content="How Zombies Records collects, uses, stores and protects personal data."
	/>
</svelte:head>

<LegalDocument
	eyebrow="Legal / Your data"
	title="Privacy policy."
	intro="A plain-language explanation of what the platform stores, why it needs that information and what control you have over it."
	updated="23 July 2026"
>
	<section class="legal-section">
		<h2>Who operates the service</h2>
		<div class="legal-copy">
			<p>
				Zombies Records is operated by <strong
					>{data.legalOperatorName ?? 'the site operator'}</strong
				>.
				{#if contact}
					For privacy questions or requests, contact <a href={`mailto:${contact}`}>{contact}</a>.
				{:else}
					The operator’s contact address will be displayed here before the public deployment.
				{/if}
			</p>
			{#if data.legalHostName}<p>
					The service infrastructure is hosted by {data.legalHostName}.
				</p>{/if}
		</div>
	</section>

	<section class="legal-section">
		<h2>Data we collect</h2>
		<div class="legal-copy">
			<ul>
				<li>Account data: display name, email address, password hash, roles and account dates.</li>
				<li>
					Session security data: session token, IP address, browser user agent and expiry date.
				</li>
				<li>
					Public profile data: avatar, background, profile colours, records, rankings, achievements,
					clan membership and selected public activity.
				</li>
				<li>
					Competitive data: submissions, scores, durations, proof links, participants, comments,
					votes, follows, personal runs and moderation decisions.
				</li>
				<li>
					Technical data required for abuse prevention, health monitoring and security logs,
					including request identifiers and short-lived rate-limit counters.
				</li>
			</ul>
			<p>We do not currently use advertising cookies or third-party behavioural analytics.</p>
		</div>
	</section>

	<section class="legal-section">
		<h2>Why we use it</h2>
		<div class="legal-copy">
			<p>We process this information to:</p>
			<ul>
				<li>create and secure accounts, sessions and password resets;</li>
				<li>publish and maintain competitive leaderboards and player profiles;</li>
				<li>review records, detect duplicate or abusive activity and enforce community rules;</li>
				<li>provide clans, follows, comments, votes, achievements and performance statistics;</li>
				<li>keep the service reliable, prevent spam and investigate security incidents.</li>
			</ul>
			<p>
				The main legal bases are performance of the service requested by the user, the operator’s
				legitimate interest in running a secure community platform, and legal obligations where
				applicable.
			</p>
		</div>
	</section>

	<section class="legal-section">
		<h2>Public information</h2>
		<div class="legal-copy">
			<p>
				Display names, profile media, verified records, rankings, achievements, comments and clan
				information are intended to be public. Do not publish personal information in a profile,
				comment or proof that you do not want others to see.
			</p>
			<p>
				Proofs hosted by third parties remain subject to their own privacy policies. YouTube videos
				are embedded using YouTube’s privacy-enhanced domain when possible.
			</p>
		</div>
	</section>

	<section class="legal-section">
		<h2>Storage and recipients</h2>
		<div class="legal-copy">
			<p>
				Data is stored in the platform database and file storage. Access is limited to the operator
				and authorised moderators where needed. Hosting and email delivery providers process only
				the information required to provide their services.
			</p>
			<p>
				We do not sell personal information. Data may be disclosed when legally required or when
				necessary to protect users, the platform or third parties from fraud, abuse or security
				threats.
			</p>
		</div>
	</section>

	<section class="legal-section">
		<h2>Retention</h2>
		<div class="legal-copy">
			<p>
				Account information is retained while the account is active. Sessions and password-reset
				tokens expire automatically. Short-lived security counters expire automatically, while
				operational logs are retained only as long as reasonably needed for reliability and incident
				investigation.
			</p>
			<p>
				Deleting an account removes authentication data and anonymises information that must remain
				to preserve the integrity of historical leaderboards.
			</p>
		</div>
	</section>

	<section class="legal-section">
		<h2>Your choices and rights</h2>
		<div class="legal-copy">
			<p>
				You can update profile information or delete your account from profile settings. Depending
				on your location, you may also request access, correction, deletion, restriction,
				portability or object to certain processing.
			</p>
			<p>
				{#if contact}
					Send requests to <a href={`mailto:${contact}`}>{contact}</a>. We may need to verify your
					identity before acting on a request.
				{:else}
					Use the operator contact address published on this page once the public deployment is
					available.
				{/if}
			</p>
		</div>
	</section>

	<section class="legal-section">
		<h2>Cookies and security</h2>
		<div class="legal-copy">
			<p>
				The site uses one essential, HTTP-only session cookie to keep signed-in users authenticated.
				It is not used for advertising. Blocking it prevents account features from working.
			</p>
			<p>
				Reasonable technical safeguards are used, including hashed passwords, access controls,
				request limits, restricted upload sizes and encrypted HTTPS transport. No online service can
				guarantee absolute security.
			</p>
		</div>
	</section>

	<section class="legal-section">
		<h2>Changes</h2>
		<div class="legal-copy">
			<p>
				This policy may change when the service or its providers change. Material updates will be
				announced on the site and the date at the top of this page will be updated.
			</p>
		</div>
	</section>
</LegalDocument>
