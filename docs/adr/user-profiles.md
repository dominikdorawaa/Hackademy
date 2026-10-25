# User profiles as a personal showcase

Status: accepted

## Context

The profile repeated recent rooms, XP, level progression and Elo already available on the dashboard. The profile should help members present their practice and achievements to other members.

## Decision

Own and other-user profiles share a Steam-inspired identity header, bio and optional interests, a curated earned-badge showcase, a full achievement collection and a twelve-week activity calendar. A learning-statistics section replaces the experience portfolio, showing the best daily result, longest active streak, full date of the most active day, and mean solutions per active day, all within the same last twelve weeks as the calendar. These are personal activity patterns, not dashboard scores. No portfolio request is made by the profile; the existing portfolio API remains available. Until the profile is complete the owner sees one setup prompt with a completion bar and percentage. It counts a saved avatar, a bio, interests and, once a badge has been earned, a badge showcase. The header shows two labelled facts under the username: the learning rank (the XP title and level) and the arena league (league icon, name and Elo), so the XP title is never mistaken for the league. Neither repeats in the learning statistics. Email, recent rooms, raw XP, advancement, current streak and unlocked-hint metrics are omitted from the profile. Dashboard behavior is unchanged. GET /api/user/me and public profiles return `elo` for this header.

The profile retains Inter and the app's blue accents in dark and light themes. A distinct identity surface prioritizes the avatar, username and bio, followed by one blue-tinted curated shelf with enlarged circular SVG medals. Profile icons use the MIT-licensed Phosphor family: duotone cybersecurity symbols for achievements and matching calendar, action and status icons. Individual imports keep the full icon catalog out of development compilation. Secondary activity and learning statistics use smaller headings, separators and flat definition-list rows. Profile-local colors provide readable text, control borders and focus indicators without changing the app-wide palette. Earned badges have solid borders and check marks; locked badges have dashed borders and padlocks. The selected badge has a thicker border and a short underline, so state does not depend on color alone. The editor and achievement catalog share these colors, with underlined catalog tabs and separated rows. On phones the bio spans the header's full width.

PATCH /api/user/me/profile saves bio (500 characters), the legacy tagline field (kept for API compatibility but omitted from the profile and editor), avatar seed, up to five predefined interests and up to three ordered earned badge IDs in one transaction. The server validates ownership and uniqueness. Existing bio updates remain compatible. The showcase displays only explicitly selected earned badges in the saved order. An empty selection hides the entire showcase section; it never selects recent badges automatically. Owners can still edit their selection through the profile editor. Interest tags express preferences rather than certified competencies.

DiceBear retains its existing version and pixel-art style. An editor offers six variants and can generate another batch while retaining the current selection. Flyway V6 stores existing usernames as initial avatar seeds; username changes no longer change avatars. Shared avatar rendering uses persisted seeds across account, friend, ranking and arena interfaces, falls back to initials when image loading fails and refreshes the owner navbar after saving. Related caches are invalidated after transaction commit.

The achievement showcase includes the full badge catalog, with a completion count, colored earned icons with check marks and muted locked icons with padlocks. Selecting an icon reveals its description. Each preview row shows up to six icons and a remaining-count action. The full collection uses earned/locked/all filters and six-item pages, picked with numbered page buttons and previous/next arrows. With more than seven pages, the first and last pages and the current page's neighbours are shown, with ellipses between them. When an arrow becomes disabled, focus moves to the current page number. Other-user profiles receive the target user's badge status, not the viewer's status.

Expanding the collection opens a native modal dialog over the profile, with a summary header, search and personal/global tabs. Personal rows show requirements, rarity and earned timestamps. The global view orders the full catalog by existing rarity percentages without implying the viewer has earned each badge. The dialog retains six-item pagination, adapts to narrow screens, traps focus natively and restores the profile when closed. Its height stays fixed whatever the number of cards, so a search that leaves one card or none does not resize it; on short screens the body scrolls below the fixed header.

Numeric badge conditions expose current and target progress for POINTS, STREAK, SOLVED_COUNT and FRIENDS_COUNT. Counts are fetched once per catalog request, not once per badge. Current progress is capped at the target; already awarded milestones stay complete even when mutable counts fall. Unawarded streak progress uses the effective current streak and resets after a missed day; awarding uses the same effective streak, so an expired streak earns no new STREAK badge. Only the expanded personal collection shows progress; global rows show rarity instead. Missing progress data produces no invented bar.

GET /api/user/me/portfolio and GET /api/user/{username}/portfolio return categories aggregated from all solved rooms and fully completed nonempty learning paths. Categories show practice evidence, not certified competency. Paths use current room membership; no completion certificates or historic completion dates are invented. No twenty-room or calendar-window limit applies to the portfolio. Responses exclude flags, hints and email.

The profile has no share-link action. Member profile routes still require authentication. Bio and optional sections retain independent loading, error recovery and cancellation on navigation. On desktop, the achievement preview places a prominent 140px selected badge and its description on the left, with earned and locked icon rows on the right. The layout stacks on phones, using a 96px preview icon.

## Inspiration

Hack The Box separates a professional summary, practice/skills and achievements in its profile: https://help.hackthebox.com/en/articles/13616849-htb-profile
TryHackMe recognizes profile achievements with badges: https://help.tryhackme.com/en/articles/6563910-points-explained
These patterns inform the portfolio and earned-badge collection; external rankings and certified skills are not reproduced.

## Consequences

Learning statistics use one unboxed two-column definition list beside the calendar on desktop and below it on smaller screens. Each label precedes its value and unit, with a shared numeric scale and a separate, smaller full date for the busiest day. The existing twelve-week calculations, latest-date tie break and active-day average remain unchanged. Loading, unavailable and empty activity states display explanations rather than invented values.

The profile editor ignores backdrop clicks. Closing with the close button, Cancel or Escape requires confirmation when any personalization field or badge order differs from its initial value. Continuing preserves the draft and focus; discarding closes without saving. Native modal dialogs trap keyboard focus and restore the editor launcher on exit. Closing is blocked while saving, failed saves retain the draft, and successful saves close the editor.

The own avatar shows a permanent pencil mark, and on hover or focus an "Edytuj awatar" label, so editing is discoverable on touch screens too. The editor opens with an avatar section: three portrait tiles switch the pose of the current look, and a link opens the full avatar studio (through the unsaved-changes confirmation when the draft differs). A changed pose is saved with PUT /api/user/me/avatar before the other fields. As with a rename, a pose that has been saved is not sent again when the profile save then fails.

Flyway V6 adds the personalization fields and ordered interests/showcase tables, preserving existing accounts. Reordering constraints are deferred until commit. The backend must be restarted to load the migration and profile editing endpoint before using the new frontend editor. Existing stats, recent-solved and bio APIs remain available. Uploaded avatars, external certificates, new achievement criteria and anonymous sharing are outside this change.

## Update (#181)

DiceBear avatars and the `avatar_seed` column were removed in migration V17. Every account is shown with its own Hackademy avatar, or with a look derived from the username until it saves one.
