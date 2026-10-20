# Dyżur Zero pixel banner

An original, hand-authored night-shift desk scene. The left third is a quiet navy
wall for title placement; the centre-right holds a moonlit city window, warm
articulated lamp, CRT terminal, archive folder and reports, steaming coffee,
keyboard, mouse, backup drive, server and a small original penguin in a teal scarf.
The clock reads 05:15. Terminal glyphs spell `~/$ ls -la`, `.notatka`,
`raport.txt`, `backup/` and a new prompt. There is no lettering outside the screen.

## Regenerate

From the repository root:

```sh
python3 tools/pixel-banners/dyzur-zero/generate.py
```

Python standard library only. The source draws integer pixel primitives and its
own 3 × 5 glyphs, then writes lossless RGB PNGs and RGBA animation masks directly
with zlib. No source image,
external font, dependency, randomness, antialiasing or resampling is used.
The banner remains fully opaque; only animation masks use transparency.
A 4x preview is optional and is not kept in the repository:

```sh
python3 tools/pixel-banners/dyzur-zero/generate.py --preview /tmp/dyzur-zero-preview.png
```

The preview repeats each native pixel in a 4 × 4 block.

## Palette and composition

33 used colours; the complete ordered hex palette is in the JSON manifest.
Site navy, surface, slate and teal anchor the scene. Derived warm wood and brass
tones surround the lamp; a cream crescent and muted blue skyline keep the window
calm. Gold, blue, purple and red accents are sparse. Dithering is hand-positioned
and ordered, confined to the sky and lamp-light edges.

The native artwork is 320 × 120. Keep `image-rendering: pixelated` when scaling.
The title-safe dark region is approximately x=0–110 (35%).
Main objects stay within y=11–99, so cropping roughly 8% from the top and
bottom preserves the scene. For modest horizontal crops, use `object-position:
right center`; the terminal/lamp/penguin core occupies x=150–280, while the server
at x=288–313 can be treated as expendable for deeper crops. Avoid cropping the
320-wide image to a dramatically different aspect ratio.

## Animation integration

All rectangles in `dyzur-zero.json` use native pixels and are drawn **on** in the
PNG. The terminal cursor is x=232, y=66, w=3, h=5. The four LED rectangles describe
three server lights and the monitor power light. Coordinates refer to the same
320 × 120 canvas for the banner and all animation layers.

The generator also writes five transparent 320 × 120 PNG masks:
`dyzur-zero-cursor-off.png` and `dyzur-zero-led-1-off.png` through
`dyzur-zero-led-4-off.png`. Each contains only its rectangle in the off colour:
`#0c262d` for the cursor, `#0b111c` for server LEDs, `#26344f` for monitor power.
The component stacks these full-canvas images directly over the banner and
switches their visibility in discrete steps. The sixth transparent layer,
`dyzur-zero-penguin-blink.png`, replaces the penguin's eyes with closed eyelids.
All images share the same dimensions,
position and `image-rendering: pixelated`, so native pixel edges stay identical
at fractional scales and cropped aspect ratios. Do not replace these masks with
small CSS rectangles: CSS edges round differently from scaled raster pixels and
can leave bright slivers visible when a light should be off. Visibility switches
also avoid opacity compositing, which can resample separate layers differently
at fractional scales even when their CSS bounds match.

The cursor blinks on a 2.8-second cycle. The LEDs use a slower 7.5-second cycle
with staggered starting phases. The penguin closes its eyes for 160 ms every
8 seconds. The stars remain static. No easing or subpixel interpolation is applied
to pixel art.
Reduced-motion preferences leave the static
on-state image visible, with mask animations disabled.
