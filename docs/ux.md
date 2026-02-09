# Coach — UX (v1)

Coach is a tiny chip that runs while the user works. It shows a Component Drift modal when a component instance is detached. Guidance is global per category (Component/Text/Color/Typography), with built-in defaults and file-level overrides. Indexing is file-level and optional.

## Screens

- Tiny chip (runtime)
- Guidance editor (tabs + editor + preview)
- Index: start (initiate indexing)
- Index: results (indexed list + Done)
- Drift modal (runtime)

## User flow

### 0. Default launch (everyone)

- User opens Coach manually (no auto-start).
- Coach opens in **Tiny chip** view.
- Chip shows **Detach N** + **Setup** (gear icon).
- Setup opens the Guidance editor (everyone can edit).

### 1. Drift detection (v1)

- User selects a component instance and detaches it.
- Coach detects the detach.
- Coach increments **Detach** count.
- Coach shows the **Drift modal** using:
  1. File override content (if saved), else
  2. Built-in defaults

### 2. Modal actions

- CTA 1 / CTA 2 / ✕ all close the modal → Tiny chip.
- Detach count remains persisted.

### 3. Guidance (category-based)

- From Tiny chip, click the Setup/gear icon → opens **Guidance editor**.
- 4 category tabs: **Component / Text / Color / Typography**.
- Each tab edits: Headline, Description (rich text), CTA 1 label, CTA 2 label.
- Right column: **Live Preview** of how the drift modal will look.
- Save is explicit.
- Saved content becomes the file-level override used by drift modals in that file.

### 4. Indexing (file-level)

- From Guidance editor, click **Index** (top-level tab) → shows **Index: start**.
- Click **Index components** → run scan.

### 5. Index results

- Shows list of discovered components / component sets.
- Click **Done** → return to Tiny chip.

### 6. Index behavior

- Indexing only stores the set of component identifiers for this file (for recognition).
- Guidance remains global per category, not per component.

## Wireframes

### A) Tiny chip

```
┌──────────────────────────────┐
│ Detach 3                 ⚙   │
└──────────────────────────────┘
```

### B) Guidance editor

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Coach                                                                 [ ✕ ]  │
├──────────────────────────────────────────────────────────────────────────────┤
│ [ Guidance ]   [ Index ]                                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│ [ Component ] [ Text ] [ Color ] [ Typography ]                               │
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────┐  ┌─────────────────────────┐ │
│ │ HEADLINE                                     │  │ PREVIEW                  │ │
│ │ [ _______________________________________ ]  │  │ ┌─────────────────────┐ │ │
│ │                                              │  │ │ COMPONENT DRIFT      │ │ │
│ │ DESCRIPTION (rich text)                      │  │ │ <headline>           │ │ │
│ │ [B] [I] [🔗]                                  │  │ │ <body…>              │ │ │
│ │ ┌──────────────────────────────────────────┐ │  │ │                     │ │ │
│ │ │                                          │ │  │ │ [ CTA 1 ] [ CTA 2 ]  │ │ │
│ │ └──────────────────────────────────────────┘ │  │ └─────────────────────┘ │ │
│ │                                              │  └─────────────────────────┘ │
│ │ CTA 1 LABEL              CTA 2 LABEL         │                            │
│ │ [ ____________________ ]  [ ____________________ ]                         │
│ │                                              │                            │
│ │ [ Save ]                                      │                            │
│ └──────────────────────────────────────────────┘                            │
└──────────────────────────────────────────────────────────────────────────────┘
```

### C) Drift modal

```
┌──────────────────────────────────────────┐
│ Coach                               [ ✕ ]│
│ COMPONENT DRIFT                          │
│ <headline>                               │
│ <description excerpt…>                   │
│                                          │
│ [ <CTA 1 label> ]          [ <CTA 2 label> ]│
└──────────────────────────────────────────┘
```

### D) Index: start

```
┌──────────────────────────────────────────────────────────────┐
│ Coach                                                  [ ✕ ]  │
├──────────────────────────────────────────────────────────────┤
│ [ Guidance ]   [ Index ]                                     │
├──────────────────────────────────────────────────────────────┤
│ Index this file's components                                  │
│ Coach will scan local components/component sets so it can      │
│ recognize detaches more reliably.                              │
│                                                              │
│                                   [ Cancel ] [ Index components ]│
└──────────────────────────────────────────────────────────────┘
```

### E) Index: results

```
┌──────────────────────────────────────────────────────────────┐
│ Coach                                                  [ ✕ ]  │
├──────────────────────────────────────────────────────────────┤
│ [ Guidance ]   [ Index ]                                     │
├──────────────────────────────────────────────────────────────┤
│ 128 components found                                          │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ ✓ Button / Primary                                       │ │
│ │ ✓ Button / Secondary                                     │ │
│ │ ✓ Card                                                   │ │
│ │ ✓ Input                                                  │ │
│ │ …                                                       │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                            [ Done ]          │
└──────────────────────────────────────────────────────────────┘
```

## Persistence

All stored as file-level plugin data (same for every user who opens the file):

- `detachCount` — number, persisted
- `guidanceOverrides` — object keyed by category: component/text/color/typography
- `indexedComponents` — array of component identifiers captured during indexing

## Guard rule

When the user is in the Guidance editor or Index screens, drift events should increment Detach count silently but not pop the Drift modal.

## Architecture / sitemap

```
Runtime path
─────────────
  Tiny chip  ──▶  Drift modal
  (always on)     (on drift event)

Editing path
─────────────
  Tiny chip  ──▶  Guidance editor

Index path
───────────
  Guidance editor  ──▶  Index: start  ──▶  Index: results  ──▶  Tiny chip

Note: Built-in defaults exist until a user overrides guidance in this file.
```
