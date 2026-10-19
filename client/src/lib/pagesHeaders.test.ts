import { describe, expect, it } from 'vitest';
import headersFile from '../../public/_headers?raw';
import { headersForPath, parsePagesHeaders, patternMatches } from './pagesHeaders';

const rules = parsePagesHeaders(headersFile);
const immutable = 'public, max-age=31536000, immutable';
const revalidate = 'public, max-age=0, must-revalidate';

describe('Cloudflare Pages cache headers', () => {
  it('keeps hashed build files immutable for a year', () => {
    for (const path of ['/static/index-BX3k9a1f.js', '/static/index-Cq81Lm0z.css', '/static/logo-a1b2c3d4.png']) {
      expect(headersForPath(rules, path).get('cache-control')).toEqual([immutable]);
    }
  });

  it('makes html, deep links and unhashed public files revalidate after every deploy', () => {
    for (const path of [
      '/',
      '/index.html',
      '/paths/abc',
      '/rooms/7',
      '/favicon.png',
      '/hackademy-wordmark.png',
      '/assets/mascot/x.png',
      '/assets/arena/background.png',
      '/robots.txt',
      '/sitemap.xml',
      '/prototypes/runtime/manifest.json',
      '/prototypes/runtime/kernel.bin',
    ]) {
      expect(headersForPath(rules, path).get('cache-control')).toEqual([revalidate]);
    }
  });

  it('never sends two cache policies or a missing nosniff header', () => {
    for (const path of ['/', '/static/a-1.js', '/assets/pixel/a.png', '/static']) {
      const headers = headersForPath(rules, path);
      expect(headers.get('cache-control')).toHaveLength(1);
      expect(headers.get('x-content-type-options')).toEqual(['nosniff']);
    }
  });
});

describe('Pages _headers parser', () => {
  it('reads patterns, headers, detached headers and comments', () => {
    expect(parsePagesHeaders('# note\n/a/*\n  X-One: 1\n  ! X-Two\n\n/b\n  X-Three: a: b\n')).toEqual([
      { pattern: '/a/*', set: [['x-one', '1']], unset: ['x-two'] },
      { pattern: '/b', set: [['x-three', 'a: b']], unset: [] },
    ]);
  });

  it('rejects malformed files', () => {
    expect(() => parsePagesHeaders('  X-One: 1')).toThrow('Line 1: header without a path pattern');
    expect(() => parsePagesHeaders('static/*')).toThrow('Line 1: expected a path pattern');
    expect(() => parsePagesHeaders('/a\n  broken')).toThrow('Line 2: expected "Name: value"');
  });

  it('matches splats and placeholders like Pages', () => {
    expect(patternMatches('/*', '/')).toBe(true);
    expect(patternMatches('/static/*', '/static')).toBe(false);
    expect(patternMatches('/users/:id/avatar.png', '/users/7/avatar.png')).toBe(true);
    expect(patternMatches('/users/:id/avatar.png', '/users/7/8/avatar.png')).toBe(false);
    expect(patternMatches('/a.png', '/aXpng')).toBe(false);
  });

  it('appends repeated headers and lets later rules detach earlier ones', () => {
    const parsed = parsePagesHeaders('/*\n  X-A: 1\n/b\n  X-A: 2\n/c\n  ! X-A\n');
    expect(headersForPath(parsed, '/b').get('x-a')).toEqual(['1', '2']);
    expect(headersForPath(parsed, '/c').has('x-a')).toBe(false);
  });
});
