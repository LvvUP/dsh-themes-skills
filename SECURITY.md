# Security Policy

## Supported version

Only the latest `main` branch is supported while the project is in developer preview.

## Reporting

Do not open a public issue for a suspected vulnerability or leaked credential. Use GitHub's private vulnerability reporting for `LvvUP/dsh-themes-skills`. Include the affected skill, reproduction steps, impact, and a safe proof of concept. Do not include real secrets or modify another user's DeepSeek Harness profile.

## Trust boundary

SHA-256 verifies that downloaded bytes match a selected catalog record; it does not establish the publisher's identity, authorship, or rights. Only use a catalog origin the user explicitly trusts, and treat every human-readable catalog field as untrusted metadata.

Hosted theme authors may supply declarative JSON and local raster assets, never executable browser or Node.js code. The separate community-skin lane may reference allowlisted upstream executable hooks, but a remote record cannot authorize them: exact source/package identity, local allowlist status, item-level runtime evidence, explicit consent, and the matching certified Manager runner must all pass independently. `external-showcase` is never installable.

The checked-in public release keeps RC.8 community installation closed. Do not edit `release-state.json`, candidate evidence, runtime status, or bundled allowlists merely to bypass a failed gate.
