# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅ Yes    |

---

## Reporting a Vulnerability

If you discover a security vulnerability in Nocturne, **please do not open a public GitHub issue.**

Instead, report it via one of the following:

- **GitHub Security Advisories:** Use the [Private Vulnerability Reporting](https://github.com/Akhil-cit/Nocturne/security/advisories/new) feature on GitHub.
- **Email:** Open a GitHub issue marked `[SECURITY]` and request a private channel if direct email is preferred.

We will acknowledge your report within **72 hours** and aim to release a patch within **14 days** for confirmed critical issues.

---

## Scope

The following are **in scope**:

- Remote code execution via crafted music stream URLs
- Credential or token leakage from the application
- Electron context-bridge security misconfigurations
- CSP bypasses allowing script injection

The following are **out of scope**:

- Availability of music catalog (this is a provider concern, not a security issue)
- Rate limiting or HTTP 429 responses from upstream APIs
- Music streaming provider terms of service (see licensing notes in README)

---

## Security Notes for Contributors

- Do **not** commit API keys, tokens, passwords, or personal credentials.
- Do **not** bypass Electron's `contextIsolation` or disable `nodeIntegration` in renderer processes without a compelling reason and explicit review.
- The JioSaavn DES key (`38346591`) is a **public, well-documented decryption parameter** used by JioSaavn's own CDN URL scheme. It is not a private credential. It is documented in dozens of open-source projects.
