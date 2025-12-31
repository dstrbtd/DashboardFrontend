import React, { useState } from 'react';
import { FaCode, FaExternalLinkAlt, FaChevronDown, FaChevronUp, FaTrophy, FaMedal, FaCopy, FaCheck, FaFileCode } from 'react-icons/fa';
import { HiOutlineFlag } from 'react-icons/hi';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import '../styles/StrategyCard.css';

const StrategyCard = ({ strategy, hurdles }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [codeContent, setCodeContent] = useState(null);
  const [isLoadingCode, setIsLoadingCode] = useState(false);
  const [copied, setCopied] = useState(false);

  const {
    rank,
    hotkey,
    hotkey_short,
    score,
    loss,
    communication,
    throughput,
    gist_url,
    filename,
    last_update,
    is_benchmark
  } = strategy;

  // Calculate hurdle pass/fail for miners (equal or better passes)
  const hurdleStatus = !is_benchmark && hurdles ? {
    loss: hurdles.maxLoss == null || (loss != null && loss <= hurdles.maxLoss),
    communication: hurdles.maxCommunication == null || (communication != null && communication <= hurdles.maxCommunication),
    throughput: hurdles.minThroughput == null || (throughput != null && throughput >= hurdles.minThroughput),
  } : null;

  const isQualified = hurdleStatus ? (hurdleStatus.loss && hurdleStatus.communication && hurdleStatus.throughput) : null;

  const getRankBadge = () => {
    if (rank === 1) return { class: 'gold', icon: <FaTrophy />, label: '1st' };
    if (rank === 2) return { class: 'silver', icon: <FaMedal />, label: '2nd' };
    if (rank === 3) return { class: 'bronze', icon: <FaMedal />, label: '3rd' };
    return { class: 'default', icon: null, label: `#${rank}` };
  };

  const badge = getRankBadge();
  
  // Check if this is a real gist URL (not a benchmark identifier)
  const isRealGist = gist_url && gist_url.startsWith('http');
  
  // Benchmark strategy gist URL mapping
  const getBenchmarkGistUrl = (name) => {
    if (!name) return 'https://gist.github.com/KMFODA';
    
    const nameLower = name.toLowerCase();
    
    // Specific gist mappings for known benchmark strategies
    if (nameLower.includes('sparseloco')) {
      return 'https://gist.github.com/KMFODA/0a5b19e7a33b278864c96e1295f9c742';
    }
    if (nameLower.includes('diloco') && nameLower.includes('2bit')) {
      return 'https://gist.github.com/KMFODA/a35b992a92c4c83d084a4fc8648d1246';
    }
    if (nameLower.includes('diloco')) {
      return 'https://gist.github.com/KMFODA/198d56a0044186aec20a6ab6af09396c';
    }
    if (nameLower.includes('muloco')) {
      return 'https://gist.github.com/KMFODA/d159aba846524cd3f8eb9523bae08685';
    }
    if (nameLower.includes('fedavg') || nameLower.includes('federated')) {
      return 'https://gist.github.com/KMFODA/3d9672d7622b70df97d943198723b9eb';
    }
    if (nameLower.includes('demo')) {
      return 'https://gist.github.com/KMFODA/9e14c87caacd5f5de20446fb911f448e';
    }
    
    // Default fallback to KMFODA's gists page
    return 'https://gist.github.com/KMFODA';
  };
  
  // For benchmarks, get the specific gist URL based on strategy name
  const benchmarkGistUrl = is_benchmark ? getBenchmarkGistUrl(filename) : null;
  const effectiveGistUrl = isRealGist ? gist_url : benchmarkGistUrl;
  
  // Clean up filename for display
  const cleanFilename = (name) => {
    if (!name || typeof name !== 'string') return null;
    
    // Check if this is a generic fallback from the API
    const genericFallbacks = ['strategy.py', 'unknown strategy', 'unknown.py'];
    if (genericFallbacks.includes(name.toLowerCase())) {
      return null;
    }
    
    // Remove file extension
    let clean = name.replace(/\.(py|js|ts)$/, '');
    
    // Remove common prefixes (with or without underscore)
    clean = clean.replace(/^(strategy_|miner_)/i, '');
    
    // Remove hash suffixes (e.g., "_5294c2a6..." or "_80f7fad4...")
    clean = clean.replace(/_[a-f0-9]{6,}.*$/i, '');
    
    // Remove leading hashes (if filename starts with hash like "80f7fad4_something")
    clean = clean.replace(/^[a-f0-9]{6,}_?/i, '');
    
    // Remove trailing hashes without underscore
    clean = clean.replace(/[a-f0-9]{8,}$/i, '');
    
    // Replace underscores with spaces
    clean = clean.replace(/_/g, ' ');
    
    // Trim whitespace
    clean = clean.trim();
    
    // Filter out generic words that aren't meaningful names (only if they're the ONLY word)
    const genericWords = ['strategy', 'miner', 'submission', 'test', 'new'];
    if (genericWords.includes(clean.toLowerCase())) {
      clean = '';
    }
    
    // If nothing meaningful remains, try to extract any non-hash words from original
    if (!clean || clean.length < 2) {
      // Try to find any meaningful word in the original filename
      const words = name.replace(/\.(py|js|ts)$/, '')
                        .split(/[_\-]/)
                        .filter(w => {
                          const wLower = w.toLowerCase();
                          return w.length > 2 && 
                                 !/^[a-f0-9]+$/i.test(w) &&
                                 !genericWords.includes(wLower);
                        });
      if (words.length > 0) {
        clean = words.join(' ');
      } else {
        return null; // Signal that we couldn't extract a name
      }
    }
    
    // Capitalize first letter of each word (handle all-caps like CLRS)
    clean = clean.split(' ')
      .filter(w => w.length > 0)
      .map(word => {
        // If word is all uppercase and short (like acronym), keep it uppercase
        if (word.length <= 5 && word === word.toUpperCase()) {
          return word;
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
    
    return clean || null;
  };
  
  // For miners, use cleaned filename or fall back to hotkey
  const cleanedName = cleanFilename(filename);
  const displayName = is_benchmark 
    ? filename 
    : (cleanedName || `Miner ${hotkey_short || 'Unknown'}`);

  const handleToggleCode = async () => {
    if (!isExpanded && !codeContent && effectiveGistUrl) {
      setIsLoadingCode(true);
      try {
        // Extract gist ID from URL (works for both miners and benchmarks)
        const gistId = effectiveGistUrl.split('/').pop();
        
        // Check if it's a user page (no specific gist ID) vs a specific gist
        if (gistId === 'KMFODA') {
          // Fallback - no specific gist URL, show message
          setCodeContent({ 
            content: '// Benchmark code available at gist.github.com/KMFODA', 
            filename: 'benchmark.py', 
            language: 'python' 
          });
        } else {
          // Fetch specific gist content
          const response = await fetch(`https://api.github.com/gists/${gistId}`);
          if (response.ok) {
            const data = await response.json();
            const files = data.files;
            if (files) {
              const firstFile = Object.values(files)[0];
              setCodeContent({
                content: firstFile.content,
                filename: firstFile.filename,
                language: firstFile.language
              });
            }
          } else {
            setCodeContent({ 
              content: '// Could not load code. Visit the gist directly.', 
              filename: 'error.py', 
              language: 'python' 
            });
          }
        }
      } catch (error) {
        setCodeContent({ content: '// Error loading code', filename: 'error.py', language: 'python' });
      }
      setIsLoadingCode(false);
    }
    setIsExpanded(!isExpanded);
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '—';
    return num.toLocaleString();
  };

  const formatScore = (score) => {
    if (score === null || score === undefined) return '—';
    return score.toFixed(4);
  };

  const formatLoss = (loss) => {
    if (loss === null || loss === undefined) return '—';
    return loss.toFixed(2);
  };

  return (
    <div className={`strategy-card ${badge.class} ${isExpanded ? 'expanded' : ''} ${is_benchmark ? 'benchmark' : 'miner'}`}>
      {/* Glow effect for top 3 */}
      {rank <= 3 && <div className="card-glow" />}
      
      {/* Header */}
      <div className="card-header">
        <div className={`rank-badge ${badge.class}`}>
          {badge.icon || <span className="rank-number">{rank}</span>}
          {badge.icon && <span className="rank-label">{badge.label}</span>}
        </div>
        
        <div className="card-info">
          <div className="strategy-name">
            <span className="file-icon">{is_benchmark ? <HiOutlineFlag /> : <FaFileCode />}</span>
            <span className="filename">{displayName}</span>
          </div>
          {!is_benchmark && (
            <div className="hotkey" title={hotkey}>
              {hotkey_short}
            </div>
          )}
        </div>
        
        {/* Score with status badge above */}
        <div className="score-section">
          {/* Status Badge - above score */}
          {is_benchmark && <div className="status-tag benchmark-tag">BENCHMARK</div>}
          {isQualified === true && <div className="status-tag qualified-tag">QUALIFIED</div>}
          {isQualified === false && <div className="status-tag unqualified-tag">UNQUALIFIED</div>}
          
          <div className="score-container">
            <div className="score-label">SCORE</div>
            <div className="score-value">{formatScore(score)}</div>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="metrics-grid">
        <div className={`metric ${hurdleStatus ? (hurdleStatus.loss ? 'pass' : 'fail') : ''}`}>
          <span className="metric-label">Loss</span>
          <span className="metric-value">{formatLoss(loss)}</span>
        </div>
        <div className={`metric ${hurdleStatus ? (hurdleStatus.communication ? 'pass' : 'fail') : ''}`}>
          <span className="metric-label">Communication</span>
          <span className="metric-value">{formatNumber(communication)}</span>
        </div>
        <div className={`metric ${hurdleStatus ? (hurdleStatus.throughput ? 'pass' : 'fail') : ''}`}>
          <span className="metric-label">Throughput</span>
          <span className="metric-value">{formatNumber(throughput)}</span>
        </div>
      </div>

      {/* Actions - Show for miners with gist URLs and benchmarks */}
      {(isRealGist || is_benchmark) && (
        <div className="card-actions">
          <button 
            className="action-btn primary"
            onClick={handleToggleCode}
          >
            <FaCode />
            <span>{isExpanded ? 'Hide Code' : 'View Code'}</span>
            {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
          </button>
          
          <a 
            href={effectiveGistUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="action-btn secondary"
          >
            <FaExternalLinkAlt />
            <span>Open Gist</span>
          </a>
        </div>
      )}

      {/* Expandable Code Section */}
      {isExpanded && (isRealGist || is_benchmark) && (
        <div className="code-section">
          <div className="code-header">
            <span className="code-filename">
              {codeContent?.filename || filename}
            </span>
            <div className="code-header-actions">
              {codeContent?.language && (
                <span className="code-language">{codeContent.language}</span>
              )}
              {codeContent?.content && (
                <button 
                  className="copy-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(codeContent.content);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? <FaCheck /> : <FaCopy />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              )}
            </div>
          </div>
          <div className="code-content">
            {isLoadingCode ? (
              <div className="code-loading">
                <div className="loading-spinner" />
                <span>Loading code...</span>
              </div>
            ) : codeContent?.content ? (
              <SyntaxHighlighter 
                language="python" 
                style={vscDarkPlus}
                customStyle={{
                  margin: 0,
                  padding: '1.25rem',
                  background: 'transparent',
                  fontSize: '0.8rem',
                  lineHeight: '1.6'
                }}
                showLineNumbers
                lineNumberStyle={{
                  minWidth: '2.5em',
                  paddingRight: '1em',
                  color: 'rgba(255,255,255,0.25)',
                  userSelect: 'none'
                }}
              >
                {codeContent.content}
              </SyntaxHighlighter>
            ) : (
              <pre><code>{'// No code available'}</code></pre>
            )}
          </div>
        </div>
      )}

      {/* Last Update */}
      {last_update && (
        <div className="last-update">
          Last updated: {last_update}
        </div>
      )}
    </div>
  );
};

export default StrategyCard;

