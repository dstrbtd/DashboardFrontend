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
        htmlElementsData={miners}
        htmlLat={(d) => d.coordinates[0]}
        htmlLng={(d) => d.coordinates[1]}
        htmlAltitude={0.05}
        htmlElement={(d) => {
          const el = document.createElement('div');
          el.innerHTML = `<div 
            title="${d.name}" 
            style="
              width: 28px;
              height: 28px;
              border-radius: 50%;
              background: white;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
              font-weight: bold;
              color: black;
              border: 2px solid #333;
              cursor: pointer;
            ">
            ${d.name[0]}
          </div>`;
          return el;
        }}
        backgroundColor="black"
      />
    </div>
  );
};

export default MinerGlobe;
