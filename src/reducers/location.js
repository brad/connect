import { getZoom, parseUrl } from '../url';
import { getDefaultFilter } from '../utils/filter';

// The device, drive and zoom on screen are read from the URL here and written
// nowhere else: there are no actions to select them, only URLs to visit.
// Whatever the URL doesn't name (the device behind /referrals) is kept.
export function applyLocation(state, pathname) {
  const url = parseUrl(pathname);
  let next = state;
  if (url.dongleId && url.dongleId !== state.dongleId) {
    next = showDevice(next, url.dongleId);
  }
  return showDrive(next, url.page === 'drive' ? url : {});
}

function showDevice(state, dongleId) {
  window.localStorage.setItem('selectedDongleId', dongleId);
  const sameRoutes = state.routesMeta?.dongleId === dongleId;
  return {
    ...state,
    dongleId,
    device: state.devices && state.device?.dongle_id !== dongleId
      ? state.devices.find((device) => device.dongle_id === dongleId) ?? null
      : state.device,
    filter: getDefaultFilter(),
    limit: 0,
    subscription: null,
    subscribeInfo: null,
    files: null,
    ...(sameRoutes ? {} : {
      routesMeta: { dongleId: null, start: null, end: null },
      routes: null,
      lastRoutes: null,
    }),
  };
}

// No logId closes the drive. No range shows all of it.
function showDrive(state, url) {
  const logId = url.logId ?? null;
  const range = getZoom(url);
  const currentRoute = state.routes?.find((route) => route.log_id === logId) ?? null;
  const wholeDrive = currentRoute ? { start: 0, end: currentRoute.duration } : null;
  const zoom = logId ? (range ?? wholeDrive) : null;
  const sameDrive = logId === state.selectedRouteId;
  if (sameDrive && zoom?.start === state.zoom?.start && zoom?.end === state.zoom?.end) {
    return state;
  }

  const zoomedIn = sameDrive && range && state.zoom && range.start >= state.zoom.start && range.end <= state.zoom.end;
  return {
    ...state,
    selectedRouteId: logId,
    currentRoute,
    zoom,
    files: zoomedIn ? state.files : null,
  };
}
