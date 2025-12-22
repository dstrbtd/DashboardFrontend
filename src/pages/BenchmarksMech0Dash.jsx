import React from 'react';
import '../App.css';

const BenchmarksDashboard = () => {
  return (
    <div className="app-container investor-dashboard-container benchmarks-container">
      <h1 className="heading-3" style={{ marginBottom: '1rem', width: '100%' }}>
        Mechanism 0 Miner Scores
      </h1>

      <iframe
        src="https://ngrok-dash0.dstrbtd.ai"
        title="Validator Dashboard Mech 0"
        className="benchmarks-iframe"
      />
    </div>
  );
};

export default BenchmarksDashboard;
