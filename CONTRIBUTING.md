# Contributing to Stemmagraph

Thanks for your interest in contributing! 🎉 Stemmagraph is community-driven — every PR, issue, and discussion helps.
🔗 **Live demo:** <https://ltmoerdani.github.io/stemmagraph/>   **Have a question?** Start a [Discussion](https://github.com/ltmoerdani/stemmagraph/discussions) before opening an issue.

## 🚀 Getting Started

You have two paths:

### Path A — Frontend-only (fastest, no DB)

Best for UI/UX work, bug fixes in components, docs, and exploring the codebase.

```bash
git clone https://github.com/<your-username>/stemmagraph.git
cd stemmagraph
npm install
cp .env.github-pages .env   # mock adapter — no backend needed
npm run dev
```

### Path B — Full stack (with backend + database)

Required when working on the API, Prisma schema, or auth.

1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/<your-username>/stemmagraph.git`
3. **Install** dependencies: `npm install`
4. **Set up** the database: `npm run db:migrate && npm run db:seed`
5. **Start** dev server: `npm run dev:full`

## 🛠️ Development Workflow

### Branch Naming

- `feat/<short-description>` — new features
- `fix/<short-description>` — bug fixes
- `docs/<short-description>` — documentation changes
- `refactor/<short-description>` — code refactoring

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add member photo upload
fix: prevent duplicate edges in canvas
docs: update README installation steps
refactor: extract edge rendering logic
chore: upgrade dependencies
```

### Before Submitting a PR

- [ ] Run `npm run lint` — must pass with 0 errors
- [ ] Run `npx tsc --noEmit` — must pass with 0 errors
- [ ] Run `npm run build` — must succeed
- [ ] Test your changes in the browser
- [ ] Update documentation if needed

### Pull Request Process

1. Create a branch from `main`
2. Make your changes with clear, atomic commits
3. Ensure all checks pass (lint, tsc, build)
4. Open a PR with a clear description of what changed and why
5. Link any related issues

## 🏗️ Code Style

- **TypeScript** strict mode — no `any` types (use proper types)
- **React** functional components with hooks
- **Tailwind CSS v4** for styling — prefer utility classes over custom CSS
- **Imports** — use `import type` for type-only imports
- **File naming** — PascalCase for components (`MemberCard.tsx`), camelCase for utilities (`tierLayoutManager.ts`)

## 🧪 Testing

Currently the project has no automated tests. If you add a feature, consider adding tests (Vitest for units, Playwright for E2E). We're happy to help scope this — just ask in [Discussions](https://github.com/ltmoerdani/stemmagraph/discussions).

## 📁 Project Structure

See the [README](README.md#-architecture) for the architecture overview.

## ❓ Questions?

- Quick question → [Discussions](https://github.com/ltmoerdani/stemmagraph/discussions)
- Bug report → [open an issue](https://github.com/ltmoerdani/stemmagraph/issues/new?labels=bug) with the `bug` label
- Feature idea → [open an issue](https://github.com/ltmoerdani/stemmagraph/issues/new?labels=enhancement) with the `enhancement` label

Thanks for helping Stemmagraph grow! 🌳
