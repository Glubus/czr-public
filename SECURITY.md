# Security policy

## Reporting a vulnerability

Do not open a public issue for a vulnerability that could expose accounts, private data, infrastructure, or
moderation controls.

Email the security and privacy contact shown in the footer of the deployed site. Include:

- the affected URL, endpoint, or commit;
- the required account role;
- a minimal proof of concept;
- the expected impact;
- any temporary mitigation you recommend.

Do not access data that does not belong to you, disrupt the service, run denial-of-service tests, or publish
the issue before a fix is available.

## Supported version

The public instance runs the supported version from the default branch. Older commits, forks, and unofficial
deployments are not maintained by the CZR operator.

## Deployment expectations

Public deployments must use non-default secrets, HTTPS, private database and Redis networks, bounded request
bodies, distributed rate limits, and the production Compose override. The internal API documentation and
metrics endpoints must not be exposed without access controls.
