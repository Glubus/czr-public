<script lang="ts">
	import LegalDocument from '$lib/components/organisms/LegalDocument.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let contact = $derived(data.legalContactEmail);
</script>

<svelte:head>
	<title>Terms of Service - Zombies Records</title>
	<meta
		name="description"
		content="The rules and conditions for using Zombies Records, submitting runs and participating in the community."
	/>
</svelte:head>

<LegalDocument
	eyebrow="Legal / Community"
	title="Terms of service."
	intro="The ground rules for accounts, record submissions and community participation. Use the platform fairly and do not make it worse for everyone else."
	updated="23 July 2026"
>
	<section class="legal-section">
		<h2>Agreement</h2>
		<div class="legal-copy">
			<p>
				By creating an account or using Zombies Records, you agree to these terms and the Privacy
				Policy. If you do not agree, do not use the service.
			</p>
			<p>
				The service is operated by <strong>{data.legalOperatorName ?? 'the site operator'}</strong>.
				{#if contact}
					Questions may be sent to <a href={`mailto:${contact}`}>{contact}</a>.
				{/if}
			</p>
		</div>
	</section>

	<section class="legal-section">
		<h2>Accounts</h2>
		<div class="legal-copy">
			<ul>
				<li>Provide a valid email address and keep your credentials secure.</li>
				<li>
					One person must not use multiple accounts to manipulate rankings, votes or moderation.
				</li>
				<li>You are responsible for activity performed through your account.</li>
				<li>Do not impersonate another player, moderator, clan or organisation.</li>
				<li>Accounts may not be sold, transferred or used to evade a previous restriction.</li>
			</ul>
			<p class="legal-notice">
				If you believe an account has been compromised, change its password and contact the operator
				as soon as possible.
			</p>
		</div>
	</section>

	<section class="legal-section">
		<h2>Records and proofs</h2>
		<div class="legal-copy">
			<p>When submitting a run, you confirm that:</p>
			<ul>
				<li>the score, duration, players, map, category and other details are accurate;</li>
				<li>the run follows the rules displayed for its leaderboard;</li>
				<li>you have permission to submit the proof and identify the participating players;</li>
				<li>the proof has not been manipulated to misrepresent gameplay or eligibility;</li>
				<li>you will cooperate with reasonable verification requests from moderators.</li>
			</ul>
			<p>
				Verification is a community moderation decision, not a guarantee that a record is
				error-free. Records may be corrected, rejected or removed when new evidence appears or rules
				change.
			</p>
		</div>
	</section>

	<section class="legal-section">
		<h2>Community conduct</h2>
		<div class="legal-copy">
			<p>You must not:</p>
			<ul>
				<li>
					harass, threaten, discriminate against or expose private information about another person;
				</li>
				<li>
					spam, automate abusive interactions or manipulate comments, votes, follows or rankings;
				</li>
				<li>upload malware, illegal material or content that infringes another person’s rights;</li>
				<li>
					probe, bypass or overload security, rate limits, authentication or moderation controls;
				</li>
				<li>interfere with the service or use it for unlawful activity.</li>
			</ul>
		</div>
	</section>

	<section class="legal-section">
		<h2>Your content</h2>
		<div class="legal-copy">
			<p>
				You keep ownership of content you submit. You grant the operator a worldwide, non-exclusive,
				royalty-free licence to host, reproduce, resize, optimise and display that content only as
				needed to operate, moderate, promote and preserve the platform and its leaderboards.
			</p>
			<p>
				You may delete content where the interface allows it. Some verified competitive facts may
				remain in an anonymised form when needed to preserve leaderboard history and audit
				integrity.
			</p>
		</div>
	</section>

	<section class="legal-section">
		<h2>Moderation</h2>
		<div class="legal-copy">
			<p>
				The operator and authorised moderators may review submissions and public content, restrict
				features, remove content, reset manipulated activity, suspend accounts or preserve evidence
				when reasonably necessary to enforce these terms or protect the service.
			</p>
			<p>
				Serious or repeated abuse may result in immediate suspension. Moderation decisions may be
				reconsidered when relevant evidence is provided through the operator’s contact address.
			</p>
		</div>
	</section>

	<section class="legal-section">
		<h2>Availability and rankings</h2>
		<div class="legal-copy">
			<p>
				The service is provided on an “as available” basis. Features may change, become unavailable
				or be discontinued. Scores, PP formulas, categories and rules may be corrected or rebalanced
				to keep competition meaningful.
			</p>
			<p>
				The operator is not responsible for third-party proof hosts, game services, community map
				downloads or external links. Use them at your own risk.
			</p>
		</div>
	</section>

	<section class="legal-section">
		<h2>Liability</h2>
		<div class="legal-copy">
			<p>
				To the extent permitted by applicable law, the operator is not liable for indirect loss,
				lost data, lost ranking opportunities or interruptions caused by third-party services, user
				content, maintenance or events outside reasonable control.
			</p>
			<p>
				Nothing in these terms excludes rights or liability that cannot legally be excluded. These
				terms do not replace any mandatory consumer protections that apply to you.
			</p>
		</div>
	</section>

	<section class="legal-section">
		<h2>Changes and termination</h2>
		<div class="legal-copy">
			<p>
				These terms may be updated as the platform evolves. Material changes will be announced on
				the site. Continued use after an update means you accept the revised terms.
			</p>
			<p>
				You may stop using the service and delete your account at any time. Provisions that
				logically need to survive termination, including content licences already relied upon,
				moderation history and liability limitations, will continue to apply.
			</p>
		</div>
	</section>
</LegalDocument>
