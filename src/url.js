// Every URL connect understands. parseUrl() reads one and urlFor() writes one,
// both from this table, so the two can't disagree. To add a page, add a row.
const ROUTES = [
  { page: 'referrals', path: '/referrals' },
  { page: 'dashboard', path: '/:dongleId' },
  { page: 'prime', path: '/:dongleId/prime' },
  { page: 'stream', path: '/:dongleId/stream' },
  { page: 'settings', path: '/:dongleId/settings' },
  { page: 'drive', path: '/:dongleId/:logId/:start/:end', public: true },
  { page: 'drive', path: '/:dongleId/:logId', public: true },
  { page: 'legacy', path: '/:dongleId/:startMs/:endMs', public: true }, // old links to a time range
];

// What each :param looks like in a URL, and how it reads into state.
// Times are milliseconds in state; a drive's zoom is whole seconds in the URL.
const PARAMS = {
  dongleId: { pattern: /^[a-f0-9]{16}$/ },
  logId: { pattern: /^[a-f0-9-]{20}$/ },
  start: { pattern: /^\d+$/, read: (s) => Number(s) * 1000, write: (ms) => Math.floor(ms / 1000) },
  end: { pattern: /^\d+$/, read: (s) => Number(s) * 1000, write: (ms) => Math.ceil(ms / 1000) },
  startMs: { pattern: /^\d+$/, read: Number },
  endMs: { pattern: /^\d+$/, read: Number },
};

const segments = (path) => path.split('/').filter(Boolean);
const paramName = (segment) => (segment.startsWith(':') ? segment.slice(1) : null);

function match(route, parts) {
  const url = { page: route.page };
  const names = segments(route.path);
  const matches = names.length === parts.length && names.every((segment, i) => {
    const name = paramName(segment);
    if (!name) {
      return segment === parts[i];
    }
    const { pattern, read = String } = PARAMS[name];
    url[name] = read(parts[i]);
    return pattern.test(parts[i]);
  });
  const ordered = !(url.start >= url.end) && !(url.startMs >= url.endMs);
  return matches && ordered ? url : null;
}

// '/0123456789abcdef/2026-08-06--12-00-00/10/20' -> {
//   page: 'drive', dongleId: '0123456789abcdef', logId: '2026-08-06--12-00-00', start: 10000, end: 20000 }
// Anything else is { page: 'home' }.
export function parseUrl(pathname) {
  const parts = segments(pathname);
  for (const route of ROUTES) {
    const url = match(route, parts);
    if (url) {
      return url;
    }
  }
  return { page: 'home' };
}

// A drive URL's zoom as state holds it, or null when it shows the whole drive.
export function getZoom({ start, end }) {
  return end !== undefined ? { start, end } : null;
}

// Drives can be shared by link, so they open without signing in.
export function isPublic({ page }) {
  return ROUTES.some((route) => route.page === page && route.public);
}

// The inverse of parseUrl, using the first route for `page` that has all its params.
export function urlFor({ page, ...params }) {
  const has = (name) => params[name] !== null && params[name] !== undefined;
  const route = ROUTES.find((r) => r.page === page
    && segments(r.path).map(paramName).every((name) => !name || has(name)));
  if (!route) {
    return '/';
  }
  return route.path.replace(/:(\w+)/g, (_, name) => {
    const { write = String } = PARAMS[name];
    return write(params[name]);
  });
}
