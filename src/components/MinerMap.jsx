import React, { useEffect, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import { MeshLambertMaterial, DoubleSide } from 'three';
import * as topojson from 'topojson-client';

const MinerGlobeHollow = () => {
  const globeRef = useRef();
  const [miners, setMiners] = useState([]);
  const [landPolygons, setLandPolygons] = useState([]);
  const [autoRotate, setAutoRotate] = useState(true);

  useEffect(() => {
    fetch('/miners.json')
      .then(res => res.json())
      .then(data => setMiners(data))
      .catch(err => console.error("Failed to load miners.json:", err));
  }, []);

  useEffect(() => {
    fetch('//unpkg.com/world-atlas/land-110m.json')
      .then(res => res.json())
      .then(worldData => {
        setLandPolygons(topojson.feature(worldData, worldData.objects.land).features);
      });
  }, []);

  useEffect(() => {
    if (!globeRef.current) return;
    const controls = globeRef.current.controls();
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.7;

    const handleInteractionStart = () => setAutoRotate(false);
    controls.addEventListener('start', handleInteractionStart);
    return () => controls.removeEventListener('start', handleInteractionStart);
  }, [autoRotate]);

  const polygonsMaterial = new MeshLambertMaterial({
    color: 'white',
    transparent: true,
    opacity: 0.95,
    side: DoubleSide,
  });


  return (
    <div style={{ width: '100%', height: '600px' }}>
      <Globe
        ref={globeRef}
        backgroundColor="black"
        showGlobe={false}
        showAtmosphere={false}
        polygonsData={landPolygons}
        polygonCapMaterial={polygonsMaterial}
        polygonSideColor={() => 'rgba(0,0,0,0)'}
        pointsData={miners}
        pointLat={d => d.coordinates[0]}
        pointLng={d => d.coordinates[1]}
        pointColor={() => '#529aff'} //red
        pointAltitude={0.12}
        pointRadius={0.52}
        pointLabel={d => d.name}
      />
    </div>
  );
};

export default MinerGlobeHollow;
