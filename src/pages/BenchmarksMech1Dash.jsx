import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { HiOutlineFlag, HiOutlineTrendingDown, HiOutlineWifi, HiOutlineLightningBolt, HiOutlineClock } from 'react-icons/hi';
import { RiBarChartLine } from 'react-icons/ri';
import StrategyCard from '../components/StrategyCard';
import '../styles/Mech1Dashboard.css';

// Toggle to show/hide the right metrics panel
const SHOW_METRICS_PANEL = false;

// API endpoint
const API_BASE_URL = import.meta.env.VITE_MECH1_API_URL || 'https://ngrok-dash1.dstrbtd.ai';

// Generate SVG path from data points
const generateChartPath = (data, width = 200, height = 50, invert = false) => {
  if (!data || data.length === 0) return { line: '', area: '' };
  
  const values = data.filter(v => v != null);
  if (values.length === 0) return { line: '', area: '' };
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    // Normalize to 0-1, then scale to chart height (with padding)
    let normalized = (v - min) / range;
    if (invert) normalized = 1 - normalized; // For loss/comm, lower is better (higher on chart)
    const y = height - (normalized * (height - 10)) - 5;
    return { x, y };
  });
  
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  
  return { line, area };
};

const BenchmarksMech1Dashboard = () => {
  const [strategies, setStrategies] = useState([]);
  const [metadata, setMetadata] = useState({});
  const [availableBlocks, setAvailableBlocks] = useState([]);
  const [currentBlock, setCurrentBlock] = useState(null);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // Historical metrics state
  const [historyData, setHistoryData] = useState([]);
  const [evalInterval, setEvalInterval] = useState(3500);
  const [nextEvalTime, setNextEvalTime] = useState(null);
  const [secondsRemaining, setSecondsRemaining] = useState(null);

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

  // Fetch historical metrics
  const SECONDS_PER_BLOCK = 12;
  
  const fetchHistory = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/mech1/history`);
      if (response.ok) {
        const data = await response.json();
        setHistoryData(data.history || []);
        setEvalInterval(data.eval_interval || 3500);
        
        // Use timestamp-based countdown if available
        if (data.next_eval_timestamp) {
          const nextEval = new Date(data.next_eval_timestamp);
          setNextEvalTime(nextEval);
          const now = new Date();
          const remaining = Math.max(0, (nextEval - now) / 1000);
          setSecondsRemaining(remaining);
        } else if (data.blocks_until_eval != null) {
          // Fallback to block-based estimate
          setSecondsRemaining(data.blocks_until_eval * SECONDS_PER_BLOCK);
        }
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  }, []);

  useEffect(() => {
    fetchData(selectedBlock);
    fetchHistory();
    const interval = setInterval(() => {
      fetchData(selectedBlock);
      fetchHistory();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchData, fetchHistory, selectedBlock]);
  
  // Real-time countdown timer - ticks every second
  useEffect(() => {
    if (secondsRemaining == null) return;
    
    const timer = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [secondsRemaining != null]); // Start timer when we have initial value

  const handleBlockChange = (e) => {
    const block = parseInt(e.target.value, 10);
    setSelectedBlock(block);
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '—';
    return num.toLocaleString();
  };
  
  // Calculate hurdle Y position for a given value within the data range
  const getHurdleY = (hurdleValue, dataValues, height = 50) => {
    if (hurdleValue == null || !dataValues || dataValues.length === 0) return null;
    const values = dataValues.filter(v => v != null);
    if (values.length === 0) return null;
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    
    // Include hurdle in range calculation for better visualization
    const extendedMin = Math.min(min, hurdleValue);
    const extendedMax = Math.max(max, hurdleValue);
    const extendedRange = extendedMax - extendedMin || 1;
    
    const normalized = (hurdleValue - extendedMin) / extendedRange;
    const y = height - (normalized * (height - 10)) - 5;
    return y;
  };

  // Compute chart paths from historical data
  // No invert for loss/comm - line goes DOWN as values decrease (improvement)
  // Throughput line goes UP as values increase (improvement)
  const lossChartData = useMemo(() => {
    const values = historyData.map(h => h.best_loss).filter(v => v != null);
    const chartPath = generateChartPath(values, 200, 50, false);
    const hurdleY = getHurdleY(hurdles?.maxLoss, values);
    return { ...chartPath, hurdleY };
  }, [historyData, hurdles?.maxLoss]);
  
  const commChartData = useMemo(() => {
    const values = historyData.map(h => h.best_communication).filter(v => v != null);
    const chartPath = generateChartPath(values, 200, 50, false);
    const hurdleY = getHurdleY(hurdles?.maxCommunication, values);
    return { ...chartPath, hurdleY };
  }, [historyData, hurdles?.maxCommunication]);
  
  const throughputChartData = useMemo(() => {
    const values = historyData.map(h => h.best_throughput).filter(v => v != null);
    const chartPath = generateChartPath(values, 200, 50, false);
    const hurdleY = getHurdleY(hurdles?.minThroughput, values);
    return { ...chartPath, hurdleY };
  }, [historyData, hurdles?.minThroughput]);
  
  // Get current best values from history
  const currentBestFromHistory = useMemo(() => {
    if (historyData.length === 0) return { loss: null, communication: null, throughput: null };
    const latest = historyData[historyData.length - 1];
    return {
      loss: latest?.best_loss,
      communication: latest?.best_communication,
      throughput: latest?.best_throughput
    };
  }, [historyData]);
  
  // Format countdown time from seconds remaining
  const countdownDisplay = useMemo(() => {
    if (secondsRemaining == null) return { blocks: '—', time: '—', percent: 0, nextUpdateStr: '—' };
    
    const totalSeconds = Math.max(0, Math.floor(secondsRemaining));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    // Calculate blocks from seconds
    const blocks = Math.ceil(secondsRemaining / SECONDS_PER_BLOCK);
    const totalEvalSeconds = evalInterval * SECONDS_PER_BLOCK;
    const percent = Math.max(0, Math.min(100, ((totalEvalSeconds - secondsRemaining) / totalEvalSeconds) * 100));
    
    // Format time string (countdown)
    let timeStr;
    if (hours > 0) {
      timeStr = `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      timeStr = `${minutes}m ${seconds}s`;
    } else {
      timeStr = `${seconds}s`;
    }
    
    // Format next update time string
    let nextUpdateStr = '—';
    if (nextEvalTime) {
      const evalTime = new Date(nextEvalTime.getTime());
      nextUpdateStr = evalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    return {
      blocks: blocks.toLocaleString(),
      time: timeStr,
      percent,
      nextUpdateStr
    };
  }, [secondsRemaining, evalInterval, nextEvalTime]);

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
          <div className="header-brand">
            <a href="https://www.dstrbtd.ai/" target="_blank" rel="noopener noreferrer" className="logo-link">
              <img src="/dstrbdt_logo.png" alt="Dstrbtd" className="header-logo" />
            </a>
            <h1>Mechanism 1</h1>
          </div>
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
          {/* Performance Metrics Widgets */}
          <section className="metrics-widgets-section">
            <div className="widgets-grid">
              {/* Best Loss Chart */}
              <div className="widget-card">
                <div className="widget-header">
                  <div className="widget-icon"><HiOutlineTrendingDown /></div>
                  <div className="widget-info">
                    <span className="widget-label">Best Loss</span>
                    <span className="widget-value">{currentBestFromHistory.loss?.toFixed(2) || '—'}</span>
                  </div>
                </div>
                <div className="widget-chart">
                  <svg viewBox="0 0 200 50" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="chartGradientMono" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="rgba(255, 255, 255, 0.15)" />
                        <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
                      </linearGradient>
                    </defs>
                    {lossChartData.hurdleY != null && (
                      <line x1="0" y1={lossChartData.hurdleY} x2="200" y2={lossChartData.hurdleY} 
                        stroke="rgba(255, 255, 255, 0.25)" strokeWidth="1" strokeDasharray="4 3" />
                    )}
                    {lossChartData.area && <path d={lossChartData.area} fill="url(#chartGradientMono)" />}
                    {lossChartData.line && <path d={lossChartData.line} fill="none" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="1.5" />}
                  </svg>
                </div>
                <div className="widget-footer">
                  <span className="trend-label">↓ lower is better</span>
                  <span className="data-points">{historyData.length} epochs</span>
                </div>
              </div>

              {/* Best Communication Chart */}
              <div className="widget-card">
                <div className="widget-header">
                  <div className="widget-icon"><HiOutlineWifi /></div>
                  <div className="widget-info">
                    <span className="widget-label">Best Communication</span>
                    <span className="widget-value">{formatNumber(currentBestFromHistory.communication)}</span>
                  </div>
                </div>
                <div className="widget-chart">
                  <svg viewBox="0 0 200 50" preserveAspectRatio="none">
                    {commChartData.hurdleY != null && (
                      <line x1="0" y1={commChartData.hurdleY} x2="200" y2={commChartData.hurdleY} 
                        stroke="rgba(255, 255, 255, 0.25)" strokeWidth="1" strokeDasharray="4 3" />
                    )}
                    {commChartData.area && <path d={commChartData.area} fill="url(#chartGradientMono)" />}
                    {commChartData.line && <path d={commChartData.line} fill="none" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="1.5" />}
                  </svg>
                </div>
                <div className="widget-footer">
                  <span className="trend-label">↓ lower is better</span>
                  <span className="data-points">{historyData.length} epochs</span>
                </div>
              </div>

              {/* Best Throughput Chart */}
              <div className="widget-card">
                <div className="widget-header">
                  <div className="widget-icon"><HiOutlineLightningBolt /></div>
                  <div className="widget-info">
                    <span className="widget-label">Best Throughput</span>
                    <span className="widget-value">{formatNumber(currentBestFromHistory.throughput)}</span>
                  </div>
                </div>
                <div className="widget-chart">
                  <svg viewBox="0 0 200 50" preserveAspectRatio="none">
                    {throughputChartData.hurdleY != null && (
                      <line x1="0" y1={throughputChartData.hurdleY} x2="200" y2={throughputChartData.hurdleY} 
                        stroke="rgba(255, 255, 255, 0.25)" strokeWidth="1" strokeDasharray="4 3" />
                    )}
                    {throughputChartData.area && <path d={throughputChartData.area} fill="url(#chartGradientMono)" />}
                    {throughputChartData.line && <path d={throughputChartData.line} fill="none" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="1.5" />}
                  </svg>
                </div>
                <div className="widget-footer">
                  <span className="trend-label">↑ higher is better</span>
                  <span className="data-points">{historyData.length} epochs</span>
                </div>
              </div>

              {/* Countdown to Next Evaluation */}
              <div className="widget-card countdown-widget">
                <div className="widget-header">
                  <div className="widget-icon"><HiOutlineClock /></div>
                  <div className="widget-info">
                    <span className="widget-label">Next Evaluation</span>
                    <span className="widget-value countdown-value">{countdownDisplay.time}</span>
                  </div>
                </div>
                <div className="countdown-ring-container">
                  <svg className="countdown-ring" viewBox="0 0 100 100">
                    <circle 
                      className="countdown-bg" 
                      cx="50" cy="50" r="42" 
                      fill="none" 
                      stroke="rgba(255,255,255,0.08)" 
                      strokeWidth="6"
                    />
                    <circle 
                      className="countdown-progress" 
                      cx="50" cy="50" r="42" 
                      fill="none" 
                      stroke="rgba(255, 255, 255, 0.5)" 
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 42}`}
                      strokeDashoffset={`${2 * Math.PI * 42 * (1 - countdownDisplay.percent / 100)}`}
                      transform="rotate(-90 50 50)"
                    />
                    <text x="50" y="46" textAnchor="middle" className="countdown-blocks">
                      {countdownDisplay.blocks}
                    </text>
                    <text x="50" y="60" textAnchor="middle" className="countdown-blocks-label">
                      blocks
                    </text>
                  </svg>
                </div>
                <div className="widget-footer countdown-footer">
                  <span className="eval-label">next update: {countdownDisplay.nextUpdateStr}</span>
                </div>
              </div>
            </div>
          </section>

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
                  <div className="hurdle-direction">lower is better</div>
                </div>
                <div className="hurdle-card">
                  <div className="hurdle-icon"><HiOutlineWifi /></div>
                  <div className="hurdle-info">
                    <div className="hurdle-label">Max Comm</div>
                    <div className="hurdle-value">{formatNumber(hurdles.maxCommunication)}</div>
                  </div>
                  <div className="hurdle-direction">lower is better</div>
                </div>
                <div className="hurdle-card">
                  <div className="hurdle-icon"><HiOutlineLightningBolt /></div>
                  <div className="hurdle-info">
                    <div className="hurdle-label">Min Throughput</div>
                    <div className="hurdle-value">{formatNumber(hurdles.minThroughput)}</div>
                  </div>
                  <div className="hurdle-direction">higher is better</div>
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
