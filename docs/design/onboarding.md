# Onboarding

New accounts are welcomed by Bit, the Hackademy penguin, before they reach the app.

## Mascot

Bit was generated with PixelLab (`client/public/assets/mascot`, sources and seeds in `provenance.json`): an idle, a talking and a waving loop of eight frames each. `Mascot` plays one of them through `PixelSprite`, and `MascotBubble` places Bit next to a speech bubble with a title, text and actions. Reduced motion, from the system or the app setting, shows still frames.

## Account state

`users.avatar_confirmed_at` and `users.tour_status` (`PENDING`, `COMPLETED`, `SKIPPED`), added in migration V17, keep the progress on the account, so a refresh, a new login or another device resume in the same place. Existing accounts were marked as finished; only new registrations go through onboarding.

- `GET /api/user/me/onboarding` returns `{ avatarConfirmed, tourStatus }`, also included as `onboarding` in `/api/user/me`.
- `POST /api/user/me/onboarding/avatar` validates and saves the avatar like `PUT /api/user/me/avatar` and marks the step in the same transaction. An invalid avatar or a failed save leaves the step unfinished.
- `POST /api/user/me/onboarding/tour` with `COMPLETED` or `SKIPPED` finishes the tour once; it needs a confirmed avatar (409 otherwise).

## Flow

Registration leads to `/witaj`. `ProtectedRoute` sends every protected address there until the avatar is confirmed, and shows a retry when the state cannot be read. The page starts with Bit's greeting, then opens the avatar studio: a large preview (front, fight and profile icon), options in four tabs (outfit, hair and hat, colours, icon pose) and Bit's tips with the `Zatwierdzam mój awatar` button. A look derived from the username is preselected, but the step is only finished after the player confirms it and the server saves it; a failed save keeps the choices and offers a retry.

After the confirmation `GuidedTour` walks through Dashboard, Ucz się, Tryb rankingowy, Ranking and Twój profil. Each step opens its page and highlights the element marked with `data-tour`; the bubble goes below, above or beside it, and docks at the bottom on phones with the element scrolled above it. Back, Next and `Pomiń przewodnik` are available, focus stays in the bubble and Escape moves focus to the skip button. The current step survives a refresh in `sessionStorage`; finishing or skipping is saved on the account and the tour does not start again. Skipping never skips the avatar.
