import { LOCATION_CHANGE, replace } from 'connected-react-router';
import { isPublic, parseUrl, urlFor } from '../url';
import { checkRoutesData, selectDevice, selectDrive } from './index';
import { api } from '../api/backend';

// The drive and zoom that state shows, written as a URL.
function selectedDriveUrl({ dongleId, selectedRouteId, currentRoute, zoom }) {
  const wholeDrive = !zoom || (zoom.start === 0 && zoom.end === currentRoute?.duration);
  return urlFor({ page: 'drive', dongleId, logId: selectedRouteId, ...(wholeDrive ? {} : zoom) });
}

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

// Make state match the URL, changing only what the URL changed.
// Which page is open is not stored: components read it with parseUrl.
export function applyUrl(pathname) {
  return (dispatch, getState) => {
    const url = parseUrl(pathname);
    if (!api.auth.isAuthenticated() && !isPublic(url)) {
      return; // the login page is showing
    }

    if (url.dongleId && url.dongleId !== getState().dongleId) {
      // a drive URL fetches just its drive, below
      dispatch(selectDevice(url.dongleId, !url.logId));
    }

    if (url.page === 'legacy') {
      dispatch(resolveLegacyUrl(pathname, url));
    }

    const state = getState();
    const drive = url.page === 'drive' ? urlFor(url) : null;
    const selected = state.selectedRouteId ? selectedDriveUrl(state) : null;
    if (drive !== selected) {
      dispatch(selectDrive(url.logId ?? null, url.start, url.end));
    }

    dispatch(checkRoutesData());
  };
}

// Every location change (the first load, PUSH, POP and REPLACE) goes through applyUrl.
export const onHistoryMiddleware = ({ dispatch }) => (next) => (action) => {
  if (!action) {
    return undefined;
  }

  const result = next(action); // the router state has to update first
  if (action.type === LOCATION_CHANGE) {
    dispatch(applyUrl(action.payload.location.pathname));
  }
  return result;
};
