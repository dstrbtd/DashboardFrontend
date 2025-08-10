import React from 'react';
import minerGraphImg from './assets/miner_graph_v1_random10.png';

function MinerGraph() {
  return (
    <div style={{ width: '100%', textAlign: 'center' }}>
      <img 
        src={minerGraphImg} 
        alt="Miner Graph" 
        style={{ maxWidth: '100%', borderRadius: '8px' }}
      />
    </div>
  );
}

export default MinerGraph;
