# Security Policy

## Supported version

Only the latest `main` branch is supported while the project is in developer preview.

## Reporting

Do not open a public issue for a suspected vulnerability or leaked credential. Use GitHub's private vulnerability reporting for `LvvUP/dsh-themes-skills`. Include the affected skill, reproduction steps, impact, and a safe proof of concept. Do not include real secrets or modify another user's DeepSeek Harness profile.

## Trust boundary

SHA-256 verifies that downloaded bytes match a selected catalog record; it does not establish the publisher's identity. Only use a catalog origin the user explicitly trusts. Theme authors may supply declarative JSON and local raster assets, never executable browser or Node.js code.
