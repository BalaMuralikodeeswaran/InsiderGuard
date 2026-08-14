# InsiderGuard — PRD

## Original Problem Statement
Build InsiderGuard: an AI-based insider threat detection & employee risk monitoring SOC web app. Analyze employee activity logs, detect abnormal behaviour with ML, assign 0-100 risk scores with explainable reasons, raise alerts, support investigations, and generate PDF incident reports. Prototype only — no real employees monitored.

## User Choices
- Auth: JWT email/password (bcrypt, httpOnly cookies, RBAC)
- ML: real scikit-learn (Isolation Forest + Local Outlier Factor) computed in backend
- Data: auto-seeded simulated dataset (48 employees, ~1100 activity logs)
- Theme: dark "security operations" (Chivo/Inter/JetBrains Mono, zinc + blue accent)

## Architecture
- Backend: FastAPI + Motor(MongoDB). Modules: server.py (routes), ml_engine.py (feature engineering, IsolationForest+LOF, risk scoring, explainable AI, evaluation), seed.py (simulated dataset tiers: normal/borderline/elevated/insider), pdf_report.py (ReportLab), auth.py (JWT+bcrypt).
- Frontend: React + Recharts + shadcn/ui + sonner + lucide. AuthContext + ProtectedRoute + Layout(sidebar/topbar/global search/notifications).

## User Personas
- Administrator (admin@insiderguard.io / Admin@123): full access incl. user management, settings, audit logs.
- Security Analyst (analyst@insiderguard.io / Analyst@123): upload, analyze, alerts, investigate, reports.

## Core Requirements (static)
Auth+RBAC, CSV upload + data cleaning + quality report, ML anomaly detection + risk scoring (0-30 Low/31-60 Med/61-80 High/81-100 Critical), explainable AI reasons, dashboard stats+charts, employee registry + detail, alerts, investigations, PDF reports, analytics + ML evaluation, notifications, settings, global search.

## Implemented (2026-06 — v1.0)
- JWT auth (login/logout/me/refresh/forgot/reset), bcrypt, brute-force lockout, RBAC (admin-only users/settings/audit endpoints return 403 for analyst).
- Auto-seed: 48 employees / ~1128 logs, ML analysis on startup. Risk bands populated Low/Medium/High/Critical.
- Dashboard: 6 KPI cards + risk-tier strip + 8 charts (risk distribution, dept risk, daily suspicious, login-time, download/USB/email trends).
- Employees: filterable/searchable registry; detail page with explainable AI reasons, behavioural features, risk timeline, suspicious events, device history, related alerts, recommended actions.
- CSV upload with validation/cleaning + quality report + re-analysis; template download.
- Alerts: auto-generated, filter/triage drawer (status, assign analyst, notes).
- Investigations: create/update, status, notes, evidence, false-positive, history.
- Reports: generate + download valid PDF (ReportLab).
- Analytics: honest ML evaluation vs seed ground-truth (IsolationForest selected, acc 0.98 / prec 0.88 / recall 1.0 / f1 0.93), confusion matrix, feature importance, model comparison, threats, login heatmap, stat totals.
- Notifications, Settings (thresholds/working hours/session), User Management, Profile, Help, About.
- Tested: backend 39/39 pytest pass; frontend all key flows pass (iteration_1.json).

## Backlog / Remaining
- P1: Split server.py into routers; use per-email brute-force counter with X-Forwarded-For; tighten CORS origins for cross-origin.
- P2: Monthly-incident trend chart; audit-log viewer UI page; real evidence file upload (object storage); email notification delivery.

## Next Tasks
- Await user feedback; prioritize any requested feature depth.
