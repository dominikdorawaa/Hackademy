---
version: 1
slug: "client-src-pages-userdashboardpage-tsx"
primary_target: "client/src/pages/UserDashboardPage.tsx"
related_targets: []
---

## Scope

Route `/dashboard` (UserDashboardPage). Visitor mode: Operate. The global Navbar stays at the top and is out of scope; everything below it is redesigned.

Audience: Polish learner returning after sign-in. Job: continue the current path, see progress, see standing against others. Data: the existing dashboard summary API only; API changes need the user's consent.

## Direction contract

THESIS: Learning and competition side by side as one scoreboard. Refuses the category default of a greeting over a grid of equal rounded cards with icon chips.

OWN-WORLD: Navy ground #0f1724 with flat tonal steps for surfaces, brand blue #0b63ff as a solid field for the next action and progress, teal #22c3a6 for captured XP, difficulty colours as state only. One family, Archivo: condensed heavy for numerals and room names, normal width for text. No gradients, no resting shadows, no icon chips, no tracked caps.

STORY: The learner sees the next room and starts it in one click; sees how far the path and level have come; sees exactly where they rank and how much XP lifts them one place.

FIRST VIEWPORT: Two columns under the Navbar. Left (fluid): greeting line, the blue next-room block with room name at about 56px and the start button, the path's rooms as a segmented rail, then level/XP and recent flags side by side. Right (about 400px, full height, tonal step darker): rank number at about 120px, Elo, the XP gap to the place above with a bar, the ranking window with the user's row filled, then badges, friends and paths counts.

FORM: Scoreboard split, position 3 on the ordered list of 7 structures, seed key 0b55515b. Signature move: the rank column with the XP-gap bar to the next place.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
