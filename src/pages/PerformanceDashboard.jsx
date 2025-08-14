import React from 'react';
import InvestorGraphLoss from '../components/PerformanceGraphLoss';
import InvestorGraphPerplexity from '../components/PerformanceGraphPerplexity';
import InvestorGraphPeers from '../components/PerformanceGraphPeers';
import InvestorGraphLR from '../components/PerformanceGraphLR';
// import '../App.css';
import '../styles/InvestorDashboard.css';

const InvestorDashboard = () => {
  return (
    <div className="app-container investor-dashboard-container">
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
