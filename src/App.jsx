import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MinerDashboard from './pages/MinerDashboard';
import InvestorDashboard from './pages/InvestorDashboard';
import BenchmarksDashboard from './pages/BenchmarksDashboard';
import Sidebar from './components/Sidebar';

function App() {
  return (
    <Router>
      <div className="page-layout">
        <Sidebar />
        <Routes>
          <Route path="/" element={<Navigate to="/investor" replace />} />
          <Route path="/miner" element={<MinerDashboard />} />
          <Route path="/investor" element={<InvestorDashboard />} />
          <Route path="/benchmarks" element={<BenchmarksDashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
