# Handoff: Architecture Pattern — Relationship Map (option 1a)

## Overview
Redesign of the **Architecture Pattern detail screen** (currently: title, Draft badge, dark "federated summary" banner with *Open in GitHub*, a metadata strip, and a vertical "Initiatives using this pattern" list). The new design replaces the list with a **relationship map**: Applications ← Initiatives → Technology Components, joined by curved connectors, so reuse of shared components is visible at a glance. A detail strip below the map shows the selected initiative's description.

## About the Design Files
The files here are **design references built in HTML** — prototypes of the intended look and behaviour, not production code. Recreate them in the existing **Next.js 15 (App Router) + React 19 + TypeScript 5.7** codebase using its established patterns, components and styling approach. Do not ship the HTML.

- `Pattern Views.dc.html` — contains three options; **implement only `#1a` "Relationship map"**. (1b and 1c are context only.) Open in a browser; it loads `_ds/.../styles.css` — `modernist-styles.css` here is that same stylesheet, for token reference.
- `modernist-styles.css` — design tokens (`:root` variables) and component classes (`.btn`, `.tag`).

## Fidelity
**High-fidelity.** Colours, type, spacing, rules and zero radius are final. Sample data is illustrative — only *Vendor EDI Modernization* is real; the other three initiatives were invented to exercise the layout. Bind to real data.

## Architecture (Next.js)
```
app/patterns/[patternId]/page.tsx            Server Component — fetches pattern + initiatives, builds graph
components/pattern/PatternHeader.tsx          Server — title, kicker, Draft tag, GitHub button
components/pattern/PatternMetaStrip.tsx       Server — 4-cell ruled metadata grid
components/pattern/RelationshipMap.tsx        'use client' — layout, SVG connectors, selection/hover
components/pattern/InitiativeDetail.tsx       Server or client child — selected initiative description
lib/patterns/buildPatternGraph.ts             Pure function: initiatives → { apps, initiatives, techs, links }
```
- Fetch in `page.tsx` (Server Component); pass a **serialisable** graph to `RelationshipMap`. No client fetching.
- Selection state lives in the client map. Optionally mirror to the URL (`?initiative=<id>`) via `useRouter().replace` / `useSearchParams` so the selection is linkable and the server can render the detail strip.
- No mutations on this screen → no Server Actions needed. If a "Sync now" action is added later, implement as a Server Action + `revalidatePath`.
- `generateMetadata` → `title: pattern.name`.

### Types
```ts
type Lifecycle = 'APPROVED' | 'CONTAINED' | 'RETIRE' | string;      // technology component
type TimeStatus = 'INVEST' | 'TOLERATE' | 'MIGRATE' | 'ELIMINATE' | string; // application (Gartner TIME)

interface PatternGraph {
  pattern: { id: string; name: string; category: string; status: 'Draft' | string;
             owner: string; sourceSystem: string; sourceLastModified: string; lastSynced: string;
             githubUrl: string; coreTechIds: string[] };
  initiatives: { id: string; name: string; businessUnit: string; owner: string; description: string;
                 appIds: string[]; techIds: string[] }[];
  apps:  { id: string; name: string; status: TimeStatus; usedBy: number }[];
  techs: { id: string; name: string; vendor: string; lifecycle: Lifecycle; usedBy: number }[];
}
```
`buildPatternGraph` de-duplicates apps/techs across initiatives and computes `usedBy`. **Core tech** = the component(s) the pattern is about (e.g. AWS Transfer Family). Derive from pattern metadata if available, otherwise `usedBy === initiatives.length`.

## Screen: Pattern detail

Page container: background `--color-bg` `#f3f2f2`, padding 40px, content width 1120px (fluid — see Responsive). Vertical sections gap 32px.

### 1. Header
Flex row, `justify-content: space-between; align-items: flex-end; gap 24px`, `padding-bottom 20px`, **border-bottom 2px solid `--color-text` (#201e1d)**.
- **Left column** (flex column, gap 10px):
  - Kicker: `Architecture pattern · {category}` — 13px / 600, letter-spacing .08em, uppercase, colour `--color-accent-700` #ae1800.
  - H1: pattern name — Archivo 800, 40px, line-height 1.05, letter-spacing −.01em, margin 0.
  - Status tag: `.tag.tag-outline` "Draft".
- **Right column** (flex column, gap 8px, max-width 240px, items flush left):
  - Primary button `.btn.btn-primary`, min-width 200px, label **flush left**, Lucide `arrow-up-right` 16px pushed right (`justify-content: space-between`). Text "Open in GitHub". `href = githubUrl`, `target="_blank" rel="noopener"`.
  - Caption 12px / 1.4, `--color-neutral-700` #605d5d: "Federated summary. The full pattern document lives in GitHub." (replaces the old dark banner).

### 2. Metadata strip
Sits directly under header (pulled up: `margin-top: -32px` to cancel section gap). `grid-template-columns: repeat(4, minmax(0,1fr))`, border-bottom 2px `--color-divider` (`#201e1d` @ 40%).
Cells: padding 14px 16px (first cell left padding 0), cells 2–4 have `border-left: 2px solid --color-divider`. Each cell flex column gap 4px:
- Label 11px, letter-spacing .08em, uppercase, `--color-neutral-700`.
- Value 15px, `--color-text`.
Cells: Owner · Source system · Source last modified · Last synced (format `YYYY-MM-DD HH:mm UTC`). Category and Status moved into header.

### 3. Relationship map
**Column header row**: grid `280px 140px 280px 140px 280px`; labels 11px / 700, uppercase, .08em: `Applications · {n}`, (gap), `Initiatives · {n}`, (gap), `Technology components · {n}`. 16px gap to the map.

**Canvas**: `position: relative`, width 1120, height = `max(rows) × rowPitch`. An absolutely-positioned `<svg>` (same size, `fill="none" stroke-width="2"`) sits behind absolutely-positioned node boxes.

Column x-ranges: Apps 0–280 · Initiatives 420–700 · Techs 840–1120.

| Column | Node height | Row pitch | Node centre y |
|---|---|---|---|
| Applications | 48 | 64 | 32 + i·64 |
| Initiatives | 64 | 80 | 40 + i·80 |
| Technology | 48 | 80 | 40 + i·80 |

(When counts differ greatly, compute pitch so columns share the same total height: `pitch = totalHeight / count`.)

**Connectors** (cubic béziers, horizontal tangents):
- Initiative → App: `M 420 yI C 350 yI, 350 yA, 280 yA`
- Initiative → Tech: `M 700 yI C 770 yI, 770 yT, 840 yT`

Connector colours:
- Default: `--color-neutral-400` #bab6b6.
- Links of the **selected** initiative: `--color-accent` #ec3013.
- Links from non-selected initiatives to a **core tech**: `--color-accent-300` #ffc4b8.
- Draw default links first, accent links last (on top).

**Ordering**: sort apps and techs so their links cross as little as possible — simplest heuristic: order by the mean index of the initiatives that use them; core tech first.

#### Application node
280×48, background `--color-surface` #eae9e9, padding `0 12px 0 16px`, flex row `space-between`, centre-aligned, gap 8px.
- Name 14px / 600 (700 when linked to selected initiative).
- TIME tag right: INVEST/TOLERATE → `.tag.tag-outline` / `.tag.tag-neutral`; MIGRATE/ELIMINATE → `.tag.tag-accent`.
- Linked to selected initiative: `border-left: 4px solid --color-accent`, left padding 12px.

#### Initiative node
280×64, padding 10px 14px, flex column centred, gap 2px, `cursor: pointer`, rendered as a `<button>` (full keyboard support).
- Name 15px / 700. Sub-line 12px: `{businessUnit} · {owner}`.
- **Unselected**: background `--color-bg`, border 2px solid `--color-text`, sub-line `--color-neutral-700`. Hover: background `--color-accent-100` #fff2ef.
- **Selected**: background `--color-text`, text `--color-bg`, sub-line opacity .8, no border change needed.
- Focus-visible: `outline: 2px solid var(--color-accent); outline-offset: 2px`.

#### Technology node
280×48, padding 0 12px, flex row `space-between`. Left stack: name 14px / 600, vendor 11px `--color-neutral-700`.
- Lifecycle tag right: APPROVED → `.tag.tag-outline`; RETIRE → `.tag.tag-accent`.
- **Core tech**: background `--color-accent`, text `#fff`, name 700, sub-line `{vendor} · used by {usedBy} of {total}`, lifecycle as plain text 11px / 700 / .06em uppercase (not a tag).

### 4. Selected initiative detail
`grid-template-columns: 280px minmax(0,1fr)`, border-top 2px `--color-text`.
- Left (padding 16px 16px 0 0): label "Selected initiative" (11px uppercase meta label style) + name 18px / 800.
- Right (padding 16px 0 0 16px, border-left 2px `--color-divider`): description 16px / 1.5.

## Interactions & Behaviour
- **Default selection**: first initiative (or `?initiative=` param).
- **Click / Enter / Space on initiative** → select it; connectors, app highlights and detail strip update. No animation required; optional 150ms ease on `stroke` colour.
- **Hover initiative** (optional enhancement): temporarily paint its connectors `--color-text` without changing selection.
- **Hover app/tech node** (optional): highlight all initiatives that use it.
- Apps/techs may link to their own detail pages (`next/link`) if those exist.
- **Empty state**: no initiatives → replace the map with a single ruled row: "No initiatives use this pattern yet." (16px, `--color-neutral-700`).
- **Loading**: `loading.tsx` with three grey 280×48 blocks per column on `--color-surface`.
- **Accessibility**: SVG `aria-hidden="true"`. Provide an equivalent visually-hidden list (initiative → apps, techs) or `aria-describedby` on each initiative button listing its components. Tag colours never the only signal — status text always shown.

## Responsive
- ≥1120px: as specified.
- 760–1119px: scale column widths proportionally (compute x positions from the container width via `ResizeObserver`; gaps = 1/2 node width).
- <760px: drop the SVG; render a stacked list per initiative (initiative block → "Applications" and "Technology" rows of nodes as above). Keep 2px rules between initiatives.

## Design Tokens (from `modernist-styles.css`)
- `--color-bg` #f3f2f2 · `--color-surface` #eae9e9 · `--color-text` #201e1d
- `--color-accent` #ec3013 · `--color-accent-100` #fff2ef · `--color-accent-300` #ffc4b8 · `--color-accent-600` #dd2b0f (pressed) · `--color-accent-700` #ae1800 (accent text)
- `--color-neutral-400` #bab6b6 · `--color-neutral-700` #605d5d
- `--color-divider` = `color-mix(in srgb, #201e1d 40%, transparent)`
- Font: **Archivo** (headings weight 800, body 400/600/700). Use `next/font/google` → `Archivo`.
- Spacing: 4 / 8 / 12 / 16 / 24 / 32px (`--space-1…8`).
- Radius: **0 everywhere**. No shadows on this screen.
- Rules: major dividers 2px `--color-text`; cell dividers 2px `--color-divider`.

If the app already has its own tokens, map these values onto them rather than introducing a second system.

## Assets
- Icon: Lucide `arrow-up-right` (`lucide-react`). No images.

## Files
- `Pattern Views.dc.html` — design reference; option **1a** is the target.
- `modernist-styles.css` — tokens and `.btn` / `.tag` class definitions.
