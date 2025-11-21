import React from 'react';
import '../App.css';

const BenchmarksDashboard = () => {
  return (
    <div
      className="app-container"
      style={{
        height: '100vh',
        width: 'calc(100% - 80px)', // account for sidebar
        marginLeft: '80px',         // same offset as investor dashboard
        padding: 0,
      }}
    >
      <h1
        className="heading-3"
        style={{
          marginBottom: '1rem',
          width: '100%',
        }}>
        Mechanism 1 Miner Scores
      </h1>

      <iframe
        src="https://ngrok-dash1.dstrbtd.ai"
        title="Validator Dashboard Mech 1"
        style={{
          border: 'none',
          width: '100%',
          height: '100%',
          minHeight: '500px',
        }}
      />
    </div>
  );
};

export default BenchmarksDashboard;
