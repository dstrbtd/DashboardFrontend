import React, { useEffect, useRef, useState } from 'react';
import Globe from 'react-globe.gl';

const MinerGlobe = () => {
  const globeRef = useRef();
  const [miners, setMiners] = useState([]);
  const [autoRotate, setAutoRotate] = useState(true);

  useEffect(() => {
    fetch('/miners.json')
      .then((res) => res.json())
      .then((data) => setMiners(data))
      .catch((err) => console.error("Failed to load miners.json:", err));
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

  return (
    <div style={{ width: '100%', height: '600px' }}>
      <Globe
        ref={globeRef}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-water.png"
        pointsData={miners}
        pointLat={(d) => d.coordinates[0]}
        pointLng={(d) => d.coordinates[1]}
        pointColor={() => "white"}
        pointAltitude={0.12}
        pointLabel={(d) => d.name}
        backgroundColor="black"
      />
    </div>
  );
};

export default MinerGlobe;
