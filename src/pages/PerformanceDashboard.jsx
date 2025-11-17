import React, { useState, useEffect } from 'react';
import InvestorGraphLoss from '../components/PerformanceGraphLoss';
import InvestorGraphPerplexity from '../components/PerformanceGraphPerplexity';
import InvestorGraphPeers from '../components/PerformanceGraphPeers';
import InvestorGraphLR from '../components/PerformanceGraphLR';
import websocketConfig from '../config/websocketUrls';
import '../styles/InvestorDashboard.css';

const InvestorDashboard = () => {
  const [runId, setRunId] = useState('7');
  const [modelSize, setModelSize] = useState('4.0B'); // placeholder
  const [activeMiners, setActiveMiners] = useState('200');
  const [modelanme, setModelName] = useState("distributed/llama-4b");

  useEffect(() => {
    // Connect to WebSocket server to get run_id
    const ws = new WebSocket(websocketConfig.WS_URL);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log(data)
        if (data.run_id) setRunId(data.run_id);
        if (data.active_miners) setActiveMiners(data.active_miners);

      } catch (err) {
        console.error('Error parsing WS message in InvestorDashboard:', err);
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket error in InvestorDashboard:', err);
    };

    return () => ws.close();
  }, []);

  // Example: fetch active miners from backend (placeholder)
  useEffect(() => {
    const fetchActiveMiners = async () => {
      // TODO: replace with actual API call to fetch active miners via Bittensor
      setActiveMiners(125);
    };
    fetchActiveMiners();
  }, []);

  return (
    <div className="app-container investor-dashboard-container">
      <h1 className="heading-3" style={{ marginBottom: '1rem', width: '100%' }}>
        Training Metrics
      </h1>

      {/* Info boxes row */}
      <div className="info-boxes-row">
        <div className="info-box">
          <div className="info-label">Run</div>
          <div className="info-value">{runId}</div>
        </div>
        <div className="info-box">
          <div className="info-label">Model Size</div>
          <div className="info-value">{modelSize}</div>
        </div>
        <div className="info-box">
          <div className="info-label">Active Miners</div>
          <div className="info-value">{activeMiners}</div>
        </div>
        <div className="info-box">
          <div className="info-label">Model</div>
          <div className="info-value">
            <a
              href="https://huggingface.co/distributed/llama-4b"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "white",
                textDecoration: "underline",
                fontWeight: "600",
                cursor: "pointer"
              }}
            >
              {modelanme}
            </a>
          </div>
        </div>
      </div>

      {/* Graphs grid */}
      <div className="graphs-grid">
        <div className="graph-item">
          <InvestorGraphPerplexity />
        </div>
        <div className="graph-item">
          <InvestorGraphLoss />
        </div>
        <div className="graph-item">
          <InvestorGraphPeers />
        </div>
        <div className="graph-item">
          <InvestorGraphLR />
        </div>
      </div>
    </div>
  );
};

export default InvestorDashboard;
