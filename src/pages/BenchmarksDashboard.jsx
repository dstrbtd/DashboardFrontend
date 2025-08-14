import React from 'react';
import '../App.css';

const BenchmarksDashboard = () => {
  return (
    <div
      className="app-container"
      style={{
        height: '100vh',
        width: '100%',
        padding: 0,
        marginLeft: '700px',
      }}
    >
      <h1
        className="heading-3"
        style={{
          marginBottom: '1rem',
          width: '100%',
        }}>
        Miner Scores
      </h1>

      <iframe
        src="http://127.0.0.1:22178"
        title="Validator Dashboard"
        style={{
          border: 'none',
          width: '500%',
          height: '100%',
          minHeight: '500px',
        }}
      />
    </div>
  );
};

export default BenchmarksDashboard;
