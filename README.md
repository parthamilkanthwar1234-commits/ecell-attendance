# 🚀 E-Cell RSCOE Attendance & Session Management Portal

Official attendance, meeting governance, Minutes of Meeting (MoM), and domain operations platform for the **Entrepreneurship Cell (E-Cell), JSPM's Rajarshi Shahu College of Engineering (RSCOE)**.

---

## 📋 Table of Contents
- [Overview](#-overview)
- [Key Features](#-key-features)
- [Role-Based Access Control (RBAC)](#-role-based-access-control-rbac)
- [Domain Structure](#-domain-structure)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Project Architecture](#-project-architecture)
- [Contributing & Commit Policy](#-contributing--commit-policy)

---

## 📌 Overview

The **E-Cell RSCOE Attendance Portal** is a production-grade web application tailored for managing organizational workflows, meeting attendance, action items, and official Minutes of Meeting (MoM) across all verticals of E-Cell RSCOE. Built with modern React and TypeScript, it integrates directly with Supabase Cloud for instant synchronization, multi-device access, and reliable real-time updates.

---

## ✨ Key Features

- **⚡ Fast Attendance Tracking**: Mark attendance for general meetings, domain meetups, workshops, and core committee sessions with single-click bulk toggles, dirty-state change protection, and instant cloud sync.
- **📝 Official RSCOE MoM Formats**:
  - In-app digital Minutes of Meeting generator conforming to institutional RSCOE layout.
  - Scribe delegation, agenda tracking, key decisions, action items with status tags, and verification workflow.
  - Document viewer with export/print capability.
- **👥 Member & Domain Directory**: Comprehensive vertical filtering, leadership assignments, domain co-lead management, and active status tracking.
- **📊 Real-Time Analytics & Reporting**: Attendance percentage heatmaps, domain comparisons, session frequency charts, and downloadable performance reports powered by Recharts.
- **🛡️ Audit Logs & Governance**: Automated tracking of administrative actions, attendance updates, role elevations, and session modifications.
- **☁️ Supabase Cloud & Resilient Local State**: Transparent cloud backup with fallback demo data resilience for uninterrupted on-ground operations.

---

## 🔐 Role-Based Access Control (RBAC)

The portal enforces granular permissions across hierarchical roles:

| Role | Access Level | Responsibilities |
|---|---|---|
| **Primary Master Admin** | System Root | Full governance, primary administrative control, credentials & security |
| **Master Admin** | Root Admin | Complete system control, user elevated permissions, session oversight |
| **President** | Executive | Cross-domain analytics, meeting authorization, high-level review |
| **General Secretary** | Executive | Session scheduling, MoM review, attendance validation |
| **Domain Lead** | Lead Admin | Full vertical attendance, domain meeting creation, action item follow-up |
| **Domain Co-Lead** | Co-Lead | Domain attendance marking, meeting assistance, vertical updates |
| **Scribe / Member** | Standard | View sessions, edit assigned MoM documents, track personal attendance |

---

## 🏢 Domain Structure

E-Cell RSCOE is organized into specialized functional verticals:
- **Event Production & Curation**
- **Public Relations & Marketing**
- **Finance Management**
- **Graphics Design**
- **Technical & Data Management**
- **Content Development**
- **Social Media**
- **General E-Cell / Core Committee**

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript
- **Styling**: Tailwind CSS v4, Lucide React icons
- **Data Visualization**: Recharts
- **State & Cloud Storage**: Supabase (`@supabase/supabase-js`), React Context API
- **Tooling & Bundler**: Vite, Oxlint

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18.0.0 or higher recommended)
- npm, pnpm, or yarn

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/parthamilkanthwar1234-commits/ecell-attendance.git
   cd ecell-attendance
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment**:
   ```bash
   cp .env.example .env
   ```
   Provide your Supabase URL and anonymous public key in `.env`.

4. **Start Development Server**:
   ```bash
   npm run dev
   ```

5. **Build for Production**:
   ```bash
   npm run build
   ```

---

## 🔑 Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## 📂 Project Architecture

```
ecell-attendance/
├── public/                 # Static assets, institutional banners & logos
├── src/
│   ├── assets/             # Brand graphics and images
│   ├── components/
│   │   ├── layout/         # Navigation, Sidebar, and App Shell
│   │   ├── mom/            # Official MoM Editor modal and Document Viewer
│   │   └── ui/             # Reusable UI primitives (Modals, Badges, Toast, Stats)
│   ├── context/            # Global AppContext (Supabase sync, state, auth)
│   ├── lib/                # Supabase client, utility helpers, and seed data
│   ├── pages/              # Primary route views (Dashboard, Attendance, MoM, Analytics)
│   ├── types/              # Domain, Member, Session, and MoM TypeScript schemas
│   ├── App.tsx             # Application routing & layout tree
│   └── main.tsx            # React application entry point
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 🤝 Contributing & Commit Policy

- **Direct Main Workflow**: Direct commits to `main` are authorized for rapid deployment and continuous synchronization.
- **Semantic Commits**: Use descriptive messages following conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`).
- Always verify type compliance before pushing changes.

---

Developed with ❤️ by **E-Cell RSCOE Technical & Data Management Team**.
