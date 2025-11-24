import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MinerDash from './pages/MinerDash';
import PerformanceDash from './pages/PerformanceDash';
import BenchmarksMech0Dash from './pages/BenchmarksMech0Dash';
import BenchmarksMech1Dash from './pages/BenchmarksMech1Dash'; 
import Sidebar from './components/Sidebar';

function App() {
  return (
    <Router>
      <div className="page-layout">
        <Sidebar />
        <Routes>
          <Route path="/" element={<Navigate to="/performance" replace />} />

          <Route path="/performance" element={<PerformanceDash />} />

          {/* mech0 (original) */}
          <Route path="/benchmarks_mech0" element={<BenchmarksMech0Dash />} />

          {/* mech1 (new) */}
          <Route path="/benchmarks_mech1" element={<BenchmarksMech1Dash />} />

          <Route path="/miner" element={<MinerDash />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
