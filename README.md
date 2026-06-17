<div align="center">

# 🌳 Stemmagraph

**Build, visualize, and share beautiful family trees.**  
Open-source, interactive, and free — forever.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-stemmagraph.app-22c55e?style=for-the-badge&logo=githubpages)](https://ltmoerdani.github.io/stemmagraph/)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg?style=for-the-badge)](LICENSE)
[![Commercial License](https://img.shields.io/badge/Also%20Commercial-Dual%20Licensed-orange.svg?style=for-the-badge)](LICENSE.md)
[![CI](https://img.shields.io/github/actions/workflow/status/ltmoerdani/stemmagraph/ci.yml?branch=main&style=for-the-badge&label=CI)](https://github.com/ltmoerdani/stemmagraph/actions/workflows/ci.yml)
[![Deploy](https://img.shields.io/github/actions/workflow/status/ltmoerdani/stemmagraph/deploy.yml?branch=main&style=for-the-badge&label=Deploy)](https://github.com/ltmoerdani/stemmagraph/actions/workflows/deploy.yml)

[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646cff?style=flat-square&logo=vite&logoColor=white)](https://vite.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-7-2d3748?style=flat-square&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![React Flow](https://img.shields.io/badge/@xyflow/react-12-ff007a?style=flat-square)](https://xyflow.com/)

[✨ Features](#-features) · [🚀 Live Demo](#-live-demo) · [📦 Quick Start](#-quick-start) · [🤝 Contributing](#-contributing) · [💬 Discussions](https://github.com/ltmoerdani/stemmagraph/discussions)

</div>

---

> **Stemma** *(noun)* — a genealogical chart; from Greek στέμμα, "garland of ancestors."
> Stemmagraph turns that garland into an interactive, exportable graph anyone can explore.

## ✨ Features

- **🎨 Interactive family tree canvas** — drag, zoom, and pan a live genealogy graph built on [React Flow](https://xyflow.com/)
- **🧭 Multiple views** — canvas, grid, table, and list for browsing members however you like
- **👤 Rich member profiles** — birth/death dates, places, profession, education, photos, contact info
- **🔗 Relationship types** — parent–child, marriage, and sibling edges with custom rendering
- **📤 Export anywhere** — download your tree as **PDF** or **PNG image**
- **🔌 Adapter pattern** — swap between REST API, Supabase, or in-memory mock without touching UI code
- **🔐 Secure auth** — JWT sessions + bcrypt password hashing
- **📱 Responsive** — works seamlessly on desktop and mobile

## 🚀 Live Demo

Try Stemmagraph right now — **no signup, no backend, no install**:

> **🔗 https://ltmoerdani.github.io/stemmagraph/**

The demo runs entirely in your browser using the in-memory **mock adapter** with the pre-seeded *Wijaya* family tree (11 members, 3 generations).

**Demo login:** `demo@familytree.app` / `demo123`

Want to run it locally? See [Quick Start](#-quick-start).

## 📦 Quick Start

### Prerequisites

- **Node.js** 20.19+ or 22.12+ (recommend LTS 24)
- **npm** 10+

### Option A — Local development (full stack)

```bash
# Clone
git clone https://github.com/ltmoerdani/stemmagraph.git
cd stemmagraph
npm install

# Configure environment
cp .env.example .env

# Initialize the database
npm run db:migrate
npm run db:seed

# Start frontend + API together
npm run dev:full
```

- **Frontend:** http://localhost:5201
- **API:** http://localhost:3001/api/v1
- **Demo login:** `demo@familytree.app` / `demo123`

### Option B — Frontend-only demo (no backend)

```bash
git clone https://github.com/ltmoerdani/stemmagraph.git
cd stemmagraph
npm install

# Use the mock data adapter
cp .env.github-pages .env
npm run dev
```

The mock adapter serves seed data in-memory — perfect for exploring the UI or previewing your changes.

<details>
<summary><strong>🔌 Choose a data adapter</strong></summary>

Stemmagraph uses an adapter pattern so the UI is backend-agnostic. Set `VITE_DATA_ADAPTER` in `.env`:

| Value | Backend | Use case |
|---|---|---|
| `mock` | In-memory | Demos, UI development, GitHub Pages |
| `rest` | Express API (this repo) | Full-featured local or self-hosted |
| `supabase` | Supabase | Managed PostgreSQL + auth |

```bash
# REST (default for full-stack dev)
VITE_DATA_ADAPTER=rest
VITE_API_BASE_URL=http://localhost:3001/api/v1

# Supabase
VITE_DATA_ADAPTER=supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

</details>

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | [React 19](https://react.dev/), [Vite 8](https://vite.dev/), TypeScript 6 |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) |
| **Canvas** | [@xyflow/react v12](https://xyflow.com/) (React Flow) |
| **State** | [Zustand 5](https://github.com/pmndrs/zustand) |
| **Backend** | [Express 5](https://expressjs.com/), [Prisma 7](https://www.prisma.io/) |
| **Database** | SQLite (dev), PostgreSQL/MySQL ready |
| **Auth** | JWT + [bcryptjs](https://github.com/dcodeIO/bcryptjs) |
| **Export** | [jsPDF](https://github.com/parallax/jsPDF), [html2canvas](https://html2canvas.hertzen.com/) |

## 📜 Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Vite dev server (frontend, port 5201) |
| `npm run dev:server` | Start Express API server (port 3001) |
| `npm run dev:full` | Start both frontend + API concurrently |
| `npm run build` | Production build (set `GITHUB_PAGES=true` for demo build) |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed database with demo data |
| `npm run db:studio` | Open Prisma Studio GUI |

## 🏗️ Architecture

```
stemmagraph/
├── src/                      # Frontend (React + Vite)
│   ├── components/           # UI components
│   │   ├── FamilyTree/       # Canvas, nodes, edges, controls
│   │   ├── Dashboard/        # Landing + tree management
│   │   ├── Forms/            # Member add/edit forms
│   │   ├── Sidebar/          # Stats + member detail panels
│   │   └── Auth/             # Login page
│   ├── store/                # Zustand state stores
│   ├── lib/adapters/         # Data adapter pattern (REST/Supabase/Mock)
│   ├── types/                # Shared TypeScript types
│   └── data/                 # Mock data
├── server/                   # Backend (Express + Prisma)
│   └── index.ts              # API server with JWT auth
├── prisma/                   # Database schema + migrations + seed
│   ├── schema.prisma         # Data models
│   ├── migrations/           # SQL migrations
│   └── seed.ts               # Demo data
├── .github/workflows/        # CI + GitHub Pages deploy
└── vite.config.ts            # Vite config (base-path aware)
```

The **adapter pattern** (`src/lib/adapters/`) is the heart of Stemmagraph's flexibility — the entire UI talks to a single `DataAdapter` interface, so you can plug in any backend (or run fully client-side) without changing a line of component code.

## 🤝 Contributing

Contributions of **all sizes** are welcome — bug reports, feature ideas, UI polish, docs, tests, or just a typo fix.

1. ⭐ **Star** the repo to follow along
2. 🍴 **Fork** & clone your fork
3. 🔀 **Create a branch**: `feat/my-awesome-idea`
4. ✅ **Run checks**: `npm run lint && npx tsc --noEmit && npm run build`
5. 📤 **Open a PR** following the [conventions](CONTRIBUTING.md)

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for the full workflow, branching, and commit conventions.

### Good first issues

New to the codebase? Look for issues labeled [`good first issue`](https://github.com/ltmoerdani/stemmagraph/labels/good%20first%20issue) — these are scoped to be friendly on-ramps.

### Roadmap

- [ ] Internationalization (i18n) — share your locale in [Discussions](https://github.com/ltmoerdani/stemmagraph/discussions)
- [ ] GEDCOM import/export
- [ ] Collaborative editing
- [ ] Photo gallery per member
- [ ] Automated tests (Vitest + Playwright)

Have an idea? Open a [Discussion](https://github.com/ltmoerdani/stemmagraph/discussions) or an [issue](https://github.com/ltmoerdani/stemmagraph/issues/new).

## 🔐 Security

- **Passwords** hashed with bcrypt (12 rounds)
- **JWT** sessions with 7-day expiry
- **Auth middleware** protects all API routes except `/auth/login` and `/auth/register`
- **Input validation** on every auth endpoint

See **[SECURITY.md](SECURITY.md)** for responsible disclosure.

## 📄 License — dual-licensed

Stemmagraph uses a **dual-license model**: open source + commercial.

| Use case | License |
|---|---|
| Personal use, study, modify, share | [**AGPL-3.0**](LICENSE) — free |
| Self-host as SaaS **(you publish your source)** | [**AGPL-3.0**](LICENSE) — free |
| Closed-source SaaS or proprietary product | [**Commercial License**](LICENSE.md) — paid |

> **TL;DR:** AGPL-3.0 means anyone who offers Stemmagraph as a network service
> must publish their modifications. If that doesn't work for you (e.g. you're
> building a closed-source SaaS), you can purchase a commercial license from
> `license [at] ltmoerdani [dot] com`.

**Contributors:** by submitting a PR, you agree to the [CLA](CLA.md) so we can
offer both licenses. See [`LICENSE.md`](LICENSE.md) for details.

This model is used by **Mattermost, MinIO, Sentry, Plausible, Mastodon** — it
keeps the project open source forever while funding development.

<div align="center">

**[⭐ Star](https://github.com/ltmoerdani/stemmagraph)** · **[🐛 Report bug](https://github.com/ltmoerdani/stemmagraph/issues/new?labels=bug)** · **[💡 Request feature](https://github.com/ltmoerdani/stemmagraph/issues/new?labels=enhancement)** · **[💬 Discuss](https://github.com/ltmoerdani/stemmagraph/discussions)**

Made with 🌳 for everyone who wants to remember where they came from.

</div>
