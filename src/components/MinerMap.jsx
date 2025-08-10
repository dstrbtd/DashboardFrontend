import React from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';

const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const miners = [
  { id: 1, name: "US Miner", coordinates: [-98.5795, 39.8283] }, // Kansas, US
  { id: 2, name: "Asia Miner", coordinates: [104.1954, 35.8617] }, // China
  { id: 3, name: "Europe Miner", coordinates: [15.2551, 52.5163] }, // Berlin
];

const SimpleWorldMap = () => {
  return (
    <div style={{ width: '100%', maxWidth: 800, margin: '0 auto' }}>
      <ComposableMap
        projection="geoEqualEarth"
        projectionConfig={{ scale: 150 }}
      >
        {/* World countries */}
        <Geographies geography={geoUrl}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#EAEAEC"
                stroke="#D6D6DA"
                strokeWidth={0.5}
              />
            ))
          }
        </Geographies>

        {/* Miner markers */}
        {miners.map(({ id, name, coordinates }) => (
          <Marker key={id} coordinates={coordinates}>
            <circle r={6} fill="#F53" stroke="#FFF" strokeWidth={1} />
            <text
              textAnchor="middle"
              y={-10}
              style={{ fontFamily: 'system-ui', fill: '#5D5A6D', fontSize: 10 }}
            >
              {name}
            </text>
          </Marker>
        ))}
      </ComposableMap>
    </div>
  );
};

export default SimpleWorldMap;