---
name: Hackademy
description: Polish CTF learning platform where structured paths and live competition share one scoreboard.
colors:
  brand-blue: "#0b63ff"
  brand-blue-ink: "#ffffff"
  cta-hover: "#4a8dff"
  cta-hover-light: "#0845b8"
  blue-soft: "rgba(11, 99, 255, 0.18)"
  blue-soft-light: "rgba(11, 99, 255, 0.12)"
  next-field: "#142a52"
  next-field-ink: "#ffffff"
  next-field-muted: "#c3d3ef"
  next-field-light: "#d9e5fb"
  next-field-ink-light: "#0b1f44"
  next-field-muted-light: "#2f4570"
  captured-teal: "#2fd0b0"
  captured-teal-light: "#0a7d68"
  link-blue: "#6ea2ff"
  link-blue-light: "#0b55db"
  navy-ground: "#0f1724"
  surface: "#151f30"
  surface-raised: "#1c2840"
  board: "#0b111c"
  track: "#26344f"
  ink: "#e8edf5"
  muted: "#9eabbf"
  tip-bg: "#1f2b42"
  chip: "#2c3a55"
  ground-light: "#e5e7eb"
  surface-light: "#f9fafb"
  surface-raised-light: "#eef1f6"
  board-light: "#dfe5ee"
  track-light: "#cfd7e3"
  ink-light: "#111827"
  muted-light: "#4b5563"
  tip-bg-light: "#ffffff"
  diff-easy: "#56d364"
  diff-medium: "#e3b341"
  diff-hard: "#ff8a80"
  diff-insane: "#c9a2ff"
  diff-easy-light: "#1a7f37"
  diff-medium-light: "#8a5d00"
  diff-hard-light: "#c62828"
  diff-insane-light: "#7a3fd6"
  streak: "#ff9f43"
  streak-light: "#d9480f"
typography:
  rank:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(5rem, 3.5rem + 5vw, 7.5rem)"
    fontWeight: 800
    lineHeight: 0.9
    letterSpacing: "-0.04em"
    fontVariation: "'wdth' 70"
  display:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 1.4rem + 2.6vw, 3.5rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 85"
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.2
  numeral:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 800
    lineHeight: 1.1
    fontFeature: "'tnum'"
    fontVariation: "'wdth' 75"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    fontFeature: "'tnum'"
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
rounded:
  hair: "2px"
  chip: "4px"
  base: "6px"
  round: "50%"
spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.brand-blue}"
    textColor: "{colors.brand-blue-ink}"
    rounded: "{rounded.base}"
    padding: "0 24px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.cta-hover}"
  button-quiet:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.base}"
    padding: "0 24px"
    height: "48px"
  button-small:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.base}"
    padding: "0 16px"
    height: "36px"
  button-small-hover:
    backgroundColor: "{colors.brand-blue}"
    textColor: "{colors.brand-blue-ink}"
  next-room-field:
    backgroundColor: "{colors.next-field}"
    textColor: "{colors.next-field-ink}"
    rounded: "{rounded.base}"
    padding: "32px 36px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.base}"
    padding: "24px 28px"
  standings-card:
    backgroundColor: "{colors.board}"
    textColor: "{colors.ink}"
    rounded: "{rounded.base}"
    padding: "28px 24px 20px"
  standings-row-me:
    backgroundColor: "{colors.brand-blue}"
    textColor: "{colors.brand-blue-ink}"
    rounded: "{rounded.base}"
    padding: "9px 12px"
  recommended-card:
    backgroundColor: "{colors.blue-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.base}"
    padding: "20px"
  place-chip:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
    padding: "2px 8px"
  floating-card:
    backgroundColor: "{colors.tip-bg}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.base}"
    padding: "16px"
---

# Design System: Hackademy

> **Scope.** This system is currently implemented only on the user dashboard (`/dashboard`, `client/src/pages/UserDashboardPage.*`, `client/src/components/ProfilePeek.tsx`). Its tokens are the `--ud-*` custom properties scoped under `.user-dashboard`. The rest of the app, including the global Navbar and Footer, still runs on the older global styles in `client/src/index.css` and `client/src/styles/theme.css`. Treat this file as the direction for surfaces that are redesigned next, not as a description of the whole app today.

## Overview

**Creative North Star: "The Scoreboard"**

Learning and competition sit side by side as one scoreboard. The left column is the learner's own track: the next room in a blue-tinted field, the path as a segmented rail, level and recent flags, friends. The right column is the standings card: a huge condensed rank number, the XP gap to the place above with a bar, a window of the ranking with the learner's row filled in brand blue, and a recommended path. Neither half hides the other.

The world is flat and tonal. Depth comes from stepping the navy ground through a few surface tones, never from resting shadows or gradients. One typeface, Archivo, carries everything; its width axis does the expressive work: condensed and heavy for numerals, ranks and room names, normal width for reading text. Numbers are tabular everywhere so scores line up.

Colour is functional. Brand blue `#0b63ff` marks action and the learner's own position; teal marks captured XP and completion; the four difficulty colours appear only as state text. Dark and light themes are both first-class and share every rule; only values change.

**Key Characteristics:**
- Two-column scoreboard split: fluid learning column, 380px sticky standings card.
- Flat tonal layering; shadows only on floating overlays.
- Archivo only, with width (wdth 70 to 100) as the hierarchy tool.
- Brand blue reserved for actions, progress fill and "you are here".
- Tabular numerals throughout.
- Full parity between dark and light themes.

## Colors

A navy (or cool grey in light mode) tonal ladder with one saturated brand blue, one teal for earned progress, and difficulty hues used only as state.

### Primary
- **Hackademy Blue** (`brand-blue`): the brand commitment. Fills primary buttons, the current segment of the path rail, progress meters, the rank-gap bar, the learner's own row in the standings, and text selection. Text on it is always white (`brand-blue-ink`). Hover lifts to `cta-hover` (a lighter blue in dark mode, a deeper blue in light mode).
- **Next-Room Field** (`next-field` / `next-field-light`): a quiet, deep blue-tinted field behind the greeting and next room. It is deliberately not brand blue, so the start button inside it stays the loudest thing on the page. Its text uses `next-field-ink` and `next-field-muted`.
- **Blue Wash** (`blue-soft` / `blue-soft-light`): brand blue at 18% (dark) or 12% (light) alpha. Used for the recommended-path card and the loading skeleton of the next-room block.

### Secondary
- **Captured Teal** (`captured-teal` / `captured-teal-light`): XP earned and things done. Solved segments of the rail, solved-room check marks, "+80 XP" on recent flags, today's XP, "invite sent" confirmations.
- **Link Blue** (`link-blue` / `link-blue-light`): text links, focus outlines, the open-room marker and the info icon next to a term. Lighter than brand blue in dark mode so it reads on navy.

### Tertiary (state only)
- **Difficulty hues** (`diff-easy`, `diff-medium`, `diff-hard`, `diff-insane`, each with a `-light` pair): label text for EASY, MEDIUM, HARD, INSANE. `diff-hard` doubles as the error text colour.
- **Streak Orange** (`streak` / `streak-light`): only the streak flame inside the profile preview.

### Neutral
- **Navy Ground** (`navy-ground`, light: `ground-light`): the page itself, inherited from the global `--bg-dark`.
- **Surface** (`surface`, light: `surface-light`): panels (path, level, flags, friends) and the today strip inside the standings card.
- **Raised Surface** (`surface-raised`, light: `surface-raised-light`): row hover, quiet buttons, small buttons at rest, place chips.
- **Board** (`board`, light: `board-light`): the standings card. In dark mode it steps darker than the ground; in light mode it is a cool grey step, so it always reads as a separate column.
- **Track** (`track`, light: `track-light`): empty segments, meter and bar tracks.
- **Ink / Muted** (`ink`, `muted` and their light pairs): primary and secondary text.
- **Tip Ground** (`tip-bg`, light: `tip-bg-light`) and **Chip** (`chip`): tooltip and profile-preview cards, and the badge and secondary-action chips inside them.

### Named Rules
**The Blue Means Go Rule.** Brand blue is a solid fill only for an action, a progress fill, or the learner's own position. Large informational fields get the tinted `next-field` or `blue-soft`, never solid brand blue.

**The Teal Is Earned Rule.** Teal appears only for XP gained and rooms completed. Never decorate with it.

**The State-Only Difficulty Rule.** Difficulty colours are text colour on a label, never a background, border or badge fill.

## Typography

**Display Font:** Archivo (variable, wdth 62..125, wght 400..800), falling back to system-ui, sans-serif
**Body Font:** Archivo
**Label/Mono Font:** none; labels use Archivo at a smaller size

**Character:** One grotesque used across its width axis. Condensed and heavy, it reads like a stadium scoreboard; at normal width it is a calm, legible reading face.

### Hierarchy
- **Rank** (800, `clamp(5rem, 3.5rem + 5vw, 7.5rem)`, line-height 0.9, -0.04em, width 70%): the learner's rank number in the standings card. One per page.
- **Display** (800, `clamp(2.25rem, 1.4rem + 2.6vw, 3.5rem)`, line-height 1, -0.02em, width 85%, balanced wrap): the next room's name and the headline of full-page error states.
- **Title** (700, 1.375rem, line-height 1.2, normal width): section headings (path name, level, recent flags, friends). The recommended-path title uses the same size at 800 and width 85%.
- **Numeral** (750 to 800, 1.125 to 2.75rem, width 75 to 85%): XP totals, counts, standings positions and points, head-to-head scores, today's XP. Big value numerals (the level XP figure) go to 2.75rem at width 80%.
- **Body** (400, 1rem): running text, capped at 60ch in the next-room field. The greeting is body-adjacent (600, 1.0625rem, line-height 1.4) in the field's muted ink.
- **Label** (400 to 650, 0.875rem): metadata, status words, relative times, scale ends, tooltip text. Sentence case.

### Named Rules
**The Width Is Hierarchy Rule.** Emphasis on numbers and names comes from narrowing the width axis plus weight, not from a second typeface. Reading text stays at normal width.

**The Tabular Rule.** `font-variant-numeric: tabular-nums` is set on the whole surface. Scores must align in columns.

**The No Tracked Caps Rule.** Headings and labels are sentence case with normal or negative tracking. The surface resets letter-spacing to normal on headings and buttons.

## Layout

A two-column scoreboard shell: max width 1320px, centred, padding 40px 24px 56px, columns `minmax(0, 1fr)` and a fixed 380px, gap 32px, aligned to the top. The left column stacks its blocks with a 24px gap; level and recent flags sit side by side as a two-column pair with a 24px gap. The standings card is sticky (top 24px) and stacks its own groups with a 36px gap.

Spacing steps observed in use: 4, 8, 12, 16, 24, 32, 40px, with 20, 28 and 36px used for panel and card padding. List rows use 10px 12px padding with a -12px horizontal margin so the hover fill bleeds to the panel edge while text stays aligned with the heading.

Responsive behaviour:
- **At or below 1080px:** the shell becomes one column, the standings card stops being sticky and moves below the learning column, its rank block and ranking list sit side by side, and a compact rank strip (a link to the card) appears near the top of the learning column.
- **At or below 720px:** shell padding drops to 24px 16px 40px and gaps to 20px; the next-room field pads 24px 20px and its button goes full width; panels pad 20px; the level/flags pair stacks; friend rows wrap head-to-head under the name; rank block and list stack.

## Elevation & Depth

Flat by default. Depth is tonal: ground, surface, raised surface, and the board step, each a few lightness points apart. No resting shadows, no gradients, no borders on cards. The only shadow is the floating overlay shadow, used on tooltips and profile previews, which pairs a 1px hairline ring with a soft drop so the overlay separates from tonal surfaces in both themes.

### Shadow Vocabulary
- **Floating overlay** (dark: `box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08), 0 12px 32px rgba(0, 0, 0, 0.45)`; light: `box-shadow: 0 0 0 1px rgba(15, 23, 36, 0.08), 0 12px 28px rgba(15, 23, 36, 0.16)`): the Elo explanation tooltip and the profile preview card. Nothing else.

### Named Rules
**The Tonal Step Rule.** A container separates from its parent by a surface step, never by a shadow or a border.

**The Only Things That Float Rule.** A shadow means the element is floating above the page (tooltip, preview). If it is in the flow, it is flat.

## Shapes

Gently squared corners (6px) on everything that is a container or a control: panels, fields, buttons, rows, tooltips, previews. Smaller chips (place markers, badges) use 4px. Path rail segments use a near-square 2px; meters and bars use half their height (5px on a 10px meter, 4px on an 8px bar). Avatars are the only full circles (40px in lists and previews, 44px for the learner's own profile row). Focus outlines take the same 6px radius.

## Components

### Buttons
Solid, compact and quiet in shape; the colour carries the meaning.
- **Shape:** gently squared (6px), no border, 48px minimum height, 0 24px padding, weight 650, no wrapping.
- **Primary:** brand blue fill, white text. In the next-room field and the recommended card this is the only solid blue on the block.
- **Hover / Focus:** hover moves to `cta-hover` and lifts 1px; active presses down 1px. Transitions run 160ms on `cubic-bezier(0.16, 1, 0.3, 1)`. Focus is a 2px link-blue outline at 3px offset.
- **Quiet:** raised-surface fill with ink text, for the secondary action in error states.
- **Small:** 36px high, 0 16px padding, label size, raised-surface at rest, filling brand blue on hover. Used for "Challenge" on friend rows. Disabled shows 0.7 opacity and a progress cursor.

### Links
- Link-blue text, weight 600, with an underline that is transparent at rest and fades to the current colour on hover (1px, 4px offset). Used for "whole path", "full ranking", "all friends", "Profile".

### Cards / Containers
- **Corner Style:** 6px.
- **Background:** panels on `surface`; the standings card on `board`; the next-room field on `next-field`; the recommended card on `blue-soft`.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** none.
- **Internal Padding:** panels 24px 28px; next-room field 32px 36px; standings card 28px 24px 20px; recommended card 20px.

### Lists and rows
- Rooms, recent flags, friends and standings share one row grammar: 6px radius, 10px 12px padding with -12px bleed, raised-surface fill on hover over 160ms. Room rows carry a small state mark (check in teal, play in link blue, lock in muted) and a muted status word on the right. Flag rows are a two-by-two grid: title and teal XP above, difficulty label and relative time below.

### Next-Room Field (signature)
The greeting sentence in muted field ink, the next room's name at display size, a one-line room count, and the primary button aligned to the bottom-right (wraps under the copy on narrow widths).

### Path Rail (signature)
One segment per room in a grid, 10px high with 2px corners and 4px gaps: teal for solved, brand blue for the current room, track colour for the rest. Long paths fall back to a single 10px meter filled by `scaleX`.

### Standings Card (signature)
The learner's own profile row, then the rank at rank size, an Elo line with a dotted-underline term button, a today strip (surface fill, 12px 14px padding, today's XP in teal at 1.25rem/800), the XP-gap sentence, the gap bar (8px track, brand-blue fill growing in over 1100ms) with place chips at each end, the ranking window with the learner's row in solid brand blue, a full-ranking link, and the recommended-path card.

### Term Tooltip
A dotted-underlined term with a small link-blue info icon. On hover, focus or tap it reveals a floating card (tip ground, 12px 14px padding, label size, line-height 1.5, max 320px) that fades and settles 4px over 140ms.

### Profile Preview
Hovering or focusing a username in the standings or friends opens a floating card (tip ground, 16px padding, max 300px, 12px internal gap): avatar and name with level, facts (XP, streak with an orange flame), up to a row of 4px-radius badge chips, a secondary "profile" chip and a primary add-friend action. Enters with a 140ms fade and 4px settle.

### Loading and error states
- Skeleton blocks use the matching surfaces (blue wash for the next-room block, raised surface for the rank) and pulse opacity over 1.4s.
- Full-page error: max 640px, display-size headline, muted body, primary plus quiet buttons.
- All entrance animations and transitions switch off under `prefers-reduced-motion: reduce`.

## Do's and Don'ts

### Do:
- **Do** keep brand blue (`#0b63ff`) as a solid fill only for actions, progress fills and the learner's own row.
- **Do** put large highlighted blocks on a tinted field (`next-field`, `blue-soft`) so the button inside stays the loudest element.
- **Do** separate containers by tonal surface steps (ground, surface, raised surface, board).
- **Do** set numerals in condensed, heavy Archivo (width 70 to 85%, weight 750 to 800) with tabular figures.
- **Do** define every colour for both dark and light themes, and check contrast in both.
- **Do** use 6px corners for containers and controls, 4px for chips, full circles only for avatars.
- **Do** use the 160ms `cubic-bezier(0.16, 1, 0.3, 1)` transition for hover fills, and disable motion under reduced-motion.

### Don't:
- **Don't** add resting shadows or borders to cards; the floating overlay shadow is for tooltips and previews only.
- **Don't** use gradients on surfaces, buttons or text.
- **Don't** use difficulty colours as backgrounds or badge fills; they are label text.
- **Don't** add a second typeface; vary Archivo's width and weight instead.
- **Don't** set headings or labels in tracked uppercase.
- **Don't** use decorative icon tiles (an icon in a coloured square or circle); state marks stay small, bare and coloured by state, and icons inside buttons only accompany a text label.
