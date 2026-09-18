// SPDX-FileCopyrightText: 2026 Sascha Brawer <sascha@brawer.ch>
// SPDX-License-Identifier: MIT

// Resolves the current weekly build via /data/datapackage.json, per
// https://github.com/brawer/osmviews/blob/main/docs/downloads.md.

const RECHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // pipeline runs weekly; 24h is plenty prompt

export async function fetchDatapackage() {
  const res = await fetch('/data/datapackage.json', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`GET /data/datapackage.json: ${res.status}`);
  }
  const pkg = await res.json();
  const osmviews = pkg.resources?.find((r) => r.name === 'osmviews');
  if (!osmviews) {
    throw new Error('datapackage.json has no "osmviews" resource');
  }
  return {
    version: pkg.version,
    tiffUrl: `/data/${osmviews.path}`,
    tiffBytes: osmviews.bytes,
  };
}

// Calls onUpdate(datapackage) once immediately, then again whenever
// `version` changes on a 24h recheck. Returns a cleanup function.
export function watchDatapackage(onUpdate, onNewVersionAvailable) {
  let current = null;
  let stopped = false;

  async function poll() {
    try {
      const pkg = await fetchDatapackage();
      if (current === null) {
        current = pkg.version;
        onUpdate(pkg);
      } else if (pkg.version !== current) {
        onNewVersionAvailable(pkg);
      }
    } catch (err) {
      console.error('Failed to check datapackage.json:', err);
    }
  }

  poll();
  const id = setInterval(() => {
    if (!stopped) poll();
  }, RECHECK_INTERVAL_MS);

  return () => {
    stopped = true;
    clearInterval(id);
  };
}
