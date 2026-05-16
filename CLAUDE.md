# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Nền Nếp CNT** — A competitive scoring management system for THPT Chuyên Nguyễn Trãi (Hải Dương). Built with React + TypeScript + Vite + TailwindCSS. Backend is Google Apps Script (GAS) deployed as a REST API; database is Google Sheets.

## Commands

```bash
npm run dev       # Start dev server
npm run build     # Production build (must pass before pushing to trigger Netlify deploy)
npm run preview   # Preview built dist locally
```

No test runner is configured — manual testing flow: login as `RED_FLAG` role (test entry), then as `ADMIN` (test settings/bulk).

## Architecture

### Data Flow
- On app load, `AppContext` calls `api.getAllData()` once and caches everything in global state.
- All filtering/search runs on in-memory React state — never re-fetches for filters.
- Write operations use batch endpoints (`batchCreateViolations`, `batchUpdateViolations`) — never loop N individual calls from the client.

### Frontend → Backend
All API calls go through [services/googleApi.ts](services/googleApi.ts) which POSTs to the GAS deployment URL. To avoid CORS preflight, requests use `Content-Type: text/plain`. The GAS URL is hardcoded in that file.

### Backend
[gas_backend.gs](gas_backend.gs) is the entire backend. It's deployed as a Google Apps Script Web App. To modify backend behavior, edit this file and re-deploy from the Google Apps Script editor. The Spreadsheet ID and Drive folder ID are constants inside this file.

### State Management
- [contexts/AppContext.tsx](contexts/AppContext.tsx) — global data store (users, classes, students, violations, achievements, criteria, time configs)
- [contexts/ModalContext.tsx](contexts/ModalContext.tsx) — toast/confirm/alert dialog management; reuse these hooks instead of building new modal logic

### Key Types
All core TypeScript interfaces live in [types.ts](types.ts). When adding new data fields, update the interface here AND update the `SCHEMA` headers object in `gas_backend.gs`.

## Critical Rules (from PROJECT_RULES.md)

**No Supabase** — completely removed. Never add it back.

**Batching** — GAS has cold-start latency. Any bulk operation (delete many, import Excel) MUST use batch endpoints. Never loop API calls on the client.

**Password security** — `verifyLogin` is server-side only. `getAllData` returns `safeUser` objects with no password field. Reset password generates `CNT@xxxx` format and sends via GAS `MailApp` — do not change this format.

**Vietnamese text** — Excel import uses Unicode normalization + diacritic stripping for fuzzy matching (e.g., `Hóa` ≈ `Hoá`). Preserve this logic.

**Points sign convention** — Positive points → `Violations` sheet (deductions). Negative points → `Achievements` sheet (bonuses).

**UI theme** — Red/yellow "Đoàn" theme: `from-red-700 to-red-900` gradient background, `yellow-300` text. Keep the star-fall animation. Do not redesign the theme.

## Deployment

Netlify auto-deploys on git push to main. Build must pass (`npm run build`) with zero lint/type errors before pushing. Publish directory: `dist`.
