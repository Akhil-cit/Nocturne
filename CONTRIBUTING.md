# Contributing to Nocturne

Thank you for your interest in contributing! This guide explains how to get set up, what the standards are, and how to submit a pull request.

---

## Code of Conduct

Please be respectful in all interactions. Harassment of any kind will not be tolerated.

---

## Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/Nocturne.git
   cd Nocturne
   npm install
   ```
3. Create a **feature branch**:
   ```bash
   git checkout -b feat/my-feature
   ```

---

## Development Workflow

```bash
npm run dev          # Vite dev server
npm run electron:dev # Full Electron dev session
npx tsc --noEmit     # Type-check (must pass before every commit)
```

---

## Pull Request Checklist

Before opening a PR, verify the following:

- [ ] `npx tsc --noEmit` exits with code 0 (no type errors).
- [ ] `npx vite build` exits with code 0 (no build errors).
- [ ] No hardcoded local filesystem paths (use `process.cwd()` or `import.meta.url`).
- [ ] No secrets, API keys, or credentials committed.
- [ ] Music provider logic is not broken — `npm run test:regression` passes (7/7) if changed.
- [ ] New features include a brief description in the PR body.

---

## Commit Message Style

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add waveform visualization mode
fix: correct JioSaavn URL decryption for 320kbps streams
docs: update provider architecture notes
chore: bump electron to 37
```

---

## Reporting Issues

Use the [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.md) when filing bugs.  
Use the [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.md) for ideas.

---

## Licensing

By contributing you agree that your contributions are licensed under the **Apache License 2.0**, the same license as this project.
