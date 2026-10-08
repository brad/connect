import { vi } from 'vitest';
import { LOCATION_CHANGE, replace } from 'connected-react-router';

import { api } from '../api/backend';
import { webrtcConnectionManager } from '../utils/webrtc';
import { onHistoryMiddleware } from './history';
import * as actions from './index';

vi.mock('../api/backend', () => ({ api: { auth: { isAuthenticated: vi.fn() }, routes: { getRoutesSegments: vi.fn() } } }));
vi.mock('../timeline/playback', () => ({
  resetPlayback: () => ({ action: 'resetPlayback' }),
  selectLoop: (start, end) => ({ action: 'selectLoop', args: [start, end] }),
}));
vi.mock('../utils/webrtc', () => ({ webrtcConnectionManager: { disconnect: vi.fn() } }));
vi.mock('./index', () => ({
  checkLastRoutesData: vi.fn(), checkRoutesData: vi.fn(), fetchDeviceOnline: vi.fn(), primeFetchSubscription: vi.fn(),
}));

const DONGLE = '0000aaaa0000aaaa';
const OTHER = '1111bbbb1111bbbb';
const LOG = '2026-08-06--12-00-00';
const owned = (dongleId) => ({ dongle_id: dongleId, shared: false });
const onDevice = { dongleId: DONGLE };
const CHECK_ROUTES = { action: 'checkRoutesData', args: [] };

function location(pathname, action = 'POP') {
  return { type: LOCATION_CHANGE, payload: { action, location: { pathname } } };
}

// Runs the middleware on a location change from `before` to `after` and
// returns the actions it dispatched. The reducer is faked by swapping state.
function navigateTo(pathname, before, after = before, historyAction) {
  const dispatched = [];
  let state = before;
  const getState = () => ({ ...state, router: { location: { pathname } } });
  const dispatch = (action) => (typeof action === 'function' ? action(dispatch, getState) : dispatched.push(action));
  const next = vi.fn(() => { state = after; });
  onHistoryMiddleware({ dispatch, getState })(next)(location(pathname, historyAction));
  expect(next).toHaveBeenCalledOnce();
  return dispatched;
}

beforeEach(() => {
  vi.clearAllMocks();
  api.auth.isAuthenticated.mockReturnValue(true);
  for (const name of Object.keys(actions)) {
    actions[name].mockImplementation((...args) => ({ action: name, args }));
  }
});

describe('history middleware', () => {
  it('passes other actions through untouched', () => {
    const next = vi.fn();
    const dispatch = vi.fn();
    onHistoryMiddleware({ dispatch, getState: vi.fn() })(next)({ type: 'TEST' });
    expect(next).toHaveBeenCalledWith({ type: 'TEST' });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it.each(['PUSH', 'POP', 'REPLACE'])('loads a %s', (historyAction) => {
    expect(navigateTo(`/${DONGLE}`, onDevice, onDevice, historyAction)).toEqual([CHECK_ROUTES]);
  });

  it('only checks the drives when the device stays', () => {
    expect(navigateTo(`/${DONGLE}/${LOG}`, { ...onDevice, device: owned(DONGLE) })).toEqual([CHECK_ROUTES]);
  });

  it('loads a new device and its drive list', () => {
    const before = { dongleId: DONGLE, device: owned(DONGLE) };
    const after = { dongleId: OTHER, device: owned(OTHER) };
    expect(navigateTo(`/${OTHER}`, before, after)).toEqual([
      { action: 'primeFetchSubscription', args: [OTHER, owned(OTHER)] },
      { action: 'fetchDeviceOnline', args: [OTHER] },
      { action: 'checkLastRoutesData', args: [] },
    ]);
    expect(webrtcConnectionManager.disconnect).toHaveBeenCalledOnce();
  });

  it('loads just the drive when a link opens it on a new device', () => {
    const after = { dongleId: OTHER, device: { dongle_id: OTHER, shared: true } };
    expect(navigateTo(`/${OTHER}/${LOG}`, { dongleId: null }, after)).toEqual([CHECK_ROUTES]);
    expect(webrtcConnectionManager.disconnect).not.toHaveBeenCalled();
  });

  it('loads nothing behind the login page, except drives', () => {
    api.auth.isAuthenticated.mockReturnValue(false);
    const after = { dongleId: OTHER, device: null };
    expect(navigateTo(`/${OTHER}`, { dongleId: null }, after)).toEqual([]);
    expect(navigateTo(`/${OTHER}/prime`, { dongleId: null }, after)).toEqual([]);
    expect(navigateTo(`/${OTHER}/${LOG}`, { dongleId: null }, after)).toEqual([CHECK_ROUTES]);
  });

  it.each([
    ['opens a drive', {}, `/${DONGLE}/${LOG}`, true, [undefined, undefined]],
    ['zooms in', { selectedRouteId: LOG, zoom: { start: 0, end: 60000 } }, `/${DONGLE}/${LOG}/10/20`, true, [10000, 20000]],
    ['zooms out', { selectedRouteId: LOG, zoom: { start: 10000, end: 20000 } }, `/${DONGLE}/${LOG}`, false, [undefined, undefined]],
    ['closes a drive', { selectedRouteId: LOG, zoom: { start: 0, end: 60000 } }, `/${DONGLE}`, true, [undefined, undefined]],
  ])('%s and sets the loop', (_name, before, pathname, restarts, loop) => {
    const url = pathname.split('/');
    const after = {
      dongleId: DONGLE,
      selectedRouteId: url[2] ?? null,
      zoom: url[4] ? { start: url[3] * 1000, end: url[4] * 1000 } : null,
      loop: before.zoom && { startTime: before.zoom.start, duration: before.zoom.end - before.zoom.start },
    };
    const dispatched = navigateTo(pathname, { ...onDevice, ...before }, after);
    expect(dispatched.some(({ action }) => action === 'resetPlayback')).toBe(restarts);
    expect(dispatched).toContainEqual({ action: 'selectLoop', args: loop });
  });

  it('keeps playing when the URL changes but not the drive', () => {
    const state = { ...onDevice, selectedRouteId: LOG, zoom: { start: 0, end: 60000 } };
    expect(navigateTo(`/${DONGLE}/${LOG}`, state)).toEqual([CHECK_ROUTES]);
  });

  it('replaces a legacy time range link with its drive', async () => {
    api.routes.getRoutesSegments.mockResolvedValue([{ fullname: `${DONGLE}|${LOG}` }]);
    const dispatched = navigateTo(`/${DONGLE}/1000/2000`, onDevice);
    await vi.waitFor(() => expect(dispatched).toContainEqual(replace(`/${DONGLE}/${LOG}`)));
    expect(api.routes.getRoutesSegments).toHaveBeenCalledWith(DONGLE, 1000, 2000);
  });

  it.each([
    ['finds nothing', () => api.routes.getRoutesSegments.mockResolvedValue([])],
    ['fails', () => {
      api.routes.getRoutesSegments.mockRejectedValue(new Error('lookup failed'));
      vi.spyOn(console, 'error').mockImplementationOnce(() => {});
    }],
  ])('keeps a legacy link when the lookup %s', async (_name, setup) => {
    setup();
    const dispatched = navigateTo(`/${DONGLE}/1000/2000`, onDevice);
    await vi.waitFor(() => expect(api.routes.getRoutesSegments).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(dispatched.filter((a) => a.type)).toEqual([]);
  });
});
