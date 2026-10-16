# Arena avatar

Every player has one pixel avatar used across Hackademy and in the Arena. It is made in the creator at `/arena/avatar`, saved on the account and shown wherever an avatar appears.

## Creator

The player picks an outfit (Klasyczna, Bluza or Dres), a hairstyle (short, mohawk or ponytail), a hat (beanie or cap) and colours for skin, hair, top, bottom, shoes and hat. A hat hides the hair; the hairstyle stays selected and returns when the hat is removed. The creator shows the avatar from the front by default and previews the side animations used in the Arena: stance, attack, hit, fall and the Luz and Six-seven dances. Reduced motion shows still frames.

Signed-in players load the avatar from the account and save it there; when saving fails the creator keeps the unsaved changes and says so, and the navigation bar updates without reloading. Guests keep a browser-only copy.

## Assets

`client/public/assets/arena/avatar-v1` holds one 576x640 atlas per outfit (`fighter.png`, `hoodie/fighter.png`, `track/fighter.png`): rows for stance, jab, hook, power push, hurt and fall, then Luz in rows 6 and 7 and Six-seven in rows 8 and 9. All outfits share one bald head, so the same hair and hat overlays fit every outfit. The front view lives in `avatar-v1/front` with its own overlays and anchors. Every generated image is listed with its source in `provenance.json` and `front/provenance-hashes.json`.

Colours come from a material map per outfit in `avatarModel.ts`: listed palette colours are assigned to outline, skin, top, bottom, shoes or kept details, other colours follow the nearest listed colour, and each material gets four shade steps, so recoloured sprites keep their shading. Outlines are never recoloured.

`anchors.json` stores, for every atlas cell, where the head is. Hair and hats are recoloured and composited onto every cell at that position before the atlas is shown. Dance frames carry the exact stance head without rotation so overlays never flicker, and the Six-seven pose leaves room above the head so overlays are not cut off.

## Account storage

The avatar is stored in `user_avatars` (migration V12): outfit, hairstyle, hat, skin and the five colour choices, each limited by a database CHECK constraint and by `@Pattern` validation on `UserAvatarDto`. A missing row means the player keeps the generated DiceBear image. `GET`, `PUT` and `DELETE /api/user/me/avatar` read, save and remove it. The avatar is returned as `avatar` next to `avatarSeed` in `/api/user/me`, public profiles, user search, friends, friend requests, the ranking and the dashboard. Lists load avatars for all listed users in one query, and saving refreshes the ranking and dashboard caches of that player.

## Display

`UserAvatar` takes the optional avatar and shows a 32x32 portrait cut from the recoloured front view. Portraits are built once per distinct avatar and shared across the page. Until the portrait is ready, or when the server sends values the client does not know, it shows the DiceBear image.

## Ranked Arena

`/arena` opens with a player card: the avatar portrait, the Elo league in its colour, the Elo number, the position in the Elo ranking and progress to the next league, next to the call to action and a five-step league ladder. Leagues are computed from Elo in `client/src/components/arena/leagues.ts`: Brąz below 600, Srebro from 600, Złoto from 800, Platyna from 1000 and Diament from 1200. The right column lists friends to challenge with the duel record against each, then the rules of ranked duels.
