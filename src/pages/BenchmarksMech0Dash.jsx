import React from 'react';
import '../styles/Mech0Dashboard.css';

const BenchmarksMech0Dashboard = () => {
  return (
    <div className="mech0-dashboard">
      {/* Main Content */}
      <div className="dashboard-content">
        {/* Header */}
        <header className="dashboard-header simple">
          <h1>Mechanism 0</h1>
        </header>

        {/* Main Canvas - Iframe */}
        <div className="main-canvas">
          <div className="iframe-container">
            <iframe
              src="https://ngrok-dash0.dstrbtd.ai"
              title="Validator Dashboard Mech 0"
              className="dashboard-iframe"
            />
          </div>
        </div>

        {/* Footer */}
        <footer className="dashboard-footer">
          <div className="footer-content">
            <span className="footer-brand">
              <a href="https://bittensor.com" target="_blank" rel="noopener noreferrer">Bittensor</a> · Distributed Training Subnet
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default BenchmarksMech0Dashboard;
