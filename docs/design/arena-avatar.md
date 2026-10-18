# Arena avatar

Every player has one pixel avatar used across Hackademy and in the Arena. It is made in the creator at `/arena/avatar`, saved on the account and shown wherever an avatar appears.

## Creator

The player picks an outfit (Klasyczna, Bluza or Dres), a hairstyle (short, mohawk or ponytail), a hat (beanie or cap) and colours for skin, hair, top, bottom, shoes and hat. A hat hides the hair; the hairstyle stays selected and returns when the hat is removed. The creator shows the avatar from the front by default and previews the side animations used in the Arena: stance, the palm strike attack, hit, fall, the running loop, the Luz and Six-seven dances and both finishers. Reduced motion shows still frames. The portrait pose is chosen separately: Przód (front), Postawa (the side fighting stance) or Profil (a calm side profile). Previewing an animation never changes the portrait.

Signed-in players load the avatar from the account and save it there; when saving fails the creator keeps the unsaved changes and says so, and the navigation bar updates without reloading. Guests keep a browser-only copy.

## Assets

`client/public/assets/arena/avatar-v1` holds one 576x832 atlas per outfit (`fighter.png`, `hoodie/fighter.png`, `track/fighter.png`): rows for stance, the palm strike, the Przeciążenie finisher in rows 2 and 3, hurt and fall, then Luz in rows 6 and 7, Six-seven in rows 8 and 9, an eight-frame running loop in row 10 and the Ctrl+Alt+Del finisher in rows 11 and 12. All outfits share one bald head, so the same hair and hat overlays fit every outfit. The front view lives in `avatar-v1/front` with its own overlays and anchors. The calm side profile lives in `avatar-v1/profile`, one image and one head anchor per outfit, and reuses the side hair and hat overlays. Every generated image is listed with its source in `provenance.json` and `front/provenance-hashes.json`.

Colours come from a material map per outfit in `avatarModel.ts`: listed palette colours are assigned to outline, skin, top, bottom, shoes or kept details, other colours follow the nearest listed colour, and each material gets four shade steps, so recoloured sprites keep their shading. Outlines are never recoloured.

`anchors.json` stores, for every atlas cell, where the head is. Hair and hats are recoloured and composited onto every cell at that position before the atlas is shown. Dance frames carry the exact stance head without rotation so overlays never flicker. Six-seven is a 16-frame front view loop generated from a skeleton: palms up, the hands move up and down in opposite directions twice. Every frame carries the exact front head in the front view placement, so front overlays have room above the head and are never cut off.

`RunningAvatar` plays the running loop for any saved avatar, starting from the plain atlas while the recoloured one is being built, so it can be used where a page is loading. Reduced motion shows a still runner.

## Account storage

The avatar is stored in `user_avatars` (migration V12, pose added in V14): outfit, hairstyle, hat, skin, the five colour choices and the portrait pose, each limited by a database CHECK constraint and by `@Pattern` validation on `UserAvatarDto`. A missing row means the player keeps the generated DiceBear image. `GET`, `PUT` and `DELETE /api/user/me/avatar` read, save and remove it. The avatar is returned as `avatar` next to `avatarSeed` in `/api/user/me`, public profiles, user search, friends, friend requests, the ranking and the dashboard. Lists load avatars for all listed users in one query, and saving refreshes the ranking and dashboard caches of that player.

## Display

`UserAvatar` takes the optional avatar and shows a 32x32 portrait in the saved pose, cut from the recoloured front view, the stance cell of the outfit atlas or the side profile. A missing or unknown pose falls back to the front view, so new poses can be added later. Portraits are built once per distinct avatar and shared across the page. Until the portrait is ready, or when the server sends values the client does not know, it shows the DiceBear image.

## Ranked Arena

`/arena` opens with a player card: the avatar portrait, the Elo league in its colour, the Elo number, the position in the Elo ranking and progress to the next league, next to the call to action and a five-step league ladder. Leagues are computed from Elo in `client/src/components/arena/leagues.ts`: Brąz below 600, Srebro from 600, Złoto from 800, Platyna from 1000 and Diament from 1200. The right column lists friends to challenge with the duel record against each, then the rules of ranked duels.

## Avatar battles

Ranked matches are knowledge battles between the two players' avatars; the Arena no longer uses CTF rooms. Each player starts with 100 HP. A battle has up to 10 rounds: both players get the same question from `arena_questions` (migration V13, 42 Polish questions in five categories) and pick one of four answers within 15 seconds. A correct answer hits the rival for 20 HP regardless of speed, so two correct answers hurt both players. The battle ends on a knockout or after the last round, where more HP wins and equal HP is a draw that keeps Elo. Surrendering, or staying disconnected from the realtime connection for 30 seconds, is a loss.

The server runs the battle (`BattleEngine`, `ArenaServiceImpl`): it draws questions without repeats, accepts one answer per player and round through `POST /api/arena/game/{id}/answer`, resolves the round when both answered or time runs out, shows the result for 3 seconds and opens the next round. The correct answer and the players' choices stay on the server until the round ends. Clients receive the round, deadlines with the server time, HP, who already answered and the last round result through the realtime `STATE` message.

`/arena/battle/:id` is one arena on a pixel server room background (`stages/server-room-arena.png`): the player plates, the round and countdown, both avatars facing each other on the floor, then the question with four answers on translucent panels, and after the answers the correct answer, both choices and who hit. During the reveal a fighter who answered correctly throws a palm strike that sends a cyan data packet (`effects/data-packet.png`) bursting on the rival (`effects/data-burst.png`), and the rival flinches; at the end the winner dances and the loser falls. When the last hit knocks the rival out, the winner performs one of two finishers instead of the palm strike, picked from the game id so both players see the same one: Przeciążenie charges an orb at the hip and fires a beam from both palms (`effects/finisher-orb.png`, `effects/finisher-beam.png`), and Ctrl+Alt+Del lands two quick punches and a heavy third one. The arena dims, a banner names the move, a large burst (`effects/finisher-blast.png`) hits the rival, the rival glitches or is knocked back, then falls. If the loser also hit in that round, their palm strike lands first and the finisher follows. Reduced motion shows still frames. The result card shows the outcome, its reason and the Elo change.
