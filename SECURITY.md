# Security Policy

## Reporting a Vulnerability

Report vulnerabilities privately through GitHub's private vulnerability
reporting: go to the [Security tab](https://github.com/devondragon/workers-users/security)
and click **Report a vulnerability**, or use
[this direct link](https://github.com/devondragon/workers-users/security/advisories/new).

Please do not open a public issue for security problems, and do not include
exploit details in pull requests or discussions until an advisory is
published.

A good report includes:

- The affected worker or package (`user-mgmt`, `session-state`,
  `account-pages`) and file/endpoint if known
- Steps to reproduce, ideally against a local `wrangler dev` instance
- The impact you believe it has (account takeover, data exposure, etc.)

Proof-of-concept scripts are welcome and speed up triage considerably.

## What to Expect

This is a solo-maintained open source project. Realistic commitments:

- **Acknowledgment** within 5 business days
- **Triage verdict** (confirmed, needs more info, or declined with
  reasoning) within 2 weeks
- **Fix and advisory** for confirmed issues as soon as practical,
  typically within 30 days for high-severity issues

Confirmed vulnerabilities get a published GitHub security advisory with a
CVE request, credit to the reporter, and a tagged release containing the
fix. If you prefer not to be credited, say so in the report.

## Supported Versions

This framework is designed to be forked and deployed, not consumed as a
published package. Only the latest release (and `main`) receives security
fixes; there are no backports.

| Version | Supported |
| ------- | --------- |
| Latest release / `main` | ✅ |
| Older tags | ❌ |

**If you run a fork:** you will not receive automatic security updates.
Watch this repository's releases (Watch → Custom → Releases) and its
[security advisories](https://github.com/devondragon/workers-users/security/advisories),
and rebase or cherry-pick fixes into your fork when advisories are
published. Release notes for security fixes include upgrade and
mitigation instructions.

## Scope

In scope:

- Authentication, session, and password-reset logic in `user-mgmt` and
  `session-state`
- RBAC authorization checks (when `RBAC_ENABLED=true`)
- Injection, access-control, or logic flaws reachable through the
  documented API endpoints

Out of scope:

- Vulnerabilities in dependencies (report upstream; dependency bumps here
  are handled via Dependabot)
- Issues requiring a misconfigured deployment (e.g., secrets committed to
  a fork, CORS deliberately widened beyond the shipped defaults)
- The `account-pages` example frontend, except where it demonstrates an
  insecure pattern that forks are likely to copy
- Denial of service against Cloudflare's platform itself

## Known Design Constraints

- Passwords are hashed with SHA-256 rather than a memory-hard KDF due to
  Workers CPU constraints. This is a documented trade-off, not an
  undisclosed vulnerability; reports proposing practical improvements
  within Workers limits are welcome.
