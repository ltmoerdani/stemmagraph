# Stemmagraph

> Open-source family tree platform for building, visualizing, and sharing genealogical graphs.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646cff.svg)](https://vite.dev/)

## ✨ Features

- **Interactive family tree canvas** — drag, zoom, and pan with [@xyflow/react](https://xyflow.com/)
- **Multiple views** — canvas, grid, table, and list views for browsing family members
- **Member management** — add, edit, and connect family members with rich metadata (birth, death, profession, education, photos)
- **Relationship types** — parent-child, marriage, sibling relationships with custom edge rendering
- **Export** — download family tree as PDF or image
- **Auth** — JWT-based authentication with bcrypt password hashing
- **Adapter pattern** — swap between REST API, Supabase, or mock data via environment variable
- **Responsive** — works on desktop and mobile

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite 8, TypeScript 6 |
| **Styling** | Tailwind CSS v4 |
| **Canvas** | @xyflow/react v12 (React Flow) |
| **State** | Zustand 5 |
| **Backend** | Express 5, Prisma ORM |
| **Database** | SQLite (dev), PostgreSQL/MySQL ready |
| **Auth** | JWT + bcryptjs |
| **Export** | jsPDF, html2canvas |

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20.19+ or 22.12+ (recommend LTS 24)
- **npm** 10+

### Installation

```bash
# Clone the repository
git clone https://github.com/ltmoerdani/stemmagraph.git
cd stemmagraph

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Set up the database
npm run db:migrate
npm run db:seed
```

### Development

```bash
# Start frontend only (port 5201)
npm run dev

# Start backend API only (port 3001)
npm run dev:server

# Start both frontend + backend concurrently
npm run dev:full
```

**Demo login:** `demo@familytree.app` / `demo123`

### Production Build

```bash
npm run build    # Build frontend
npm run preview  # Preview production build
```

## 📜 Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Vite dev server (frontend, port 5201) |
| `npm run dev:server` | Start Express API server (port 3001) |
| `npm run dev:full` | Start both frontend + API concurrently |
| `npm run build` | Production build |
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
├── index.html                # Vite entry HTML
└── vite.config.ts            # Vite + Rolldown config
```

### Data Adapters

Stemmagraph uses an adapter pattern so you can switch backends without changing UI code:

```bash
# Use REST API (default)
VITE_DATA_ADAPTER=rest

# Use Supabase
VITE_DATA_ADAPTER=supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-key

# Use in-memory mock (no backend needed)
VITE_DATA_ADAPTER=mock
```

## 🔐 Security

- **Passwords** are hashed with bcrypt (12 rounds)
- **JWT tokens** for session management (7-day expiry)
- **Auth middleware** protects all API routes except `/auth/login` and `/auth/register`
- **Input validation** on registration (min 8 char password)

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

[MIT](LICENSE) © 2026 ltmoerdani
