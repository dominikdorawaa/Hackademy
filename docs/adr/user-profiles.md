# User profiles as a personal showcase

Status: accepted

## Context

The profile repeated recent rooms, XP, level progression and Elo already available on the dashboard. The profile should help members present their practice and achievements to other members.

## Decision

Own and other-user profiles share a Steam-inspired identity header, bio and optional interests, a curated earned-badge showcase, a full achievement collection and a twelve-week activity calendar. A learning-statistics section replaces the experience portfolio, showing the best daily result, longest active streak, full date of the most active day, and mean solutions per active day, all within the same last twelve weeks as the calendar. These are personal activity patterns, not dashboard scores. No portfolio request is made by the profile; the existing portfolio API remains available. The owner sees one setup prompt when identity fields are empty. Email, recent rooms, XP, level, advancement, current streak, Elo and unlocked-hint metrics are omitted from the profile. Dashboard behavior is unchanged.

The profile retains Inter and the app's blue accents in dark and light themes. A distinct identity surface prioritizes the avatar, username and bio, followed by one blue-tinted curated shelf with enlarged circular SVG medals. Profile icons use the MIT-licensed Phosphor family: duotone cybersecurity symbols for achievements and matching calendar, action and status icons. Individual imports keep the full icon catalog out of development compilation. Secondary activity and learning statistics use smaller headings, separators and flat definition-list rows. Profile-local colors provide readable text, control borders and focus indicators without changing the app-wide palette. Earned badges have solid borders and check marks; locked badges have dashed borders and padlocks. The selected badge has a thicker border and a short underline, so state does not depend on color alone. The editor and achievement catalog share these colors, with underlined catalog tabs and separated rows. On phones the bio spans the header's full width.

PATCH /api/user/me/profile saves bio (500 characters), the legacy tagline field (kept for API compatibility but omitted from the profile and editor), avatar seed, up to five predefined interests and up to three ordered earned badge IDs in one transaction. The server validates ownership and uniqueness. Existing bio updates remain compatible. Without curated badges, the showcase uses the three latest earned badges. Interest tags express preferences rather than certified competencies.

DiceBear retains its existing version and pixel-art style. An editor offers six variants and can generate another batch while retaining the current selection. Flyway V6 stores existing usernames as initial avatar seeds; username changes no longer change avatars. Shared avatar rendering uses persisted seeds across account, friend, ranking and arena interfaces, falls back to initials when image loading fails and refreshes the owner navbar after saving. Related caches are invalidated after transaction commit.

The achievement showcase includes the full badge catalog, with a completion count, colored earned icons with check marks and muted locked icons with padlocks. Selecting an icon reveals its description. Each preview row shows up to six icons and a remaining-count action. The full collection uses earned/locked/all filters and six-item pages without internal scrolling. Other-user profiles receive the target user's badge status, not the viewer's status.

Expanding the collection opens a native modal dialog over the profile, with a summary header, search and personal/global tabs. Personal rows show requirements, rarity and earned timestamps. The global view orders the full catalog by existing rarity percentages without implying the viewer has earned each badge. The dialog retains six-item pagination, adapts to narrow screens, traps focus natively and restores the profile when closed. On short screens its contents can scroll without visible scrollbar tracks.

Numeric badge conditions expose current and target progress for POINTS, STREAK, SOLVED_COUNT and FRIENDS_COUNT. Counts are fetched once per catalog request, not once per badge. Current progress is capped at the target; already awarded milestones stay complete even when mutable counts fall. Unawarded streak progress uses the effective current streak and resets after a missed day. Only the expanded personal collection shows progress; global rows show rarity instead. Missing progress data produces no invented bar.

GET /api/user/me/portfolio and GET /api/user/{username}/portfolio return categories aggregated from all solved rooms and fully completed nonempty learning paths. Categories show practice evidence, not certified competency. Paths use current room membership; no completion certificates or historic completion dates are invented. No twenty-room or calendar-window limit applies to the portfolio. Responses exclude flags, hints and email.

The profile has no share-link action. Member profile routes still require authentication. Bio and optional sections retain independent loading, error recovery and cancellation on navigation. On desktop, the achievement preview places a prominent 140px selected badge and its description on the left, with earned and locked icon rows on the right. The layout stacks on phones, using a 96px preview icon.

## Inspiration

Hack The Box separates a professional summary, practice/skills and achievements in its profile: https://help.hackthebox.com/en/articles/13616849-htb-profile
TryHackMe recognizes profile achievements with badges: https://help.tryhackme.com/en/articles/6563910-points-explained
These patterns inform the portfolio and earned-badge collection; external rankings and certified skills are not reproduced.

## Consequences

Flyway V6 adds the personalization fields and ordered interests/showcase tables, preserving existing accounts. Reordering constraints are deferred until commit. The backend must be restarted to load the migration and profile editing endpoint before using the new frontend editor. Existing stats, recent-solved and bio APIs remain available. Uploaded avatars, external certificates, new achievement criteria and anonymous sharing are outside this change.
