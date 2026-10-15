# Animated Arena prototype

## Direction contract

THESIS: Two recognizable player avatars become pixel fighters. A single shared stage makes each answer outcome visible through a physical action.

OWN-WORLD: Existing Hackademy dark and light surfaces, blue and amber energy, hard pixel silhouettes and readable HTML health bars. Faces retain DiceBear 7.x pixel-art seeds. Bodies and effects are original SVG geometry.

STORY: Choose an attacker and preview a hit, two projectiles cancelling, or defeat. Select six avatar variants to check the head-to-body connection. Reset starts a new demonstration.

FIRST VIEWPORT: Page title and a short rule, two health bars above a wide stage, full-body fighters facing inward, a central projectile collision and controls immediately below. On phones the stage crops empty outer margins while preserving both fighters.

FORM: Code-led interactive animation study, extending the existing application identity. No generated raster assets or game engine.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Behavior

The prototype route is public and uses only fictional local player data. It changes no ranking or game state. The existing Arena remains available. A result has a unique ID, kind and attacker. The scene applies each result once and cancels animations and scheduled callbacks on unmount. Current HP can be restored without a result to avoid replaying attacks.

The impact occurs at 650 ms and controls unlock at 900 ms. Defeat starts with the target at 20 HP, then reaches zero on impact. Two correct answers cause a collision with no damage. Reduced motion uses text and immediate health updates without projectiles, breathing, recoil or flashes. Both the application preference and operating-system preference are respected.

## Asset provenance

Bodies, gloves, boots, stage and energy effects are authored SVG shapes. Avatar images use the existing DiceBear 7.x Pixel Art API, licensed CC0. No third-party SVG is injected into the DOM. The nested image viewport crops the upper twelve rows of the 16-row avatar to retain the face and hair while excluding its original torso. Failed images use an original neutral pixel face.
