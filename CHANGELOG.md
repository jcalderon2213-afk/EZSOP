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

### Auth Context, Route Guards & Onboarding Check
**Files created:**
- src/contexts/AuthContext.tsx — AuthProvider + useAuth hook, Supabase onAuthStateChange, auto-create user profile in `users` table, exposes session/userProfile/loading/signOut
- src/components/LoadingScreen.tsx — Full-screen EZSOP logo with pulse animation while auth resolves
- src/components/auth/ProtectedRoute.tsx — Redirects to /login if no session, to /onboarding if no org_id (requireOrg prop)
- src/components/auth/AuthRoute.tsx — Redirects logged-in users to /dashboard (blocks access to auth pages)
- src/pages/OnboardingPage.tsx — Placeholder for business profile setup wizard

**Files modified:**
- src/App.tsx — Wrapped in AuthProvider, auth routes in AuthRoute, /onboarding in ProtectedRoute(requireOrg=false), app routes in ProtectedRoute

**Route guard logic:**
- Not logged in → /login
- Logged in, no org_id → /onboarding
- Logged in, has org_id → app routes
- Already logged in visiting /login or /signup → /dashboard

**Structured log events:**
- auth_session_restored, auth_session_ended
- user_profile_fetched, user_profile_created
- auth_guard_redirect (with from/to paths)

**Status:** Pending visual verification

---

### Schema Update: orgs.industry_label → industry_type + industry_custom_label
**Migration:** Manual SQL (not in code)
- Removed `industry_label` (TEXT) column from `orgs` table
- Added `industry_type` (TEXT) — stores the selected industry category
- Added `industry_custom_label` (TEXT, nullable) — stores custom label when industry_type is "Other"

---

### Phase 2 Step 7: RLS Policies + created_by on Org Creation
**Files created:**
- sql/rls-policies.sql — Full RLS policy script for manual execution in Supabase SQL Editor

**Files modified:**
- src/pages/OnboardingPage.tsx — Added created_by: userProfile.id to orgs insert

**RLS policies:**
- Helper function: get_user_org_id() returns current user's org_id
- orgs: SELECT (org member or creator), INSERT (created_by = self), UPDATE (org member), DELETE (creator only)
- users: SELECT (own row or org members), INSERT (own row), UPDATE (own row)
- governing_bodies: SELECT/UPDATE/DELETE (org member), INSERT (org member OR org creator for onboarding race condition)

**Status:** Pending — SQL must be run manually in Supabase SQL Editor

---

### Phase 3 Step 2: SOP Library Page
**Files modified:**
- src/pages/SOPLibraryPage.tsx — Full rewrite: fetch SOPs, responsive card grid, status badges, empty state, loading

**Status:** Verified ✓

---

### Phase 3 Step 3: SOP Create Form
**Files modified:**
- src/pages/CreateSOPPage.tsx — Full rewrite: title/category/purpose/frequency form, inserts draft SOP, navigates to detail

**Status:** Verified ✓

---

### Phase 3 Step 4: SOP Detail Page
**Files modified:**
- src/pages/SOPDetailPage.tsx — Full rewrite: fetch SOP, read-only view, inline edit mode, Supabase save

**Status:** Verified ✓

---

### Phase 3 Step 5: SOP Step Editor
**Files modified:**
- src/pages/SOPDetailPage.tsx — Added steps section: add, edit, delete (soft), reorder (Move Up/Move Down)

**Status:** Verified ✓

---

### Phase 3 Step 6: SOP Lifecycle Actions
**Files modified:**
- src/pages/SOPDetailPage.tsx — Added publish/archive/unarchive/delete lifecycle buttons with inline confirmation

**Status:** Verified ✓

---

### Phase 3 Step 7: Business Profile Page
**Files modified:**
- src/pages/BusinessProfilePage.tsx — Full rewrite: fetch org + governing bodies, read-only view with detail cards, edit mode with all onboarding fields, save via soft-delete-all + re-insert for governing bodies

**Features:**
- Read-only view: Business Info card (org name, industry, location) + Governing Bodies card with bordered rows
- Edit mode: same fields as onboarding wizard (org name, industry dropdown, state/county/city, governing bodies add/remove)
- Governing body URLs rendered as clickable links in read-only view
- Save: updates org row, soft-deletes existing governing bodies, inserts new ones, re-fetches
- Logger events: profile_fetch_success/error, profile_update_attempt/success/error

**Status:** Pending visual verification

---

### Toast Notification System
**Files created:**
- src/contexts/ToastContext.tsx — ToastProvider + useToast() hook, auto-dismiss after 4s, exit animation, multiple simultaneous toasts
- src/components/ToastContainer.tsx — Fixed bottom-center stack, left color accent bar per type (success/error/warning/info), close button

**Files modified:**
- src/index.css — Added toast-enter (slide-up 300ms) and toast-exit (fade-out 200ms) keyframe animations
- src/App.tsx — Wrapped Routes in ToastProvider (inside AuthProvider)

**Usage:**
- `const { showToast } = useToast()`
- `showToast("Message", "success" | "error" | "warning" | "info")`

**Status:** Pending visual verification

---

### Wire Toast Notifications into Pages
**Files modified:**
- src/pages/CreateSOPPage.tsx — success toast on create, error toast on failure (2 calls)
- src/pages/SOPDetailPage.tsx — success/error toasts for: save edits, publish, archive, unarchive, delete SOP, add/edit/delete/reorder steps (14 calls)
- src/pages/BusinessProfilePage.tsx — success toast on profile save, error toast on failure (2 calls)

**Notes:**
- All existing logger events preserved — toasts are user-facing, logger is developer observability
- All existing inline error displays preserved — toasts supplement them
- Total: 18 showToast calls across 3 files

**Status:** Pending visual verification

---

### Extract BuildStepper + Build VoiceCapturePage
**Files created:**
- src/components/BuildStepper.tsx — Shared 5-step stepper bar (Context > Voice > Transcript > Draft > Compliance), accepts currentStep and optional steps array, 3 visual states (current/completed/upcoming)
- src/pages/VoiceCapturePage.tsx — Full rewrite: SOP title fetch, BuildStepper (step 2), large textarea for typing/dictating, Web Speech API (webkitSpeechRecognition) mic toggle with pulse animation and duration timer, speech-to-text appends to textarea, Clear button, localStorage save/restore keyed by SOP id, Continue/Skip/Back navigation

**Files modified:**
- src/pages/ContextUploadPage.tsx — Replaced inline BuildStepper with shared component import
- src/index.css — Added pulse-record keyframe animation for recording indicator

**Logger events:** voice_capture_start, voice_capture_stop, voice_capture_error, voice_capture_saved

**Status:** Pending visual verification

---
