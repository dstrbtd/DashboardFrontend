import React from 'react';
import InvestorGraphLoss from '../components/InvestorGraphLoss';
import InvestorGraphPerplexity from '../components/InvestorGraphPerplexity';
import InvestorGraphPeers from '../components/InvestorGraphPeers';
import InvestorGraphLR from '../components/InvestorGraphLR';
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
