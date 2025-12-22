import React from 'react';
import '../App.css';

const BenchmarksDashboard = () => {
  return (
    <div className="app-container investor-dashboard-container benchmarks-container">
      <h1 className="heading-3" style={{ marginBottom: '1rem', width: '100%' }}>
        Mechanism 1 Miner Scores
      </h1>

      <iframe
        src="https://ngrok-dash1.dstrbtd.ai"
        title="Validator Dashboard Mech 1"
        className="benchmarks-iframe"
      />
    </div>
  );
};

export default BenchmarksDashboard;
