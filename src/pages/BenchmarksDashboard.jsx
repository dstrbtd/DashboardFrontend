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
        Miner Scores
      </h1>

      <iframe
        src="https://370b53258dd5.ngrok-free.app"
        title="Validator Dashboard"
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
