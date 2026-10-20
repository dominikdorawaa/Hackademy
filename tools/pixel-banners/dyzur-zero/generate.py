
"""Hand-drawn, grid-native Dyżur Zero scene. Python standard library only."""
from pathlib import Path
import argparse
import json
import struct
import zlib

W, H = 320, 120
ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'client/public/assets/pixel/banners'


P = {
    'void': '#090e18', 'board': '#0b111c', 'ground': '#0f1724',
    'wall': '#121c2c', 'surface': '#151f30', 'raised': '#1c2840',
    'line': '#26344f', 'slate': '#3a4c6d', 'steel': '#536888',
    'muted': '#9eabbf', 'ink': '#e8edf5', 'blue': '#0b63ff',
    'link': '#6ea2ff', 'teal': '#2fd0b0', 'dimteal': '#1d746e',
    'screen': '#0c262d', 'screenlight': '#10353b',
    'gold': '#e3b341', 'cream': '#f7d88a', 'warm': '#c48d44',
    'woodlight': '#9c7049', 'wood': '#76543b', 'wooddark': '#47372f',
    'shade': '#302b2c', 'glow': '#222831', 'red': '#ff8a80',
    'purple': '#c9a2ff', 'night': '#192943', 'sky': '#233956',
    'skyblue': '#355274', 'leafdark': '#204447', 'leaf': '#32756b',
    'leaflight': '#62a88d', 'ceramic': '#c0c8cf', 'paper': '#d2b98d',
    'paperdark': '#aa8c62', 'lavender': '#7f83aa', 'shadowblue': '#131e32',
}
pixels = [[P['ground']] * W for _ in range(H)]


def rect(x, y, w, h, c):
    c = P.get(c, c)
    for yy in range(max(0, y), min(H, y + h)):
        for xx in range(max(0, x), min(W, x + w)):
            pixels[yy][xx] = c


def line(x0, y0, x1, y1, c):
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    while True:
        rect(x0, y0, 1, 1, c)
        if x0 == x1 and y0 == y1:
            break
        twice = 2 * err
        if twice >= dy:
            err += dy
            x0 += sx
        if twice <= dx:
            err += dx
            y0 += sy


def poly(points, c):

    for y in range(max(0, min(p[1] for p in points)), min(H, max(p[1] for p in points) + 1)):
        intersections = []
        for a, b in zip(points, points[1:] + points[:1]):
            if min(a[1], b[1]) <= y + .5 < max(a[1], b[1]):
                intersections.append(a[0] + (y + .5 - a[1]) * (b[0] - a[0]) / (b[1] - a[1]))
        intersections.sort()
        for a, b in zip(intersections[::2], intersections[1::2]):
            for x in range(max(0, int(a + .5)), min(W, int(b + .5))):
                rect(x, y, 1, 1, c)


def path(points, c):
    for a, b in zip(points, points[1:]):
        line(*a, *b, c)


FONT = {
    ' ': ['000'] * 5,
    '~': ['000', '010', '101', '000', '000'],
    '/': ['001', '001', '010', '100', '100'],
    '$': ['010', '111', '110', '011', '010'],
    '-': ['000', '000', '111', '000', '000'],
    '.': ['000', '000', '000', '000', '010'],
    'a': ['000', '011', '101', '101', '011'],
    'b': ['100', '100', '110', '101', '110'],
    'c': ['000', '011', '100', '100', '011'],
    'k': ['100', '101', '110', '101', '101'],
    'l': ['110', '010', '010', '010', '011'],
    'n': ['000', '110', '101', '101', '101'],
    'o': ['000', '010', '101', '101', '010'],
    'p': ['000', '110', '101', '110', '100'],
    'r': ['000', '101', '110', '100', '100'],
    's': ['000', '011', '100', '001', '110'],
    't': ['010', '111', '010', '010', '011'],
    'u': ['000', '101', '101', '101', '011'],
    'x': ['000', '101', '010', '010', '101'],
}


def text(x, y, s, c):
    for ch in s:
        for yy, row in enumerate(FONT[ch]):
            for xx, cell in enumerate(row):
                if cell == '1':
                    rect(x + xx, y + yy, 1, 1, c)
        x += 4



rect(105, 0, 215, 92, 'wall')
rect(103, 0, 2, 91, 'board')
rect(106, 0, 1, 86, 'surface')
rect(0, 83, 105, 2, 'surface')
rect(106, 83, 214, 2, 'raised')
rect(0, 86, 320, 34, 'board')
rect(0, 87, 104, 1, 'ground')


rect(119, 12, 78, 57, 'board')
rect(120, 11, 77, 1, 'line')
rect(119, 12, 1, 56, 'line')
rect(123, 15, 70, 49, 'night')
rect(123, 38, 70, 26, 'sky')
rect(123, 53, 70, 11, 'skyblue')
for yy in range(35, 41):
    for xx in range(123, 193):
        if (xx + yy * 2) % 4 == 0 and ((yy < 38 and (xx + yy) % 3 == 0) or yy >= 38):
            rect(xx, yy, 1, 1, 'sky' if yy < 38 else 'night')
for yy in range(50, 55):
    for xx in range(123, 193):
        if (xx + yy * 2) % 4 == 0:
            rect(xx, yy, 1, 1, 'skyblue' if yy < 53 else 'sky')


poly([(170, 20), (177, 20), (180, 23), (180, 29), (177, 32),
      (170, 32), (167, 29), (167, 23)], 'cream')
poly([(174, 19), (180, 19), (182, 23), (182, 27), (179, 29),
      (175, 29), (172, 26), (172, 22)], 'night')
rect(168, 26, 1, 3, 'gold')
for x, y in [(133, 24), (153, 19), (186, 36), (160, 33), (129, 39)]:
    rect(x, y, 1, 1, 'muted')
rect(144, 29, 3, 1, 'lavender')
rect(145, 28, 1, 3, 'lavender')


poly([(123, 58), (127, 58), (127, 49), (136, 49), (136, 54),
      (146, 54), (146, 47), (153, 47), (153, 52), (163, 52),
      (163, 57), (170, 57), (170, 49), (180, 49), (180, 54),
      (187, 54), (187, 45), (193, 45), (193, 64), (123, 64)], 'shadowblue')
rect(149, 44, 1, 4, 'shadowblue')
for x, y, c in [(129, 54, 'warm'), (132, 59, 'steel'), (149, 51, 'paperdark'),
                 (174, 54, 'warm'), (189, 50, 'steel'), (181, 60, 'steel')]:
    rect(x, y, 1, 2, c)
rect(155, 15, 3, 49, 'board')
rect(158, 15, 1, 49, 'slate')
rect(123, 63, 70, 2, 'slate')
rect(120, 66, 78, 3, 'line')
rect(119, 69, 81, 2, 'board')
rect(122, 66, 74, 1, 'steel')
rect(124, 67, 27, 1, 'slate')


poly([(185, 48), (194, 48), (222, 84), (161, 84)], 'glow')
poly([(187, 49), (192, 49), (211, 83), (171, 83)], 'shade')

for yy in range(54, 83):
    left = 185 - (yy - 48) * 24 // 36
    right = 194 + (yy - 48) * 28 // 36
    if yy % 3 == 0:
        rect(left, yy, 1, 1, 'wall')
        rect(right - 1, yy, 1, 1, 'wall')
    if yy % 4 == 1:
        rect(left + 2, yy, 1, 1, 'wall')
        rect(right - 3, yy, 1, 1, 'wall')
for x, y in [(178, 60), (176, 64), (173, 68), (170, 73), (166, 79),
             (203, 61), (207, 67), (212, 74), (216, 80)]:
    rect(x, y, 1, 2, 'glow')


rect(290, 18, 16, 14, 'board')
rect(291, 17, 14, 1, 'line')
rect(292, 19, 12, 11, 'slate')
rect(293, 20, 10, 9, 'surface')
for x, y in [(298, 20), (298, 28), (293, 24), (302, 24)]:
    rect(x, y, 1, 1, 'muted')
path([(298, 24), (301, 24)], 'cream')
path([(298, 24), (298, 26), (299, 27)], 'cream')
rect(298, 24, 1, 1, 'gold')


rect(288, 41, 25, 45, 'board')
poly([(290, 39), (309, 39), (313, 42), (290, 42)], 'steel')
rect(290, 42, 19, 41, 'line')
rect(309, 42, 4, 41, 'raised')
rect(291, 43, 1, 38, 'slate')
for y in [46, 57, 68]:
    rect(294, y, 12, 9, 'board')
    rect(295, y + 1, 10, 1, 'slate')
    rect(296, y + 4, 5, 1, 'raised')
    rect(296, y + 6, 5, 1, 'raised')
rect(294, 80, 10, 1, 'steel')
rect(291, 84, 4, 3, 'void')
rect(307, 84, 4, 3, 'void')


path([(277, 72), (281, 72), (284, 75), (284, 91), (287, 95),
      (299, 95), (302, 98), (302, 104)], 'void')
path([(279, 73), (282, 75), (282, 89)], 'line')


poly([(119, 84), (309, 84), (320, 94), (320, 99), (111, 99), (111, 93)], 'void')
poly([(121, 84), (308, 84), (320, 94), (113, 94)], 'wood')
poly([(125, 85), (204, 85), (216, 92), (117, 92)], 'woodlight')
rect(113, 94, 207, 4, 'wooddark')
rect(114, 94, 206, 1, 'warm')
line(164, 94, 204, 94, 'gold')
rect(114, 95, 1, 2, 'woodlight')
rect(118, 98, 202, 2, 'void')
for x, y, w in [(122, 92, 15), (143, 92, 20), (177, 93, 16),
                 (271, 91, 8), (299, 92, 12)]:
    rect(x, y, w, 1, 'wooddark')
rect(120, 100, 6, 20, 'surface')
rect(120, 100, 1, 20, 'line')
rect(308, 100, 7, 20, 'surface')
rect(308, 100, 1, 20, 'line')
rect(127, 101, 180, 3, 'board')


rect(123, 77, 21, 12, 'void')
rect(124, 76, 18, 11, 'paperdark')
rect(125, 73, 6, 4, 'paper')
rect(125, 77, 17, 9, 'warm')
rect(125, 77, 17, 1, 'cream')
rect(129, 80, 9, 4, 'paper')
rect(131, 81, 5, 1, 'wooddark')
poly([(116, 87), (130, 87), (133, 90), (119, 90)], 'paperdark')
poly([(117, 85), (130, 85), (133, 88), (120, 88)], 'paper')
line(121, 86, 127, 86, 'paperdark')
rect(123, 87, 8, 1, 'cream')



rect(151, 88, 19, 3, 'wooddark')
poly([(155, 65), (163, 65), (166, 68), (166, 76), (169, 82),
      (168, 87), (165, 89), (153, 89), (150, 86), (151, 80),
      (152, 75), (152, 69)], 'void')
poly([(156, 66), (162, 66), (165, 69), (165, 77), (167, 82),
      (166, 86), (164, 88), (154, 88), (152, 85), (153, 78),
      (153, 70)], 'raised')
path([(154, 70), (154, 68), (156, 67), (160, 67)], 'slate')
poly([(155, 71), (158, 70), (160, 72), (162, 70), (164, 71),
      (164, 77), (162, 80), (162, 82), (155, 82), (154, 77)], 'ink')
poly([(155, 79), (163, 79), (165, 84), (164, 87), (155, 87), (153, 85)], 'ceramic')
rect(157, 73, 1, 2, 'void')
rect(162, 73, 1, 2, 'void')
poly([(158, 76), (163, 76), (161, 78), (159, 78)], 'gold')
rect(154, 79, 11, 2, 'dimteal')
rect(155, 79, 8, 1, 'teal')
rect(162, 80, 2, 4, 'dimteal')
rect(162, 83, 2, 1, 'teal')
poly([(154, 87), (158, 87), (159, 90), (152, 90)], 'warm')
poly([(162, 87), (165, 87), (168, 90), (161, 90)], 'gold')
line(151, 81, 151, 84, 'slate')


rect(184, 84, 17, 3, 'wooddark')
poly([(186, 81), (196, 81), (199, 84), (183, 84)], 'warm')
rect(187, 81, 8, 1, 'gold')
rect(190, 62, 2, 19, 'wooddark')
line(191, 62, 200, 51, 'gold')
line(192, 63, 201, 52, 'warm')
rect(198, 48, 4, 4, 'wooddark')
rect(199, 48, 2, 2, 'gold')
line(199, 49, 191, 42, 'warm')
line(199, 48, 191, 41, 'gold')
poly([(183, 39), (190, 39), (195, 46), (177, 46)], 'warm')
poly([(184, 39), (189, 39), (192, 44), (180, 44)], 'gold')
rect(177, 46, 18, 2, 'wooddark')
rect(179, 47, 14, 1, 'cream')
rect(184, 48, 5, 1, 'gold')


rect(211, 79, 65, 4, 'wooddark')
poly([(210, 35), (213, 32), (273, 32), (280, 39), (280, 77),
      (276, 81), (212, 81), (208, 77), (208, 39)], 'void')
poly([(212, 34), (272, 34), (277, 39), (277, 76), (274, 79),
      (212, 79), (210, 76), (210, 38)], 'slate')
poly([(273, 35), (279, 40), (279, 76), (275, 79), (275, 39)], 'line')
rect(214, 34, 56, 1, 'muted')
rect(211, 38, 1, 35, 'steel')
rect(215, 38, 56, 35, 'board')
rect(216, 39, 54, 33, 'screen')
rect(217, 39, 52, 1, 'dimteal')
rect(216, 40, 1, 30, 'screenlight')
rect(218, 71, 50, 1, 'screenlight')
rect(216, 39, 1, 1, 'board')
rect(269, 39, 1, 1, 'board')
rect(216, 71, 1, 1, 'board')
rect(269, 71, 1, 1, 'board')
rect(214, 72, 58, 1, 'steel')
rect(215, 73, 55, 1, 'line')
text(219, 42, '~/$ ls -la', 'teal')
text(219, 48, '.notatka', 'muted')
text(219, 54, 'raport.txt', 'muted')
text(219, 60, 'backup/', 'link')
text(219, 66, '~/$', 'teal')
rect(239, 79, 11, 7, 'line')
rect(240, 80, 8, 4, 'slate')
poly([(235, 85), (254, 85), (260, 88), (230, 88)], 'slate')
rect(232, 88, 27, 1, 'board')
line(236, 85, 253, 85, 'steel')
for x in [216, 219, 222, 225]:
    rect(x, 76, 2, 1, 'line')
rect(266, 75, 5, 3, 'line')
line(212, 75, 214, 77, 'steel')
rect(274, 40, 1, 29, 'steel')


path([(223, 84), (221, 82), (219, 82), (219, 84), (217, 84)], 'board')
poly([(214, 86), (257, 86), (267, 93), (207, 93)], 'board')
poly([(215, 86), (256, 86), (263, 91), (210, 91)], 'slate')
line(214, 87, 256, 87, 'muted')
for y, start, count in [(88, 215, 14), (90, 213, 15)]:
    for i in range(count):
        rect(start + i * 3, y, 2, 1, 'raised')
rect(227, 90, 17, 1, 'ceramic')
rect(211, 92, 54, 1, 'line')


rect(174, 89, 15, 2, 'wooddark')
rect(174, 88, 13, 1, 'paperdark')
rect(184, 79, 5, 7, 'ceramic')
rect(186, 80, 2, 4, 'wooddark')
poly([(175, 78), (185, 78), (185, 86), (183, 88), (177, 88), (175, 86)], 'ceramic')
rect(176, 79, 2, 7, 'ink')
rect(178, 87, 5, 1, 'muted')
rect(179, 81, 5, 1, 'muted')
rect(180, 82, 4, 1, 'muted')
rect(176, 77, 8, 2, 'paper')
rect(177, 78, 6, 1, 'wooddark')
path([(178, 74), (177, 72), (177, 70), (179, 68)], 'paperdark')
path([(182, 74), (183, 72), (182, 70)], 'muted')


path([(275, 85), (278, 82), (278, 80)], 'board')
poly([(274, 86), (278, 86), (281, 89), (281, 91), (273, 91), (272, 89)], 'muted')
line(275, 87, 276, 89, 'steel')
rect(292, 88, 10, 4, 'board')
rect(292, 88, 8, 1, 'steel')
rect(302, 89, 3, 2, 'muted')
rect(295, 90, 1, 1, 'teal')


CURSOR = {'x': 232, 'y': 66, 'w': 3, 'h': 5}
LEDS = [
    {'x': 303, 'y': 50, 'w': 2, 'h': 2, 'color': P['teal']},
    {'x': 303, 'y': 61, 'w': 2, 'h': 2, 'color': P['gold']},
    {'x': 303, 'y': 72, 'w': 2, 'h': 2, 'color': P['red']},
    {'x': 268, 'y': 76, 'w': 2, 'h': 1, 'color': P['teal']},
]
rect(**CURSOR, c='teal')
for led in LEDS:
    rect(led['x'], led['y'], led['w'], led['h'], led['color'])


def write_png(path, scale=1, mask=None, patch=None):
    if mask is not None:
        patch = {(x, y): mask['off'] for y in range(mask['y'], mask['y'] + mask['h'])
                 for x in range(mask['x'], mask['x'] + mask['w'])}
    def chunk(kind, data):
        return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data))
    raw = bytearray()
    for y, row in enumerate(pixels):
        if patch is None:
            scanline = b'\0' + b''.join(bytes.fromhex(c[1:]) * scale for c in row)
        else:
            scanline = b'\0' + b''.join(
                (bytes.fromhex(patch[x, y][1:]) + b'\xff'
                 if (x, y) in patch else b'\0\0\0\0') * scale
                for x in range(W))
        raw.extend(scanline * scale)
    path.write_bytes(b'\x89PNG\r\n\x1a\n'
                     + chunk(b'IHDR', struct.pack('!IIBBBBB', W * scale, H * scale, 8, 2 if patch is None else 6, 0, 0, 0))
                     + chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b''))


OUT.mkdir(parents=True, exist_ok=True)
write_png(OUT / 'dyzur-zero.png')
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--preview', type=Path, help='Write a 4x preview outside the repository.')
args = parser.parse_args()
if args.preview:
    write_png(args.preview, 4)
write_png(OUT / 'dyzur-zero-cursor-off.png', mask=dict(CURSOR, off=P['screen']))
for index, led in enumerate(LEDS):
    write_png(OUT / f'dyzur-zero-led-{index + 1}-off.png',
              mask=dict(led, off=P['board'] if index < 3 else P['line']))
eyes_closed = {(x, 73): P['ink'] for x in (157, 162)}
eyes_closed.update({(x, 74): P['void'] for x in (156, 157, 162, 163)})
write_png(OUT / 'dyzur-zero-penguin-blink.png', patch=eyes_closed)
used = {c for row in pixels for c in row}
palette = [c for c in P.values() if c in used]
assert used <= set(P.values())
assert 24 <= len(palette) <= 40
(OUT / 'dyzur-zero.json').write_text(json.dumps({
    'width': W, 'height': H, 'palette': palette, 'cursor': CURSOR, 'leds': LEDS,
}, indent=2) + '\n')
print(f'Wrote native RGB PNG, animation layers and manifest; {len(palette)} colours.')
