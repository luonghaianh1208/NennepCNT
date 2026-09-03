# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Nền Nếp** — a competitive scoring (nền nếp / thi đua) management system for Vietnamese secondary
schools, packaged as a white-label product: one build serves every customer school, each on its own
Firebase project. React 18 + TypeScript + Vite. Firestore for data, Firebase Auth for accounts,
Firebase Storage for evidence photos, Cloud Functions for account provisioning.

THPT Chuyên Nguyễn Trãi is the first real deployment and the reference customer. The demo tenant is
`nennep-demo`. **Never hardcode a school's name, colours, grades, or scoring rules** — they belong in
`public/tenant-config.json` (loaded at runtime) or in the `settings/school` Firestore document.

> The Google Apps Script backend and Google Sheets database were retired in September 2026.
> If you find code or docs referring to `gas_backend.gs`, `services/googleApi.ts`, or a
> `script.google.com` URL, it is stale — delete it rather than following it.

## Commands

```bash
pnpm dev            # Dev server
pnpm build          # Production build — must pass before pushing
pnpm test           # vitest (utils, services, report generator)
pnpm preview        # Preview built dist locally
```

`pnpm tsx scripts/demo/*.ts` runs the demo-tenant tooling (seed, verify, permission tests).

## Architecture

### Data flow
- `AppContext` loads in phases: core catalogue → current + previous week → directory in background →
  the rest of the semester on demand. `ensureRangeLoaded` / `ensureAllLoaded` widen the window.
- The current week is kept live with an `onSnapshot` subscription; older data needs a manual refresh.
- All filtering and search runs on in-memory React state — never re-fetch for a filter.
- Writes use the batch helpers (`batchCreateViolations`, `batchUpdateViolations`). Never loop N
  individual writes from the client.

### Frontend → backend
[services/firebase.ts](services/firebase.ts) is the only data-access layer. `initFirebase(config)` is
called once at startup from [index.tsx](index.tsx) with the tenant's config. Every write goes through
`sanitize()`, which strips `undefined` and normalises `date` to `YYYY-MM-DD` — bypassing it produces
records that display correctly but never match a range query.

Account management (create, import, reset, lock, delete, change role) goes through the callables in
[functions/index.js](functions/index.js), which are admin-only and write audit entries.

### Permissions
Twelve permissions in `RolePermissions` ([types.ts](types.ts)), configured per role in
Settings → Vai trò, stored in `settings/roles`. **Enforce every permission in
[firestore.rules](firestore.rules) as well as in the UI** — hiding a button is not access control.
Use `can(roleConfigs, role, permission)` in components; the rules read the same document.

### State management
- [contexts/AppContext.tsx](contexts/AppContext.tsx) — global data store
- [contexts/ModalContext.tsx](contexts/ModalContext.tsx) — toast / confirm / alert; reuse these hooks
  instead of building new modal logic

### Key types
All core interfaces live in [types.ts](types.ts).

## Critical rules

**Per-school configuration** — scoring formula, base score, semester-II multiplier, mandatory
evidence photo, grade list, prize list, activity groups/levels, prize × level score table and theme
all come from `schoolSettings`. Any new hardcoded `500`, `[10, 11, 12]`, or school name is a bug.

**Points sign convention** — positive points → `violations` collection (deductions); negative points
→ `achievements` collection (bonuses). Code that deletes or moves a record must target the collection
matching the record's sign.

**Vietnamese text** — Excel import uses Unicode normalisation + diacritic stripping for fuzzy
matching (`Hóa` ≈ `Hoá`). Preserve this.

**Dates** — always `YYYY-MM-DD` local time. Use `getLocalDateString()`, never
`new Date().toISOString().slice(0,10)` (UTC, off by one after 17:00 Vietnam time). Excel serials go
through `excelSerialToISO`.

**Secrets** — this repository is public. No passwords, endpoints, or customer data in source; use
`.env` (see [.env.example](.env.example)).

**Customer-facing wording** — infrastructure names are deliberately hidden from the UI and from
customer documents. No "Firebase", "Firestore", "Storage", "document", "collection", "server", or raw
SDK error strings in anything a user reads. Wrap caught errors in a Vietnamese sentence that says
what to do next.

**UI theme** — red/yellow "Đoàn" theme by default, but driven by the `--brand-from` / `--brand-to` /
`--brand-accent` CSS variables so each school can retheme. Semantic colours stay fixed: red means
deduction and delete, green means bonus. Keep the star-fall animation.

## Deployment

`firebase deploy` from the tenant's project. `public/tenant-config.json` is served with `no-cache` so
one build can be repointed at a different school without rebuilding.
