# Coach — UX

Coach is a Figma plugin that lives as a tiny chip while the designer works and surfaces a drift modal whenever a design-system violation occurs (component detach, style removal, variable unbinding). Admins author guidance messages for 4 drift categories (Component, Text, Color, Typography) directly inside the DS library file; every other designer sees those messages at the moment of drift.

## Screens

- Tiny chip (runtime)
- Drift modal (runtime)
- Admin access (email gate)
- Admin authoring (tabs + editor + preview)
- Admin list (allowlist)

## User flow

### 0. Default Runtime (everyone)

- User opens Coach plugin manually (no auto-start in Design Mode).
- UI shows tiny chip: **Detach N** + **⚙**.
- Plugin listens for drift events:
  - **v1:** component detach only.
  - **v2:** text style removed/changed, variable binding removed/changed (color/typography).
- On drift → show Coach modal for the matching category:
  - Headline + description excerpt.
  - 2 CTAs (labels are authorable by admins).
  - Close **[✕]**.
- Detach count increments on every drift event.

### 1. First-Time Setup (admins only, in the LIBRARY file)

- Admin opens the DS library source file (the published component library).
- Admin opens Coach and clicks **⚙**.
- If allowlist is empty → bootstrap: first admin adds themselves.
- Setup screen appears:
  - Admin allowlist editor (add/remove admin emails).
  - **Continue** button.
- ⚙ → onboarding → allowlist → Continue → Authoring.

### 2. Admin Authoring (admins only, in library file)

- Admin authoring screen has **4 tabs**: Component / Text / Color / Typography.
- 👤 opens Admin list.
- Each tab edits:
  - Headline (single line).
  - Description (rich text).
  - CTA 1 label (text).
  - CTA 2 label (text).
- Right column shows **live Preview** of the runtime modal.
- Save is explicit — one Save saves all 4 categories at once.
- Show **"Saved"** confirmation.
- Dirty indicator per tab (dot) when unsaved changes exist.

### 3. Shared Content Location (library as source of truth)

- Authored category content is stored in the library file.
- Designers in other files see the same content without entering email or doing setup.

### 4. Runtime Consumption (everyone, in ANY file using the library)

- Designers work in their own design files (not the library).
- They open Coach (tiny chip stays running).
- On drift → Coach shows the modal using shared category content authored in the library.
- Non-admins never see setup/admin UI.

### 5. Permissions Rules

- Admin status = current user email is in allowlist.
- Admins can open Setup / Admin screens.
- Non-admins: **⚙** is hidden or no-op; only tiny chip + runtime modal.

### 6. Fallback Behavior

- If shared library content can't be found/read:
  - Coach shows built-in default message for that category (still functional).

## Wireframes

### A) Tiny chip

```
┌──────────────────────────────┐
│ Detach 3                 ⚙   │
└──────────────────────────────┘
```

### B) Admin access

```
┌────────────────────────────┐
│ Admin access          [ ✕ ]│
│                            │
│ Email                      │
│ [ you@company.com       ]  │
│                            │
│              [ Continue ]  │
└────────────────────────────┘
```

### C) Drift modal

```
┌──────────────────────────────────────────┐
│ Coach                               [ ✕ ]│
│ Component drift detected                 │
│ <headline>                               │
│ <description excerpt…>                   │
│                                          │
│ [ <Undo label> ]            [ <Docs label> ]│
└──────────────────────────────────────────┘
```

### D) Setup allowlist

```
┌──────────────────────────────────────────────────────────────┐
│ Setup                                                  [ ✕ ]  │
├──────────────────────────────────────────────────────────────┤
│ Admin allow list                                               │
│ [ add admin email ________________________________ ] [ Add ]   │
│ • hakan@company.com                                        ⓧ   │
│ • designops@company.com                                     ⓧ   │
│                                                              │
│ [ Continue ]                                                  │
└──────────────────────────────────────────────────────────────┘
```

### E) Admin authoring

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Coach                                                                 [ ✕ ]  │
├──────────────────────────────────────────────────────────────────────────────┤
│ [ Component ] [ Text ] [ Color ] [ Typography ]                         👤     │
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────┐  ┌─────────────────────────┐ │
│ │ Headline                                     │  │ Preview                  │ │
│ │ [ _______________________________________ ]  │  │ ┌─────────────────────┐ │ │
│ │                                              │  │ │ Coach               │ │ │
│ │ Description (rich text)                      │  │ │ Component drift     │ │ │
│ │ ┌──────────────────────────────────────────┐ │  │ │ ------------------- │ │ │
│ │ │                                          │ │  │ │ <rendered headline> │ │ │
│ │ │                                          │ │  │ │ <rendered body…>    │ │ │
│ │ └──────────────────────────────────────────┘ │  │ │                     │ │ │
│ │ [B] [I] [•] [1.] [🔗]                        │  │ │ [ Undo ] [ Open docs]│ │ │
│ │                                              │  │ └─────────────────────┘ │ │
│ │ CTA 1 label               CTA 2 label        │  └─────────────────────────┘ │
│ │ [ ____________________ ]  [ ____________________ ]                           │
│ └──────────────────────────────────────────────┘                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Architecture / sitemap

```
Runtime path
─────────────
  Tiny chip  ──▶  Drift modal
  (always on)     (on drift event)

Admin path
─────────────
  ⚙  ──▶  Admin access  ──▶  Authoring
           (email gate)       (4 tabs)
  If allowlist empty → bootstrap (auto-add first admin)
  If email not in allowlist → return to chip (no error)

👤 in Authoring opens Admin list.
Note: Built-in defaults exist until library config is present.
```
