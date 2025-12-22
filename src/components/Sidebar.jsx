import React from 'react';
import { NavLink } from 'react-router-dom';
import { FaChartLine, FaHammer, FaTrophy } from 'react-icons/fa';
import '../App.css';

const Sidebar = () => {
  const navItems = [
    { to: '/performance', icon: FaChartLine, label: 'Performance', disabled: false },
    { to: '/benchmarks_mech0', icon: FaTrophy, label: 'Benchmarks M0', disabled: false },
    { to: '/benchmarks_mech1', icon: FaTrophy, label: 'Benchmarks M1', disabled: false },
    { to: '/miner', icon: FaHammer, label: 'Miner', disabled: true },
  ];

  return (
    <nav className="nav-bar">
      <div className="logo-container">
        <a 
          href="https://www.dstrbtd.ai/" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="logo-link"
        >
          <div className="logo-wrapper">
            <img
              src="/dstrbdt_logo.png"
              alt="Dstrbdt Logo"
              className="logo-image"
            />
          </div>
        </a>
      </div>

      <div className="nav-icons-container">
        {navItems.map(({ to, icon: Icon, label, disabled }, index) => (
          <div className="tooltip" key={to} style={{ position: 'relative' }}>
            {disabled ? (
              <div className="nav-icon disabled" style={{ cursor: 'default', position: 'relative' }}>
                <Icon size={24} />
                {(to === '/benchmarks_mech0' || to === '/benchmarks_mech1') && (
                  <span className="icon-number">
                    {to === '/benchmarks_mech0' ? 0 : 1}
                  </span>
                )}
              </div>
            ) : (
              <NavLink
                to={to}
                className={({ isActive }) =>
                  isActive ? 'nav-icon active' : 'nav-icon'
                }
                style={{ position: 'relative' }}
              >
                <Icon size={24} />
                {(to === '/benchmarks_mech0' || to === '/benchmarks_mech1') && (
                  <span className="icon-number">
                    {to === '/benchmarks_mech0' ? 0 : 1}
                  </span>
                )}
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
