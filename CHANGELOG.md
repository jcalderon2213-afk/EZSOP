# EZSOP Changelog

## 2025-02-21

### Step 1: Design System Setup
**Files modified:**
- index.html — Added Google Fonts (DM Sans, Fraunces) preconnect + stylesheet
- src/index.css — Added @theme block with all design tokens (colors, fonts, radius, shadows) and body base styles

**Design tokens registered:**
- 22 colors, 2 font families, 3 border-radius values, 2 box shadows
- Body defaults: bg #FAF7F2, font DM Sans, color #2C2520

**Status:** Verified visually in browser ✓

---

### Step 2: App Shell Layout
**Files created:**
- src/components/layout/AppShell.tsx — 3-zone layout (sidebar + top bar + main content)
- src/components/layout/Sidebar.tsx — 260px fixed sidebar with logo, 6 nav items, separators, footer
- src/components/layout/TopBar.tsx — 56px top bar with breadcrumb placeholder

**Files modified:**
- src/App.tsx — Replaced heading with AppShell layout

**Layout specs:**
- Sidebar: 260px fixed, dark bg, hides on mobile (<lg breakpoint)
- Top bar: 56px, white bg, border-bottom
- Main content: fluid, scrollable, 40px horizontal / 32px vertical padding, max-width 1100px

**Status:** Verified visually in browser ✓

---

### Step 3: Route Tree, Nav Links, Breadcrumbs & Placeholder Pages
**Files created (14 pages):**
- src/pages/DashboardPage.tsx
- src/pages/SOPLibraryPage.tsx
- src/pages/SOPDetailPage.tsx — reads :id param
- src/pages/CreateSOPPage.tsx — stepper bar (Context → Voice → Transcript → Draft → Compliance) + Outlet
- src/pages/ContextUploadPage.tsx
- src/pages/VoiceCapturePage.tsx
- src/pages/TranscriptReviewPage.tsx
- src/pages/DraftEditorPage.tsx
- src/pages/ComplianceAuditPage.tsx
- src/pages/BusinessProfilePage.tsx
- src/pages/PracticeModePage.tsx
- src/pages/PracticeChatPage.tsx — reads :scenarioId param
- src/pages/PracticeDebriefPage.tsx — reads :scenarioId param
- src/pages/ComplianceLogPage.tsx

**Files modified:**
- src/App.tsx — Full route tree with React Router (/ redirects to /dashboard, nested create SOP sub-routes)
- src/components/layout/AppShell.tsx — children prop replaced with Outlet, page-enter animation on route change
- src/components/layout/Sidebar.tsx — buttons replaced with NavLink, custom active detection (SOP Library vs Create SOP)
- src/components/layout/TopBar.tsx — Dynamic breadcrumbs from URL segments with label map, chevron separators, clickable links
- src/index.css — Added page-enter keyframe animation (opacity + translateY, 300ms)

**Route tree:**
- / → redirect to /dashboard
- /dashboard, /sops, /sops/:id, /profile, /practice, /compliance
- /sops/create with 5 nested sub-steps (context, voice, transcript, draft, compliance)
- /practice/:scenarioId, /practice/:scenarioId/debrief

**Status:** Pending visual verification

---

### Structured Logging Utility
**Files created:**
- src/lib/logger.ts — Structured JSON logger with DEBUG/INFO/WARN/ERROR/FATAL levels

**Files modified:**
- .env — Added VITE_LOG_LEVEL=DEBUG

**Features:**
- Environment-agnostic: detects import.meta.env (Vite/browser) with process.env (Node.js) fallback
- setContext() for persistent context (userId, orgId) auto-attached to every log entry
- clearContext() to reset persistent context
- Min log level via VITE_LOG_LEVEL env var (defaults to DEBUG in dev, INFO in production)
- Outputs structured JSON: { level, event, timestamp, context, metadata }
- Exports: default singleton + named Logger class for testing

**Status:** Reviewed and approved ✓

---

### Auth Pages
**Files created:**
- src/pages/LoginPage.tsx — Email + password form, Supabase signInWithPassword, signup success banner
- src/pages/SignupPage.tsx — Email + password + confirm, client-side validation, Supabase signUp
- src/pages/ForgotPasswordPage.tsx — Email-only form, Supabase resetPasswordForEmail, confirmation message
- src/pages/ResetPasswordPage.tsx — New password + confirm, Supabase updateUser

**Files modified:**
- src/App.tsx — Added 4 auth routes outside AppShell wrapper (no sidebar/topbar)

**Details:**
- All pages: centered card layout on cream bg, EZSOP logo in Fraunces, design token styling
- Structured logger integration: auth_login_*, auth_signup_*, auth_forgot_password_*, auth_reset_password_*
- Routes: /login, /signup, /forgot-password, /reset-password

**Status:** Verified visually in browser ✓

---
