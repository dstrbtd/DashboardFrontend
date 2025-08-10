import React from 'react';
import { NavLink } from 'react-router-dom';
import { FaChartLine, FaHammer, FaTrophy } from 'react-icons/fa';
import '../App.css';

const Sidebar = () => {
  const navItems = [
    { to: '/performance', icon: FaChartLine, label: 'Performance', disabled: false },
    { to: '/benchmarks', icon: FaTrophy, label: 'Benchmarks', disabled: true },
    { to: '/miner', icon: FaHammer, label: 'Miner', disabled: true },
  ];

  return (
    <nav className="nav-bar">
      <div className="logo-container">
        <a 
          href="https://www.dstrbtd.ai/" 
          target="_blank" 
          rel="noopener noreferrer" 
          style={{ display: 'inline-block' }}
        >
          <img
            src="/dstrbdt_logo.png"
            alt="Dstrbdt Logo"
            style={{ 
              width: 60, 
              height: 60,
              borderRadius: '50%',
              cursor: 'pointer',
            }}
          />
        </a>
      </div>

      <div className="nav-icons-container">
        {navItems.map(({ to, icon: Icon, label, disabled }) => (
          <div className="tooltip" key={to}>
            {disabled ? (
              <div className="nav-icon disabled" style={{ cursor: 'default' }}>
                <Icon size={32} />
              </div>
            ) : (
              <NavLink
                to={to}
                className={({ isActive }) =>
                  isActive ? 'nav-icon active' : 'nav-icon'
                }
              >
                <Icon size={32} />
              </NavLink>
            )}
            <span className="tooltip-text">{disabled ? 'Coming soon' : label}</span>
          </div>
        ))}
      </div>
    </nav>
  );
};

export default Sidebar;
