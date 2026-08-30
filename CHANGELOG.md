# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This framework is fork-and-deploy rather than a published package, so versions
are git tags and GitHub releases, not package registry versions. Tags exist
mainly so security advisories can reference affected and patched versions.

## [1.0.1] - 2026-08-30

### Security

- **Expired password reset tokens are now rejected by the password change
  endpoint** ([GHSA-j8pr-c94v-28qx], CWE-613). Previously,
  `POST /forgot-password-new-password` in the user-mgmt worker accepted any
  reset token present in the database regardless of age, so a token issued at
  any point in the past remained a single-use account-takeover credential
  until consumed. The token lookup now enforces the `TOKEN_VALID_MINUTES`
  window at the SQL layer, the handler checks `isTokenExpired()` as defense
  in depth, and requests missing a token or password are rejected with a
  specific error. Reported by EQSTLab. ([#59])

  If your deployment predates this release, redeploy the user-mgmt worker
  from this version or later and consider clearing outstanding reset tokens:
  `UPDATE User SET ResetToken = NULL, ResetTokenTime = NULL;`

## [1.0.0] - 2026-08-29

Baseline release: user-mgmt (registration, login, password reset, optional
RBAC), session-state (KV-backed sessions), and account-pages (example
frontend). Tagged as the last commit before the fix for
[GHSA-j8pr-c94v-28qx]; deployments at or before this tag are affected.

[1.0.1]: https://github.com/devondragon/workers-users/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/devondragon/workers-users/releases/tag/v1.0.0
[GHSA-j8pr-c94v-28qx]: https://github.com/devondragon/workers-users/security/advisories/GHSA-j8pr-c94v-28qx
[#59]: https://github.com/devondragon/workers-users/pull/59
