import { vi } from 'vitest';
import { LOCATION_CHANGE, replace } from 'connected-react-router';

import { api } from '../api/backend';
import { onHistoryMiddleware } from './history';
import * as actions from './index';

vi.mock('../api/backend', () => ({ api: { auth: { isAuthenticated: vi.fn() }, routes: { getRoutesSegments: vi.fn() } } }));
vi.mock('./index', () => ({ selectDevice: vi.fn(), selectDrive: vi.fn(), checkRoutesData: vi.fn() }));

const DONGLE = '0000aaaa0000aaaa';
const OTHER = '1111bbbb1111bbbb';
const LOG = '2026-08-06--12-00-00';
const baseState = { dongleId: DONGLE, zoom: null, selectedRouteId: null, currentRoute: null };

function location(pathname, action = 'POP') {
  return { type: LOCATION_CHANGE, payload: { action, location: { pathname } } };
}

// Runs the middleware on a location change and returns the actions it dispatched.
function navigateTo(pathname, state = baseState) {
  const dispatched = [];
  const getState = () => ({ ...state, router: { location: { pathname } } });
  const dispatch = (action) => (typeof action === 'function' ? action(dispatch, getState) : dispatched.push(action));
  const next = vi.fn();
  onHistoryMiddleware({ dispatch, getState })(next)(location(pathname));
  expect(next).toHaveBeenCalledOnce();
  return dispatched;
}

beforeEach(() => {
  vi.clearAllMocks();
  api.auth.isAuthenticated.mockReturnValue(true);
  for (const name of ['selectDevice', 'selectDrive', 'checkRoutesData']) {
    actions[name].mockImplementation((...args) => ({ action: name, args }));
  }
});

describe('history middleware', () => {
  it('passes other actions through untouched', () => {
    const next = vi.fn();
    onHistoryMiddleware({ dispatch: vi.fn(), getState: vi.fn() })(next)({ type: 'TEST' });
    expect(next).toHaveBeenCalledWith({ type: 'TEST' });
  });

  it.each(['PUSH', 'POP', 'REPLACE'])('applies a %s', (historyAction) => {
    const dispatch = vi.fn();
    onHistoryMiddleware({ dispatch, getState: () => baseState })(vi.fn())(location(`/${OTHER}`, historyAction));
    expect(dispatch).toHaveBeenCalledOnce();
  });

  it('selects a changed device and fetches its drives', () => {
    expect(navigateTo(`/${OTHER}`)).toEqual([
      { action: 'selectDevice', args: [OTHER, true] },
      { action: 'checkRoutesData', args: [] },
    ]);
  });

  it('selects a changed device without its drive list when opening a drive', () => {
    expect(navigateTo(`/${OTHER}/${LOG}`)[0]).toEqual({ action: 'selectDevice', args: [OTHER, false] });
  });

  it('keeps state when the URL already matches it', () => {
    expect(navigateTo(`/${DONGLE}`)).toEqual([{ action: 'checkRoutesData', args: [] }]);
    const zoomed = { ...baseState, selectedRouteId: LOG, zoom: { start: 10000, end: 20000 } };
    expect(navigateTo(`/${DONGLE}/${LOG}/10/20`, zoomed)).toEqual([{ action: 'checkRoutesData', args: [] }]);
    const whole = { ...baseState, selectedRouteId: LOG, currentRoute: { duration: 60500 }, zoom: { start: 0, end: 60500 } };
    expect(navigateTo(`/${DONGLE}/${LOG}`, whole)).toEqual([{ action: 'checkRoutesData', args: [] }]);
  });

  it.each([
    ['opens a drive', baseState, `/${DONGLE}/${LOG}`, [LOG, undefined, undefined]],
    ['zooms in', { ...baseState, selectedRouteId: LOG }, `/${DONGLE}/${LOG}/10/20`, [LOG, 10000, 20000]],
    ['zooms out', { ...baseState, selectedRouteId: LOG, zoom: { start: 10000, end: 20000 } }, `/${DONGLE}/${LOG}`, [LOG, undefined, undefined]],
    ['closes a drive', { ...baseState, selectedRouteId: LOG }, `/${DONGLE}`, [null, undefined, undefined]],
    ['closes a drive for Prime', { ...baseState, selectedRouteId: LOG }, `/${DONGLE}/prime`, [null, undefined, undefined]],
  ])('%s', (_name, state, pathname, args) => {
    expect(navigateTo(pathname, state)).toContainEqual({ action: 'selectDrive', args });
  });

  it('leaves state alone behind the login page, except for drives', () => {
    api.auth.isAuthenticated.mockReturnValue(false);
    expect(navigateTo(`/${OTHER}`)).toEqual([]);
    expect(navigateTo(`/${OTHER}/prime`)).toEqual([]);
    expect(navigateTo(`/${OTHER}/${LOG}`)[0]).toEqual({ action: 'selectDevice', args: [OTHER, false] });
  });

  it('replaces a legacy time range link with its drive', async () => {
    api.routes.getRoutesSegments.mockResolvedValue([{ fullname: `${DONGLE}|${LOG}` }]);
    const dispatched = navigateTo(`/${DONGLE}/1000/2000`);
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
    const dispatched = navigateTo(`/${DONGLE}/1000/2000`);
    await vi.waitFor(() => expect(api.routes.getRoutesSegments).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(dispatched.filter((a) => a.type)).toEqual([]);
  });
});
