import React from 'react';
import '../App.css';

const BenchmarksDashboard = () => {
  return (
    <div className="app-container">
      <h1 className="heading-3">Benchmarks</h1>
      <p>This is the Benchmarks page. You can add graphs, tables, or metrics here.</p>

      {/* Example section placeholder */}
      <h2 className="heading-3">Example Metric vs Step</h2>
      <div className="graph-wrapper">
        <div className="graph-placeholder">
          {/* Replace this with your chart component */}
          <p style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>
            Graph placeholder
          </p>
        </div>
      </div>
    </div>
  );
};

export default BenchmarksDashboard;
