import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MinerDash from './pages/MinerDash';
import PerformanceDash from './pages/PerformanceDash';
import BenchmarksMech0Dash from './pages/BenchmarksMech0Dash';
import BenchmarksMech1Dash from './pages/BenchmarksMech1Dash'; 
import Sidebar from './components/Sidebar';
import './App.css';

function App() {
  return (
    <Router>
      <div className="page-layout">
        <Sidebar />
        <Routes>
          <Route path="/" element={<Navigate to="/train" replace />} />

          <Route path="/train" element={<PerformanceDash />} />

          {/* mech0 */}
          <Route path="/mech0" element={<BenchmarksMech0Dash />} />

          {/* mech1 */}
          <Route path="/mech1" element={<BenchmarksMech1Dash />} />

          <Route path="/miner" element={<MinerDash />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
