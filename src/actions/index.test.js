import { vi } from 'vitest';
import { push } from 'connected-react-router';
import { navigate } from './index';

vi.mock('../timeline/playback', () => ({
  reducer: (state) => state,
  resetPlayback: vi.fn(),
  selectLoop: vi.fn(),
}));

const DONGLE = '0000aaaa0000aaaa';
const OTHER = '1111bbbb1111bbbb';
const LOG = '2026-08-06--12-00-00';

describe('navigate', () => {
  const run = (params) => {
    const dispatch = vi.fn();
    navigate(params)(dispatch, () => ({ dongleId: DONGLE, router: { location: { pathname: `/${DONGLE}` } } }));
    return dispatch.mock.calls[0]?.[0];
  };

  it.each([
    [{ page: 'prime' }, `/${DONGLE}/prime`],
    [{ page: 'drive', logId: LOG, start: 0, end: 20000 }, `/${DONGLE}/${LOG}/0/20`],
    [{ page: 'settings', dongleId: OTHER }, `/${OTHER}/settings`],
  ])('%j pushes %s', (params, url) => {
    expect(run(params)).toEqual(push(url));
  });

  it('does not push the URL already shown', () => {
    expect(run({ page: 'dashboard' })).toBeUndefined();
  });
});
