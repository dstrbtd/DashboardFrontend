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
      <h1 className="heading-3" style={{ marginBottom: '1rem' }}>
        Benchmarks
      </h1>

      <iframe
        src="https://oakland-streets-pollution-constraints.trycloudflare.com"
        title="Validator Dashboard"
        style={{
          border: 'none',
          width: '500%',
          height: '85vh',
          minHeight: '500px',
        }}
      />
    </div>
  );
};

export default BenchmarksDashboard;
