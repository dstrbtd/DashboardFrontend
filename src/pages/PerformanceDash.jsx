import React, { useState, useEffect } from 'react';
import InvestorGraphLoss from '../components/PerformanceGraphLoss';
import InvestorGraphPerplexity from '../components/PerformanceGraphPerplexity';
import InvestorGraphPeers from '../components/PerformanceGraphPeers';
import InvestorGraphLR from '../components/PerformanceGraphLR';
import websocketConfig from '../config/websocketUrls';
import '../styles/PerformanceDashboard.css';

const PerformanceDashboard = () => {
  const [runId, setRunId] = useState('7');
  const [modelSize, setModelSize] = useState('4.0B');
  const [activeMiners, setActiveMiners] = useState('200');
  const [modelName, setModelName] = useState("distributed/llama-4b");

  useEffect(() => {
    const ws = new WebSocket(websocketConfig.WS_URL);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.run_id) setRunId(data.run_id);
        if (data.active_miners) setActiveMiners(data.active_miners);
      } catch (err) {
        console.error('Error parsing WS message:', err);
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };

    return () => ws.close();
  }, []);

  useEffect(() => {
    const fetchActiveMiners = async () => {
      setActiveMiners(125);
    };
    fetchActiveMiners();
  }, []);

  return (
    <div className="performance-dashboard">
      {/* Main Content */}
      <div className="dashboard-content">
        {/* Header */}
        <header className="dashboard-header simple">
          <h1>Training Metrics</h1>
        </header>

        {/* Main Canvas */}
        <div className="main-canvas">
          {/* Info Boxes */}
          <section className="info-section">
            <div className="info-grid">
              <div className="info-card">
                <div className="info-label">Run</div>
                <div className="info-value">{runId}</div>
              </div>
              <div className="info-card">
                <div className="info-label">Model Size</div>
                <div className="info-value">{modelSize}</div>
              </div>
              <div className="info-card">
                <div className="info-label">Active Miners</div>
                <div className="info-value">{activeMiners}</div>
              </div>
              <div className="info-card">
                <div className="info-label">Model</div>
                <div className="info-value">
                  <a
                    href="https://huggingface.co/distributed/llama-4b"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="model-link"
                  >
                    {modelName}
                  </a>
                </div>
              </div>
            </div>
          </section>

          {/* Graphs Section */}
          <section className="graphs-section">
            <div className="graphs-grid">
              <div className="graph-card">
                <InvestorGraphLoss />
              </div>
              <div className="graph-card">
                <InvestorGraphPeers />
              </div>
              <div className="graph-card">
                <InvestorGraphPerplexity />
              </div>
              <div className="graph-card">
                <InvestorGraphLR />
              </div>
            </div>
          </section>
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

export default PerformanceDashboard;
