# Arena animation prototype

The route `/arena/prototype` is a standalone demonstration within the Hackademy application shell. A single SVG stage holds two full-body pixel fighters. Blue identifies the left player, amber the right player, with names and separate accessible HP meters so color is never the only identifier.

Bodies, equipment and effects are original geometric SVG paths. DiceBear 7.x Pixel Art images provide faces and hairstyles through an external SVG image clipped to the top twelve rows of its sixteen-row viewbox. Six fixed seeds are selectable for each fictional player. The original avatar component and account appearance remain unchanged. No generated raster ships with the feature.

Dark mode uses a navy stage and pale text. Light mode uses an off-white stage with dark text. Existing application typography and buttons remain in use. One bordered stage is followed by an announced result, controls and avatar selectors. On small screens the SVG grows to crop unused outer margins; HTML controls wrap below the scene.

The focal sequence is preparation, projectile travel and impact. Two correct answers produce a central collision without HP loss. Hits change HP at impact, and defeat combines a bent leg, lowered body and raised winning arm. Existing app and system reduced-motion settings replace movement with a status message and HP update. Animations and timers are cancelled on removal. Repeated result IDs are ignored.

## Finish review

Six avatar compositions were rendered offline and inspected. Heads align with the common bodies and preserve distinct faces and hair. Automated tests verify event deduplication in Strict Mode, motion preferences, both attack directions, collision, defeat, HP, controls, reset and cleanup. Build and lint pass.

Live browser inspection of motion smoothness, mobile and tablet layout, and both rendered themes remains unverified because the computer-use environment exposes no browser. This limitation must remain in the PR and handoff; automated animation tests and static SVG rendering do not replace that inspection.
