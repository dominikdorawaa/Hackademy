# Pixel accents

Small looping pixel animations generated in PixelLab add life to empty or static spots without changing layouts. Every sheet lives in `client/public/assets/pixel`, with its prompts, seeds and checksums in `provenance.json`, and the sources in `local-prototype-backups/pixel-accents-v1`.

`PixelSprite` (`client/src/components/PixelSprite.tsx`) plays a horizontal sprite sheet with a stepped CSS animation at a whole-number scale. It is hidden from screen readers and stops on the first frame when the system or the app asks for reduced motion.

- Navigation streak counter: a flickering flame (`streak-flame.png`). With no streak the flame is grey and still.
- Dashboard, recent flags: a waving capture flag on a server box (`capture-flag.png`) next to the empty state text.
- Room solved: the same flag drops into the success dialog.
- Unknown address: a 404 page where a small circuit bug (`lost-bug.png`) walks along a dashed line, with links back to the start and to the paths.
- Landing page: the three "Jak To Działa?" steps use an opening server door, snapping puzzle pieces and a twinkling trophy (`step-room.png`, `step-puzzle.png`, `step-trophy.png`), and the ranked duel card shows two Arena avatars trading a blow, rendered from the avatar atlas.
