# Handoff: Pattern Review — App Header (Option 1b "Paper")

## Overview
This is a new top navigation bar for **Pattern Review**, an app where architecture patterns are reviewed and approved. It replaces the old dark header and keeps the same content: brand, four nav links, the signed-in user and Sign out.

## About the Design Files
The files here are **design references built in HTML**. They show how the header should look and behave. They are not production code to paste in. Rebuild the header in the target codebase's existing setup (React, Vue, etc.), following its patterns for components, routing and auth. `header-1b-reference.html` is plain HTML/CSS with no dependencies and is the simplest file to read. `Header Redesign.dc.html` is the original exploration file; option **1b** is the one chosen.

## Fidelity
**High-fidelity.** Match the colors, type, spacing and states below exactly.

## Visual rules (Modernist style)
- **No rounded corners anywhere.** Border radius is 0.
- **No shadows.** Layout comes from solid 2px dividers.
- **Everything is left-aligned.** This includes the Sign out label: its text sits at the left and the icon at the right.
- Use a single font, **Archivo** (Google Fonts, weights 500/600/700/800).

## Layout
- `<header>`: full width, **height 64px**, background `#FFFFFF`, **border-bottom 2px solid `#34373F`**. It uses `display:flex; align-items:stretch`, so every cell fills the full height. Set `white-space:nowrap` on the whole header.
- The header is made of four cells, left to right:

### 1. Brand cell
- Padding `0 32px`, min-width 240px, **border-right 2px solid `#D1D8E0`**. Flex row, centered vertically, gap 12px. Links to home.
- Mark: a solid bar **10×28px**, `#E1242A`.
- Two stacked lines of text, gap 3px, line-height 1:
  - "ARCHITECTURE": 11px / 600, uppercase, letter-spacing 0.14em, `#891515`
  - "Pattern Review": 18px / 800, letter-spacing −0.01em, `#000000`

### 2. Primary nav (`flex:1`)
- Links: **Patterns · Review queue · Users · Roles**
- Each link is a cell with padding `0 24px`, min-width 136px, **border-right 2px solid `#EDF2F4`**, and 14px text. Text and badge are centered vertically, with an 8px gap.
- **Default:** text `#34373F`, weight 500, background `#FFFFFF`.
- **Hover:** background `#EDF2F4`.
- **Active (current route):** text `#E1242A`, weight 700, plus a **4px `#E1242A` bar** along the bottom edge of the cell. The bar is offset `bottom:-2px` so it sits over the header's bottom rule. Mark the active link with `aria-current="page"`.
- **Focus-visible:** `outline: 2px solid #E1242A; outline-offset: -2px`.
- **Count badge** (Review queue only): the number of pending reviews. Background `#E1242A`, text `#FFFFFF`, 11px / 700, padding `2px 6px`, square corners. Hide it when the count is 0.
- Optional variant (a tweak in the prototype): the active link can use a **fill** instead. Background `#34373F`, white text, keeping the red bottom bar.

### 3. User cell
- Padding `0 24px`, **border-left 2px solid `#D1D8E0`**, flex row, gap 20px.
- Two lines of text, gap 2px:
  - Name: 14px / 600, `#000000` (e.g. "Alejandro Lopez")
  - Role: 11px / 500, uppercase, letter-spacing 0.1em, `#34373F` (e.g. "ARB MEMBER")
- Avatar: **36×36px square**, background `#34373F`, initials in `#FFFFFF` 12px / 700, centered. This is the one centered element. If a photo is available, show it square and in grayscale.

### 4. Sign out button
- Fills the full header height at the far right edge. Min-width 148px, padding `0 20px`, no border.
- Background `#E1242A`, text `#FFFFFF`, 14px / 600.
- Flex row with `justify-content: space-between`: the label on the left and a 16px Lucide `log-out` icon on the right (2px stroke, `currentColor`).
- **Hover** `#BD120A` · **Pressed** `#891515` · **Focus-visible:** 2px `#E1242A` outline with offset −2px.

## Interactions & Behavior
- Clicking a nav link goes to its route. The active state comes from the current route, not a click handler.
- Sign out calls the app's existing logout flow.
- No animations. State changes are instant, in keeping with the flat Modernist style.
- **Responsive (not designed, suggested):** below about 1024px, drop the "ARCHITECTURE" kicker and the user name/role text but keep the avatar. Below about 768px, collapse the nav into a menu button cell styled like the other cells.

## State / Data
- `currentRoute`: sets which link is active.
- `pendingReviewCount: number`: the badge on Review queue.
- `user: { name, role, initials | avatarUrl }`
- `onSignOut()`

## Design Tokens
| Token | Hex | Use |
|---|---|---|
| red | `#E1242A` | Brand mark, active link, badge, Sign out |
| red-hover | `#BD120A` | Sign out hover |
| red-deep | `#891515` | Kicker text, Sign out pressed |
| ink | `#000000` | Title, user name |
| graphite | `#34373F` | Nav text, role, avatar, header bottom rule |
| mist | `#EDF2F4` | Nav dividers, nav hover |
| rule | `#D1D8E0` | Brand and user cell dividers |
| white | `#FFFFFF` | Header background, text on red and graphite |

Other palette colors not used in this header: `#a1b1c4`, `#F78C85`, `#450A0A`.

- Borders: 2px only. Active bar: 4px. Radius: 0. Shadows: none.
- Type scale: 11 / 12 / 14 / 18px.
- Spacing: 2, 3, 6, 8, 12, 20, 24, 32px.

## Assets
- Icon: Lucide `log-out` (https://lucide.dev). Use the `lucide-react` package or your framework's equivalent.
- Font: Archivo (Google Fonts).
- No images.

## Files
- `header-1b-reference.html`: a standalone reference implementation of option 1b. Open it in a browser.
- `Header Redesign.dc.html`: the original exploration with options 1a, 1b and 1c. Only 1b applies. It needs the design-tool runtime to render, so use it for reference only.
