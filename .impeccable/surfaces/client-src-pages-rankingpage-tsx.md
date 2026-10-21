---
version: 1
slug: "client-src-pages-rankingpage-tsx"
primary_target: "client/src/pages/RankingPage.tsx"
related_targets:
  - "client/src/pages/RankingPage.css"
---

## Scope

Route /ranking. Visitor mode: Operate. Existing-world, code-first alignment with the current learning and room pages under issue #148. The job is to compare actual XP and Elo standings and find the learner's own place. Global navigation and visual identity remain outside this surface's scope.

## Direction contract

THESIS: Two clear scoreboards make learning progress and Arena competition directly comparable while keeping the learner's own standing easy to find.

ESTABLISHED WORLD: Reuse .room-tokens from client/src/components/room/room.css, including its light-theme override. client/src/components/learn/learn.css is the incumbent reference for pixel headings with Archivo reading text. Jersey 10 comes from --rm-pixel: var(--font-heading) and client/src/index.css; headings, places and score numerals use it at weight 400. Names, row metadata, controls and prose use Archivo. Shared navy/light surfaces, blue own-row emphasis and compact square pixel portraits carry the site's current language. This local typography and border treatment does not replace the global identity.

STORY: Read the two metrics, scan each best ten, locate the blue own row or its separate own-position section, then open a player profile or continue learning and Arena play.

FIRST VIEWPORT: Heading and learning/Arena links above two equal boards. Each board has its own explanation, semantic table and footer action. The shell is 1240px maximum; boards have a 28px gap and 4px corners with shared line separators. At 960px the heading actions move below the title, at 820px the boards stack, and at 480px padding and fixed table columns tighten. Names wrap instead of forcing page overflow.

FORM: Paired scoreboards with a three-player podium above the remaining table entries. Shared UserAvatar supplies 56px podium portraits, 72px for first place and 40px table portraits, compacted on mobile. Gold/silver/bronze steps use actual rank values and preserve ties. Shared LeagueIcon and leagueFor supply Elo league marks and names. XP rows use existing level and rank-title helpers. Reuse the existing trophy PixelSprite, with no new raster assets or invented data.

## Data and interaction invariants

- Preserve ranking-points and ranking-elo tour hooks and heading IDs.
- Preserve GET /api/ranking/summary through rankingApi.getSummary({ sessionKey }) and the existing RankingSummaryDto: ranking, user, myRank. Entries retain username, avatar, points, elo, rankPoints and rankElo.
- Sort each metric independently, with the existing username tie-break; display returned global rankPoints or rankElo, never the rendered row index. Show a dash for an unavailable position.
- Move at most three players with actual ranks 1 through 3 onto the podium; do not duplicate them in the table. Both podium profile links remain accessible and the current user keeps a visible Ty marker.
- Personal goals select the closest higher score available in the response, without claiming it is the immediately preceding global place. Show the exact difference plus one to overtake, a score progress bar for positive target scores and the relevant learning/Arena action. First place, including ties, gets a leading message instead.
- Include the learner in a separate own-position table body when myRank is outside that board's top ten. Keep blue emphasis through hover and focus. Guest guidance links to sign-in.
- Portrait and username are keyboard-accessible profile links, with self links going to /profile. Keep visible focus outlines, table captions and column headers; do not make rows pointer-only controls.
- Preserve session-scoped loading, stale-response cleanup, shared skeletons, board-specific empty copy, failure alert and retry. A session change must not expose a previous session's standing.
- Reuse shared token easing for brief hover fills and honour reduced motion. Keep both dark and light theme overrides active.

## Finish evidence

Latest podium/goal pass: 11 RankingPage tests and 7 loading regression tests passed, with 100% RankingPage line coverage and 94.95% branch coverage. Typecheck and lint passed. Earlier backend 29 tests passed; this pass changes no backend code. Available browser surfaces returned CUA []; rendered visual approval remains pending. Trophy provenance is the existing shared PixelSprite asset. This is a bounded extension, not a refresh of older dashboard or profile documentation.
