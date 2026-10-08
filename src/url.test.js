import { describe, expect, it } from 'vitest';

import { isPublic, parseUrl, urlFor } from './url';

const DONGLE = '0000aaaa0000aaaa';
const LOG = '2026-08-06--12-00-00';
const NEW_LOG = '0000010a--a51155e496';

describe('parseUrl', () => {
  it.each([
    ['/', { page: 'home' }],
    ['/demo', { page: 'home' }],
    ['/auth/code/provider', { page: 'home' }],
    ['/referrals', { page: 'referrals' }],
    [`/${DONGLE}`, { page: 'dashboard', dongleId: DONGLE }],
    [`/${DONGLE}/`, { page: 'dashboard', dongleId: DONGLE }],
    [`/${DONGLE}/prime`, { page: 'prime', dongleId: DONGLE }],
    [`/${DONGLE}/stream`, { page: 'stream', dongleId: DONGLE }],
    [`/${DONGLE}/${LOG}`, { page: 'drive', dongleId: DONGLE, logId: LOG }],
    [`/${DONGLE}/${NEW_LOG}`, { page: 'drive', dongleId: DONGLE, logId: NEW_LOG }],
    [`/${DONGLE}/${LOG}/0/20`, { page: 'drive', dongleId: DONGLE, logId: LOG, start: 0, end: 20000 }],
    [`/${DONGLE}/1000/2000`, { page: 'legacy', dongleId: DONGLE, startMs: 1000, endMs: 2000 }],
  ])('%s', (pathname, expected) => {
    expect(parseUrl(pathname)).toEqual(expected);
  });

  it.each([
    `/${DONGLE}/prime/extra`,
    `/not-a-device/prime`,
    `/${DONGLE}0/prime`,
    `/x${DONGLE}`,
    `/${DONGLE}/${LOG}/10`,
    `/${DONGLE}/${LOG}/a/b`,
    `/${DONGLE}/10`,
    `/${DONGLE}/${LOG}/20/10`,
    `/${DONGLE}/2000/1000`,
  ])('rejects %s', (pathname) => {
    expect(parseUrl(pathname)).toEqual({ page: 'home' });
  });
});

it.each([
  ['drive', true], ['legacy', true], ['dashboard', false], ['prime', false], ['home', false],
])('isPublic(%s)', (page, expected) => {
  expect(isPublic({ page })).toBe(expected);
});

describe('urlFor', () => {
  it.each([
    `/${DONGLE}`,
    `/${DONGLE}/prime`,
    `/${DONGLE}/stream`,
    `/${DONGLE}/${LOG}`,
    `/${DONGLE}/${LOG}/0/20`,
    `/${DONGLE}/1000/2000`,
    '/referrals',
  ])('is the inverse of parseUrl for %s', (pathname) => {
    expect(urlFor(parseUrl(pathname))).toBe(pathname);
  });

  it('falls back to / without a device', () => {
    expect(urlFor({ page: 'dashboard', dongleId: null })).toBe('/');
    expect(urlFor({ page: 'prime' })).toBe('/');
  });

  it('rounds a drive zoom outwards to whole seconds', () => {
    expect(urlFor({ page: 'drive', dongleId: DONGLE, logId: LOG, start: 10500, end: 20100 })).toBe(`/${DONGLE}/${LOG}/10/21`);
  });
});
