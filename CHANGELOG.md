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
