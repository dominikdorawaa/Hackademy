import { useEffect, useState } from 'react';
import { AVATAR_ATLASES } from './fighters';
import { buildColorMap, CLOTH_RAMPS, compositeOverlay, rampFor, FRONT_VIEWS, HAIR_RAMPS, HEAD_ANCHORS, HEAD_OVERLAYS, OUTFIT_SPECS, PORTRAIT_CROPS, PROFILE_VIEWS, recolorAtlas, recolorOverlay } from './avatarModel';
import type { Avatar, ColorMap, HeadAnchors, HeadView } from './avatarModel';
import { fromAvatarConfig } from './avatarModel';
import type { AvatarConfig } from '../../../types/api';
import { createPortraitCache } from './portraitCache';

interface Source { pixels: Uint8ClampedArray; width: number; height: number; map: ColorMap }
const sources = new Map<Avatar['outfit'], Promise<Source>>();
const HEAD_BASE = '/assets/arena/avatar-v1/';
const overlays = new Map<string, Promise<Uint8ClampedArray>>();
const anchorRequests = new Map<string, Promise<HeadAnchors>>();

async function readPixels(src: string) {
  const image = new Image();
  image.src = src;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.width; canvas.height = image.height;
  const context = canvas.getContext('2d')!;
  context.drawImage(image, 0, 0);
  return { pixels: context.getImageData(0, 0, image.width, image.height).data, width: image.width, height: image.height };
}
function loadOverlay(file: string) {
  if (!overlays.has(file)) overlays.set(file, readPixels(HEAD_BASE + file).then(result => result.pixels).catch(error => { overlays.delete(file); throw error; }));
  return overlays.get(file)!;
}
function loadAnchors(file: string) {
  if (!anchorRequests.has(file)) anchorRequests.set(file, fetch(HEAD_BASE + file).then(response => response.json() as Promise<HeadAnchors>).catch(error => { anchorRequests.delete(file); throw error; }));
  return anchorRequests.get(file)!;
}

function loadSource(outfit: Avatar['outfit']) {
  if (!sources.has(outfit)) sources.set(outfit, (async () => {
    const { pixels, width, height } = await readPixels(AVATAR_ATLASES[outfit].atlas);
    return { pixels, width, height, map: buildColorMap(pixels, OUTFIT_SPECS[outfit]) };
  })().catch(error => { sources.delete(outfit); throw error; }));
  return sources.get(outfit)!;
}

const views = new Map<string, Promise<Source>>();
function loadView(outfit: Avatar['outfit'], image: string) {
  if (!views.has(image)) views.set(image, readPixels(HEAD_BASE + image).then(result => ({ ...result, map: buildColorMap(result.pixels, OUTFIT_SPECS[outfit]) })).catch(error => { views.delete(image); throw error; }));
  return views.get(image)!;
}
const loadFront = (outfit: Avatar['outfit']) => loadView(outfit, FRONT_VIEWS[outfit].image);

async function portraitPixels(avatar: Avatar) {
  const spec = OUTFIT_SPECS[avatar.outfit];
  if (avatar.pose === 'postawa') {
    const source = await loadSource(avatar.outfit), cell = new Uint8ClampedArray(64 * 64 * 4);
    for (let y = 0; y < 64; y++) cell.set(source.pixels.subarray(y * source.width * 4, y * source.width * 4 + 256), y * 256);
    const pixels = recolorAtlas(cell, 64, source.map, spec, avatar.colors);
    await dressHead(pixels, 64, avatar, HEAD_ANCHORS[avatar.outfit], '');
    return pixels;
  }
  const view = avatar.pose === 'profil' ? PROFILE_VIEWS[avatar.outfit] : FRONT_VIEWS[avatar.outfit];
  const source = await loadView(avatar.outfit, view.image);
  const pixels = recolorAtlas(source.pixels, source.width, source.map, spec, avatar.colors);
  await dressHead(pixels, source.width, avatar, view.anchors, avatar.pose === 'profil' ? '' : 'front/');
  return pixels;
}

async function dressHead(pixels: Uint8ClampedArray, width: number, avatar: Avatar, anchorFile: string, prefix: string) {
  const anchors = await loadAnchors(anchorFile);
  const views: [HeadView, string][] = [['side', prefix]];
  for (const view of ['front', 'dance'] as const) if (Object.values(anchors.cells).some(anchor => anchor?.view === view)) views.push([view, view + '/']);
  for (const [view, folder] of views) {
    if (avatar.hair !== 'brak' && avatar.hat === 'brak') compositeOverlay(pixels, width, recolorOverlay(await loadOverlay(folder + HEAD_OVERLAYS[avatar.hair]), rampFor(HAIR_RAMPS, avatar.colors.hair)), anchors, view);
    if (avatar.hat !== 'brak') compositeOverlay(pixels, width, recolorOverlay(await loadOverlay(folder + HEAD_OVERLAYS[avatar.hat]), rampFor(CLOTH_RAMPS, avatar.colors.hat)), anchors, view);
  }
  return pixels;
}

function toCanvas(pixels: Uint8ClampedArray<ArrayBuffer>, width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  canvas.getContext('2d')!.putImageData(new ImageData(pixels, width, height), 0, 0);
  return canvas;
}

async function frontUrl(avatar: Avatar) {
  try {
    const front = await loadFront(avatar.outfit);
    const pixels = recolorAtlas(front.pixels, front.width, front.map, OUTFIT_SPECS[avatar.outfit], avatar.colors);
    await dressHead(pixels, front.width, avatar, FRONT_VIEWS[avatar.outfit].anchors, 'front/');
    return await toUrl(toCanvas(pixels, front.width, front.height));
  } catch { return null; }
}

function toUrl(canvas: HTMLCanvasElement) {
  return new Promise<string>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(URL.createObjectURL(blob)) : reject(new Error('Empty image')), 'image/png'));
}

export interface AvatarAtlas { atlas: string; front: string | null }

export function useAvatarAtlas(avatar: Avatar) {
  const [result, setResult] = useState<{ key: string; value: AvatarAtlas } | null>(null);
  const key = JSON.stringify(avatar);
  useEffect(() => {
    let cancelled = false, created: string[] = [];
    const current: Avatar = JSON.parse(key);
    (async () => {
      const source = await loadSource(current.outfit);
      const pixels = recolorAtlas(source.pixels, source.width, source.map, OUTFIT_SPECS[current.outfit], current.colors);
      await dressHead(pixels, source.width, current, HEAD_ANCHORS[current.outfit], '');
      const canvas = toCanvas(pixels, source.width, source.height);
      const front = await frontUrl(current);
      created = [await toUrl(canvas), ...(front ? [front] : [])];
      if (cancelled) { created.forEach(url => URL.revokeObjectURL(url)); return; }
      setResult({ key, value: { atlas: created[0], front } });
    })().catch(() => undefined);
    return () => { cancelled = true; created.forEach(url => URL.revokeObjectURL(url)); };
  }, [key]);
  return result?.key === key ? result.value : null;
}

const portraits = createPortraitCache(async key => {
  const avatar: Avatar = JSON.parse(key);
  const pixels = await portraitPixels(avatar), [left, top] = PORTRAIT_CROPS[avatar.pose];
  const face = document.createElement('canvas');
  face.width = 32; face.height = 32;
  face.getContext('2d')!.drawImage(toCanvas(pixels, 64, 64), left, top, 32, 32, 0, 0, 32, 32);
  return toUrl(face);
});

export function useAvatarPortrait(config: AvatarConfig | null | undefined) {
  const avatar = fromAvatarConfig(config);
  const key = avatar ? JSON.stringify(avatar) : '';
  const [result, setResult] = useState<{ key: string; url: string } | null>(null);
  useEffect(() => {
    if (!key) return;
    let active = true;
    const portrait = portraits.acquire(key);
    portrait.promise.then(url => { if (active && url) setResult({ key, url }); });
    return () => { active = false; portrait.release(); };
  }, [key]);
  return key && result?.key === key ? result.url : null;
}
