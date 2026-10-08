import { vi } from 'vitest';
import { push } from 'connected-react-router';
import { navigate } from './index';

vi.mock('../timeline/playback', () => ({
  reducer: (state) => state,
  resetPlayback: vi.fn(),
  selectLoop: vi.fn(),
}));

describe('navigate', () => {
  const run = (params) => {
    const dispatch = vi.fn();
    navigate(params)(dispatch, () => ({ dongleId: 'aaaaaaaaaaaaaaaa', router: { location: { pathname: '/aaaaaaaaaaaaaaaa' } } }));
    return dispatch.mock.calls[0]?.[0];
  };

  it.each([
    [{ page: 'prime' }, '/aaaaaaaaaaaaaaaa/prime'],
    [{ page: 'drive', logId: '2026-08-06--12-00-00', start: 0, end: 20000 }, '/aaaaaaaaaaaaaaaa/2026-08-06--12-00-00/0/20'],
    [{ page: 'settings', dongleId: 'bbbbbbbbbbbbbbbb' }, '/bbbbbbbbbbbbbbbb/settings'],
  ])('%j pushes %s', (params, url) => {
    expect(run(params)).toEqual(push(url));
  });

  it('does not push the URL already shown', () => {
    expect(run({ page: 'dashboard' })).toBeUndefined();
  });
});
