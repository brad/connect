import { createInitialState } from '../initialState';
import { applyLocation } from './location';

const DONGLE = '0000aaaa0000aaaa';
const OTHER = '1111bbbb1111bbbb';
const LOG = '2026-08-06--12-00-00';
const route = { log_id: LOG, duration: 60500 };

const base = {
  ...createInitialState(`/${DONGLE}`),
  device: { dongle_id: DONGLE },
  devices: [{ dongle_id: DONGLE }, { dongle_id: OTHER }],
  routes: [route],
  routesMeta: { dongleId: DONGLE, start: 1, end: 2 },
  limit: 10,
  subscription: { plan: 'x' },
  files: { a: 1 },
};
const onDrive = { ...base, selectedRouteId: LOG, currentRoute: route, zoom: { start: 0, end: 60500 } };
const zoomed = { ...onDrive, zoom: { start: 10000, end: 20000 } };

describe('applyLocation', () => {
  it('returns the same state when the URL is what is shown', () => {
    expect(applyLocation(base, `/${DONGLE}`)).toBe(base);
    expect(applyLocation(onDrive, `/${DONGLE}/${LOG}`)).toBe(onDrive);
    expect(applyLocation(zoomed, `/${DONGLE}/${LOG}/10/20`)).toBe(zoomed);
  });

  it('keeps the device on pages that do not name one', () => {
    expect(applyLocation(base, '/referrals').dongleId).toBe(DONGLE);
  });

  it('switches device and drops what belonged to the old one', () => {
    const state = applyLocation(base, `/${OTHER}`);
    expect(state).toMatchObject({
      dongleId: OTHER,
      device: { dongle_id: OTHER },
      routes: null,
      routesMeta: { dongleId: null, start: null, end: null },
      limit: 0,
      subscription: null,
      files: null,
    });
    expect(state.filter).not.toBe(base.filter);
  });

  it('opens a drive from the list', () => {
    const state = applyLocation(base, `/${DONGLE}/${LOG}`);
    expect(state).toMatchObject({ selectedRouteId: LOG, currentRoute: route, zoom: { start: 0, end: 60500 }, files: null });
  });

  it('opens a drive that has not loaded yet without a zoom', () => {
    const state = applyLocation({ ...base, routes: null }, `/${DONGLE}/${LOG}`);
    expect(state).toMatchObject({ selectedRouteId: LOG, currentRoute: null, zoom: null });
  });

  it('zooms in and keeps the files', () => {
    const state = applyLocation(onDrive, `/${DONGLE}/${LOG}/10/20`);
    expect(state.zoom).toEqual({ start: 10000, end: 20000 });
    expect(state.files).toBe(onDrive.files);
  });

  it('zooms out and drops the files', () => {
    const state = applyLocation(zoomed, `/${DONGLE}/${LOG}`);
    expect(state).toMatchObject({ zoom: { start: 0, end: 60500 }, files: null });
  });

  it.each([`/${DONGLE}`, `/${DONGLE}/prime`, `/${DONGLE}/1000/2000`])('closes the drive on %s', (pathname) => {
    expect(applyLocation(zoomed, pathname)).toMatchObject({ selectedRouteId: null, currentRoute: null, zoom: null });
  });
});
