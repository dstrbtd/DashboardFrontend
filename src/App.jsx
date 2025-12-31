import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import PerformanceDash from './pages/PerformanceDash';
import BenchmarksMech0Dash from './pages/BenchmarksMech0Dash';
import BenchmarksMech1Dash from './pages/BenchmarksMech1Dash'; 
import './App.css';

function App() {
  return (
    <Router>
      <div className="page-layout no-sidebar">
        <Routes>
          {/* Default redirect to mech1 */}
          <Route path="/" element={<Navigate to="/mech1" replace />} />
          <Route path="/train" element={<PerformanceDash />} />
          <Route path="/mech0" element={<BenchmarksMech0Dash />} />
          <Route path="/mech1" element={<BenchmarksMech1Dash />} />
          <Route path="*" element={<Navigate to="/mech1" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
