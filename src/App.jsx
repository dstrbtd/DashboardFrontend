import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MinerDashboard from './pages/MinerDashboard';
import PerformanceDashboard from './pages/PerformanceDashboard';
import BenchmarksDashboard from './pages/BenchmarksDashboard';
import Sidebar from './components/Sidebar';

function App() {
  return (
    <Router>
      <div className="page-layout">
        <Sidebar />
        <Routes>
          <Route path="/" element={<Navigate to="/performance" replace />} />
          <Route path="/performance" element={<PerformanceDashboard />} />   
          <Route path="/benchmarks" element={<BenchmarksDashboard />} />                 
          <Route path="/miner" element={<MinerDashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
