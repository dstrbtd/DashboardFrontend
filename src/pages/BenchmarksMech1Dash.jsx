import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { HiOutlineFlag, HiOutlineTrendingDown, HiOutlineWifi, HiOutlineLightningBolt } from 'react-icons/hi';
import { RiBarChartLine } from 'react-icons/ri';
import StrategyCard from '../components/StrategyCard';
import '../styles/Mech1Dashboard.css';

// Toggle to show/hide the right metrics panel
const SHOW_METRICS_PANEL = false;

// API endpoint
const API_BASE_URL = import.meta.env.VITE_MECH1_API_URL || 'https://ngrok-dash1.dstrbtd.ai';

const BenchmarksMech1Dashboard = () => {
  const [strategies, setStrategies] = useState([]);
  const [metadata, setMetadata] = useState({});
  const [availableBlocks, setAvailableBlocks] = useState([]);
  const [currentBlock, setCurrentBlock] = useState(null);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Calculate hurdle thresholds from benchmarks
  const hurdles = useMemo(() => {
    const benchmarks = strategies.filter(s => s.is_benchmark);
    if (benchmarks.length === 0) return null;

    const losses = benchmarks.map(b => b.loss).filter(v => v != null);
    const comms = benchmarks.map(b => b.communication).filter(v => v != null);
    const throughputs = benchmarks.map(b => b.throughput).filter(v => v != null);

    return {
      maxLoss: losses.length > 0 ? Math.min(...losses) : null,
      maxCommunication: comms.length > 0 ? Math.min(...comms) : null,
      minThroughput: throughputs.length > 0 ? Math.max(...throughputs) : null,
    };
  }, [strategies]);

  const fetchData = useCallback(async (block = null) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const url = block 
        ? `${API_BASE_URL}/api/mech1/strategies?block=${block}`
        : `${API_BASE_URL}/api/mech1/strategies`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status}`);
      }
      
      const data = await response.json();
      
      setStrategies(data.strategies || []);
      setMetadata(data.metadata || {});
      setAvailableBlocks(data.available_blocks || []);
      setCurrentBlock(data.current_block);
      
      if (selectedBlock === null) {
        setSelectedBlock(data.current_block);
      }
      
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedBlock]);

  useEffect(() => {
    fetchData(selectedBlock);
    const interval = setInterval(() => fetchData(selectedBlock), 15000);
    return () => clearInterval(interval);
  }, [fetchData, selectedBlock]);

  const handleBlockChange = (e) => {
    const block = parseInt(e.target.value, 10);
    setSelectedBlock(block);
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '—';
    return num.toLocaleString();
  };

  // Count miners vs benchmarks
  const minerCount = strategies.filter(s => !s.is_benchmark).length;
  const benchmarkCount = strategies.filter(s => s.is_benchmark).length;

  // Count qualified miners (equal or better passes)
  const qualifiedMiners = useMemo(() => {
    if (!hurdles) return 0;
    return strategies.filter(s => {
      if (s.is_benchmark) return false;
      const passesLoss = hurdles.maxLoss == null || (s.loss != null && s.loss <= hurdles.maxLoss);
      const passesComm = hurdles.maxCommunication == null || (s.communication != null && s.communication <= hurdles.maxCommunication);
      const passesThroughput = hurdles.minThroughput == null || (s.throughput != null && s.throughput >= hurdles.minThroughput);
      return passesLoss && passesComm && passesThroughput;
    }).length;
  }, [strategies, hurdles]);

  // Calculate aggregate metrics for right panel
  const avgScore = strategies.length > 0 
    ? (strategies.reduce((sum, s) => sum + (s.score || 0), 0) / strategies.length).toFixed(4)
    : '—';
  
  const bestLoss = strategies.length > 0
    ? Math.min(...strategies.map(s => s.loss).filter(v => v != null)).toFixed(2)
    : '—';
  
  const bestCommunication = strategies.length > 0
    ? Math.min(...strategies.map(s => s.communication).filter(v => v != null))
    : null;
  
  const bestThroughput = strategies.length > 0
    ? Math.max(...strategies.map(s => s.throughput).filter(v => v != null))
    : null;

  return (
    <div className="mech1-dashboard">
      {/* Main Content */}
      <div className="dashboard-content">
        {/* Header */}
        <header className="dashboard-header simple">
          <h1>Mechanism 1</h1>
          <div className="config-pills">
            <div className="config-pill">
              <span className="pill-label">Dataset</span>
              <span className="pill-value">{metadata.dataset?.toUpperCase() || '—'}</span>
            </div>
            <div className="config-pill">
              <span className="pill-label">Steps</span>
              <span className="pill-value">{metadata.max_steps || '—'}</span>
            </div>
            <div className="config-pill">
              <span className="pill-label">Model</span>
              <span className="pill-value">{metadata.model_size?.toUpperCase() || '—'}</span>
            </div>
            <div className="config-pill">
              <span className="pill-label">Nodes</span>
              <span className="pill-value">{metadata.number_of_nodes || '—'}</span>
            </div>
          </div>
        </header>

        {/* Main Canvas */}
        <div className="main-canvas">
          {/* Hurdle Thresholds */}
          {hurdles && (
            <section className="hurdles-section">
              <div className="hurdles-header">
                <div className="hurdles-title">
                  <span className="title-icon"><HiOutlineFlag /></span>
                  <h2>Hurdle Thresholds</h2>
                </div>
                <div className="qualified-count">
                  <strong>{qualifiedMiners}</strong>/{minerCount} qualified
                </div>
              </div>
              <p className="hurdles-description">
                Miners must beat all benchmark thresholds to qualify for rewards.
              </p>
              <div className="hurdles-grid">
                <div className="hurdle-card">
                  <div className="hurdle-icon"><HiOutlineTrendingDown /></div>
                  <div className="hurdle-info">
                    <div className="hurdle-label">Max Loss</div>
                    <div className="hurdle-value">{hurdles.maxLoss?.toFixed(2) || '—'}</div>
                  </div>
                  <div className="hurdle-direction">↓ lower</div>
                </div>
                <div className="hurdle-card">
                  <div className="hurdle-icon"><HiOutlineWifi /></div>
                  <div className="hurdle-info">
                    <div className="hurdle-label">Max Comm</div>
                    <div className="hurdle-value">{formatNumber(hurdles.maxCommunication)}</div>
                  </div>
                  <div className="hurdle-direction">↓ lower</div>
                </div>
                <div className="hurdle-card">
                  <div className="hurdle-icon"><HiOutlineLightningBolt /></div>
                  <div className="hurdle-info">
                    <div className="hurdle-label">Min Throughput</div>
                    <div className="hurdle-value">{formatNumber(hurdles.minThroughput)}</div>
                  </div>
                  <div className="hurdle-direction">↑ higher</div>
                </div>
              </div>
            </section>
          )}

          {/* Strategies Section */}
          <section className="strategies-section">
            <div className="section-header">
              <div className="section-title-group">
                <div className="section-title">
                  <span className="title-icon"><RiBarChartLine /></span>
                  <h2>Leaderboard</h2>
                </div>
                <div className="strategy-count">
                  <strong>{minerCount}</strong> miners · <strong>{benchmarkCount}</strong> benchmarks
                </div>
              </div>

              <div className="block-selector">
                <label>Block</label>
                <select 
                  value={selectedBlock || ''}
                  onChange={handleBlockChange}
                  className="block-dropdown"
                >
                  {availableBlocks.map(block => (
                    <option key={block} value={block}>
                      {block} {block === currentBlock ? '(latest)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Loading State */}
            {isLoading && strategies.length === 0 && (
              <div className="loading-state">
                <div className="loading-spinner-large" />
                <p>Loading strategies...</p>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="error-state">
                <p>{error}</p>
                <button onClick={() => fetchData(selectedBlock)} className="retry-btn">
                  Retry
                </button>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && strategies.length === 0 && (
              <div className="empty-state">
                <h3>No Strategies</h3>
                <p>Waiting for submissions...</p>
              </div>
            )}

            {/* Strategy Cards Grid */}
            {strategies.length > 0 && (
              <div className="strategies-grid">
                {strategies.map((strategy) => (
                  <StrategyCard 
                    key={`${strategy.hotkey}-${strategy.rank}`}
                    strategy={strategy}
                    hurdles={hurdles}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Panel - Metrics (Toggle SHOW_METRICS_PANEL to enable) */}
        {SHOW_METRICS_PANEL && (
          <aside className="right-panel">
            {/* Best Loss */}
            <div className="metric-panel">
              <div className="panel-header">
                <span className="panel-title">Best Loss</span>
                <span className="panel-value">{bestLoss}</span>
              </div>
              <div className="mini-chart">
                <svg className="chart-svg" viewBox="0 0 200 60" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                    </linearGradient>
                  </defs>
                  <path 
                    className="chart-area" 
                    d="M0,50 L20,45 L40,48 L60,35 L80,38 L100,28 L120,25 L140,22 L160,18 L180,15 L200,12 L200,60 L0,60 Z" 
                    style={{ fill: 'url(#chartGradient)' }}
                  />
                  <path 
                    className="chart-line" 
                    d="M0,50 L20,45 L40,48 L60,35 L80,38 L100,28 L120,25 L140,22 L160,18 L180,15 L200,12" 
                    style={{ stroke: 'rgba(255,255,255,0.5)' }}
                  />
                </svg>
              </div>
            </div>

            {/* Best Communication */}
            <div className="metric-panel">
              <div className="panel-header">
                <span className="panel-title">Best Communication</span>
                <span className="panel-value">{bestCommunication ? formatNumber(bestCommunication) : '—'}</span>
              </div>
              <div className="mini-chart">
                <svg className="chart-svg" viewBox="0 0 200 60" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartGradient2" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                    </linearGradient>
                  </defs>
                  <path 
                    className="chart-area" 
                    d="M0,45 L25,48 L50,42 L75,38 L100,35 L125,30 L150,25 L175,20 L200,15 L200,60 L0,60 Z" 
                    style={{ fill: 'url(#chartGradient2)' }}
                  />
                  <path 
                    className="chart-line" 
                    d="M0,45 L25,48 L50,42 L75,38 L100,35 L125,30 L150,25 L175,20 L200,15" 
                    style={{ stroke: 'rgba(255,255,255,0.4)' }}
                  />
                </svg>
              </div>
            </div>

            {/* Best Throughput */}
            <div className="metric-panel">
              <div className="panel-header">
                <span className="panel-title">Best Throughput</span>
                <span className="panel-value">{bestThroughput ? formatNumber(bestThroughput) : '—'}</span>
              </div>
              <div className="mini-chart">
                <svg className="chart-svg" viewBox="0 0 200 60" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartGradient3" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                    </linearGradient>
                  </defs>
                  <path 
                    className="chart-area" 
                    d="M0,55 L25,50 L50,52 L75,45 L100,40 L125,35 L150,30 L175,22 L200,18 L200,60 L0,60 Z" 
                    style={{ fill: 'url(#chartGradient3)' }}
                  />
                  <path 
                    className="chart-line" 
                    d="M0,55 L25,50 L50,52 L75,45 L100,40 L125,35 L150,30 L175,22 L200,18" 
                    style={{ stroke: 'rgba(255,255,255,0.4)' }}
                  />
                </svg>
              </div>
            </div>

            {/* Average Score */}
            <div className="metric-panel">
              <div className="panel-header">
                <span className="panel-title">Average Score</span>
                <span className="panel-value">{avgScore}</span>
              </div>
              <div className="mini-chart">
                <svg className="chart-svg" viewBox="0 0 200 60" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartGradient4" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                    </linearGradient>
                  </defs>
                  <path 
                    className="chart-area" 
                    d="M0,55 L25,52 L50,48 L75,42 L100,38 L125,32 L150,28 L175,22 L200,18 L200,60 L0,60 Z" 
                    style={{ fill: 'url(#chartGradient4)' }}
                  />
                  <path 
                    className="chart-line" 
                    d="M0,55 L25,52 L50,48 L75,42 L100,38 L125,32 L150,28 L175,22 L200,18" 
                    style={{ stroke: 'rgba(255,255,255,0.4)' }}
                  />
                </svg>
              </div>
            </div>

            {/* Network Sync Status */}
            <div className="metric-panel">
              <div className="panel-header">
                <span className="panel-title">Network Sync</span>
              </div>
              <div className="status-dial">
                <div className="dial-ring">
                  <svg className="dial-progress" viewBox="0 0 86 86">
                    <circle className="dial-bg" cx="43" cy="43" r="40" />
                    <circle 
                      className="dial-fill" 
                      cx="43" 
                      cy="43" 
                      r="40" 
                      style={{ strokeDashoffset: 26 }}
                    />
                  </svg>
                  <span className="dial-value">90%</span>
                </div>
              </div>
              <div className="dial-label">Last sync: {lastUpdated || '—'}</div>
            </div>

            {/* Active Miners */}
            <div className="metric-panel">
              <div className="panel-header">
                <span className="panel-title">Active Miners</span>
                <span className="panel-value">{minerCount}</span>
              </div>
              <div className="progress-container">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ 
                      width: minerCount > 0 ? `${(qualifiedMiners / minerCount) * 100}%` : '0%',
                      background: 'linear-gradient(90deg, rgba(255,255,255,0.4), rgba(255,255,255,0.6))'
                    }} 
                  />
                </div>
                <div className="progress-labels">
                  <span>{qualifiedMiners} qualified</span>
                  <span>{minerCount - qualifiedMiners} pending</span>
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* Footer */}
        <footer className="dashboard-footer">
          <div className="footer-content">
            <span className="last-updated">Updated: {lastUpdated || '—'}</span>
            <span className="footer-brand">
              <a href="https://bittensor.com" target="_blank" rel="noopener noreferrer">Bittensor</a> · Distributed Training Subnet
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default BenchmarksMech1Dashboard;
