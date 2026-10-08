import { LOCATION_CHANGE, replace } from 'connected-react-router';
import { getZoom, isPublic, parseUrl, urlFor } from '../url';
import { resetPlayback, selectLoop } from '../timeline/playback';
import { webrtcConnectionManager } from '../utils/webrtc';
import { checkLastRoutesData, checkRoutesData, fetchDeviceOnline, primeFetchSubscription } from './index';
import { api } from '../api/backend';

// Old links name a time range instead of a drive: find the drive and replace
// the URL with it, unless the user has navigated away in the meantime.
function resolveLegacyUrl(pathname, { dongleId, startMs, endMs }) {
  return async (dispatch, getState) => {
    try {
      const routes = await api.routes.getRoutesSegments(dongleId, startMs, endMs);
      if (routes?.length && getState().router.location.pathname === pathname) {
        const logId = routes[0].fullname.split('|')[1];
        dispatch(replace(urlFor({ page: 'drive', dongleId, logId })));
      }
    } catch (err) {
      console.error('Error fetching routes data for log ID conversion', err);
    }
  };
}

// Loop a zoomed range. Keep playing when zooming out, start over anywhere else.
function loopDrive(prev, state, url) {
  return (dispatch) => {
    const range = getZoom(url);
    const { loop } = state;
    const loopIsRange = range && loop?.startTime === range.start && loop.duration === range.end - range.start;
    if (state.selectedRouteId !== prev.selectedRouteId || (range && !loopIsRange)) {
      dispatch(resetPlayback());
    }
    dispatch(selectLoop(range?.start, range?.end));
  };
}

// The reducer has already applied the URL (see reducers/location.js).
// This fetches what the new location needs and restarts playback.
function loadLocation(prev) {
  return (dispatch, getState) => {
    const state = getState();
    const pathname = state.router.location.pathname;
    const url = parseUrl(pathname);
    if (!api.auth.isAuthenticated() && !isPublic(url)) {
      return; // the login page is showing
    }

    if (url.page === 'legacy') {
      dispatch(resolveLegacyUrl(pathname, url));
    }
    if (state.selectedRouteId !== prev.selectedRouteId || state.zoom !== prev.zoom) {
      dispatch(loopDrive(prev, state, url));
    }

    if (state.dongleId === prev.dongleId) {
      dispatch(checkRoutesData());
      return;
    }
    if (prev.dongleId) {
      webrtcConnectionManager.disconnect();
    }
    if ((state.device && !state.device.shared) || state.profile?.superuser) {
      dispatch(primeFetchSubscription(state.dongleId, state.device));
      dispatch(fetchDeviceOnline(state.dongleId));
    }
    // a drive URL fetches just its drive
    dispatch(url.logId ? checkRoutesData() : checkLastRoutesData());
  };
}

// Every location change (the first load, PUSH, POP and REPLACE) loads what it shows.
export const onHistoryMiddleware = ({ dispatch, getState }) => (next) => (action) => {
  if (!action) {
    return undefined;
  }

  const prev = getState();
  const result = next(action);
  if (action.type === LOCATION_CHANGE) {
    dispatch(loadLocation(prev));
  }
  return result;
};
