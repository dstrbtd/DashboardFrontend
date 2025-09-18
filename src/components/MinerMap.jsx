import React, { useEffect, useRef } from 'react';
import Globe from 'react-globe.gl';

const miners = [
  { id: 1, name: "US Miner", coordinates: [39.8283, -98.5795] }, // lat, lng
  { id: 2, name: "Asia Miner", coordinates: [35.8617, 104.1954] },
  { id: 3, name: "Europe Miner", coordinates: [52.5163, 13.4050] }, // Berlin
];

const MinerGlobe = () => {
  const globeRef = useRef();

  useEffect(() => {
    if (!globeRef.current) return;
    globeRef.current.controls().autoRotate = true;
    globeRef.current.controls().autoRotateSpeed = 0.7;
  }, []);

  return (
    <div style={{ width: '100%', height: '600px' }}>
      <Globe
        ref={globeRef}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        
        // instead of pointsData → use htmlElementsData
        htmlElementsData={miners}
        htmlLat={(d) => d.coordinates[0]}
        htmlLng={(d) => d.coordinates[1]}
        htmlAltitude={0.05}
        htmlElement={(d) => {
          const el = document.createElement('div');
          el.innerHTML = `<div 
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
              ">
              ${d.name[0]} 
            </div>`;
          return el;
        }}
      />
    </div>
  );
};

export default MinerGlobe;
