// SPDX-FileCopyrightText: 2026 Sascha Brawer <sascha@brawer.ch>
// SPDX-License-Identifier: MIT

import { useCallback, useEffect, useState } from 'react';
import MapView from './components/MapView.jsx';
import AppBar from './components/AppBar.jsx';
import Drawer from './components/Drawer.jsx';
import RampCard from './components/RampCard.jsx';
import { watchDatapackage } from './lib/datapackage.js';

export default function App() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [datapackage, setDatapackage] = useState(null);
  const [newVersion, setNewVersion] = useState(null);
  const [cogMeta, setCogMeta] = useState(null); // { smax }
  const [viewportRange, setViewportRange] = useState(null); // { min, max } in ln-space
  const [tapValue, setTapValue] = useState(null); // { value, normalized, lngLat }

  useEffect(() => watchDatapackage(setDatapackage, setNewVersion), []);

  const onCogMeta = useCallback((meta) => setCogMeta(meta), []);
  const onViewportRange = useCallback((range) => setViewportRange(range), []);
  const onTapValue = useCallback((tap) => setTapValue(tap), []);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {datapackage && (
        <MapView
          tiffUrl={datapackage.tiffUrl}
          onCogMeta={onCogMeta}
          onViewportRange={onViewportRange}
          onTapValue={onTapValue}
        />
      )}

      <AppBar onMenuClick={() => setDrawerOpen(true)} />
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} buildVersion={datapackage?.version} />

      {newVersion && (
        <button type="button" className="update-banner" onClick={() => window.location.reload()}>
          New data available — tap to reload
        </button>
      )}

      <RampCard smax={cogMeta?.smax} viewportRange={viewportRange} tapValue={tapValue} />
    </div>
  );
}
