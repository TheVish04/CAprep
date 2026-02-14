import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import apiUtils from '../utils/apiUtils';
import NotificationsDropdown from './NotificationsDropdown';
import './Navbar.css';

const Navbar = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNavDropdownOpen, setIsNavDropdownOpen] = useState(false);
  const navDropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (navDropdownRef.current && !navDropdownRef.current.contains(e.target)) {
        setIsNavDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);



  useEffect(() => {
    const token = apiUtils.getAuthToken();
    if (token) {
      setIsLoggedIn(true);
      try {
        // Safely decode JWT token
        const parts = token.split('.');
        if (parts.length !== 3) {
          throw new Error('Invalid token format');
        }
        const payload = JSON.parse(atob(parts[1]));
        setIsAdmin(payload.role === 'admin');
      } catch (error) {
        console.error('Error decoding token:', error);
        apiUtils.clearAuthToken();
        setIsLoggedIn(false);
        setIsAdmin(false);
      }
    } else {
      setIsLoggedIn(false);
      setIsAdmin(false);
    }
  }, [location]);

  const handleLogout = () => {
    apiUtils.clearAuthToken();
    setIsLoggedIn(false);
    setIsAdmin(false);
    navigate('/login'); // Navigate to login after logout
    setIsMenuOpen(false); // Close menu on logout
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };



  return (
    <motion.nav 
      className="navbar"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, type: 'spring', stiffness: 120 }}
    >
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <motion.span 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            CAprep
          </motion.span>
        </Link>

        <div className="menu-icon" onClick={toggleMenu}>
          <div className={`hamburger ${isMenuOpen ? 'active' : ''}`}>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>

        <motion.ul 
          className={`nav-menu ${isMenuOpen ? 'active' : ''}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {/* Desktop: single "Menu" dropdown for all page links */}
          <li className="nav-dropdown-wrap" ref={navDropdownRef}>
            <button
              type="button"
              className="nav-dropdown-trigger"
              onClick={() => setIsNavDropdownOpen(!isNavDropdownOpen)}
              aria-expanded={isNavDropdownOpen}
              aria-haspopup="true"
            >
              Menu
              <svg className={`nav-dropdown-chevron ${isNavDropdownOpen ? 'open' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            <ul className={`nav-dropdown-menu ${isNavDropdownOpen ? 'open' : ''}`}>
              <li><Link to="/" className="nav-dropdown-link" onClick={() => { setIsNavDropdownOpen(false); setIsMenuOpen(false); }}>Home</Link></li>
              <li><Link to="/about" className="nav-dropdown-link" onClick={() => { setIsNavDropdownOpen(false); setIsMenuOpen(false); }}>About</Link></li>
              <li><Link to="/contactus" className="nav-dropdown-link" onClick={() => { setIsNavDropdownOpen(false); setIsMenuOpen(false); }}>Contact Us</Link></li>
              {isLoggedIn && (
                <>
                  <li><Link to="/questions" className="nav-dropdown-link" onClick={() => { setIsNavDropdownOpen(false); setIsMenuOpen(false); }}>Questions</Link></li>
                  <li><Link to="/quiz" className="nav-dropdown-link" onClick={() => { setIsNavDropdownOpen(false); setIsMenuOpen(false); }}>Quiz</Link></li>
                  <li><Link to="/resources" className="nav-dropdown-link" onClick={() => { setIsNavDropdownOpen(false); setIsMenuOpen(false); }}>Resources</Link></li>
                  <li><Link to="/dashboard" className="nav-dropdown-link" onClick={() => { setIsNavDropdownOpen(false); setIsMenuOpen(false); }}>Dashboard</Link></li>
                  <li><Link to="/profile" className="nav-dropdown-link" onClick={() => { setIsNavDropdownOpen(false); setIsMenuOpen(false); }}>Profile</Link></li>
                  {isAdmin && (
                    <li><Link to="/admin" className="nav-dropdown-link" onClick={() => { setIsNavDropdownOpen(false); setIsMenuOpen(false); }}>Admin</Link></li>
                  )}
                </>
              )}
            </ul>
          </li>

          {isLoggedIn ? (
            <>
              <motion.li className="nav-item notifications-nav-item" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                <NotificationsDropdown />
              </motion.li>
              <motion.li className="nav-item chat-nav-item" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                <Link to="/chat" className="nav-link chat-link" onClick={() => setIsMenuOpen(false)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="12" rx="2" ry="2"></rect>
                    <line x1="2" y1="20" x2="22" y2="20"></line>
                    <line x1="8" y1="12" x2="8" y2="16"></line>
                    <line x1="16" y1="12" x2="16" y2="16"></line>
                    <rect x="8" y="8" width="2" height="2"></rect>
                    <rect x="14" y="8" width="2" height="2"></rect>
                  </svg>
                  Chat
                </Link>
              </motion.li>
              <motion.li whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                <button onClick={handleLogout} className="nav-button logout-btn">Logout</button>
              </motion.li>
            </>
          ) : (
            <>
              <motion.li whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                <Link to="/login" className="nav-link" onClick={() => setIsMenuOpen(false)}>Login</Link>
              </motion.li>
              <motion.li whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                <Link to="/register" className="nav-button register-btn" onClick={() => setIsMenuOpen(false)}>Register</Link>
              </motion.li>
              <motion.li className="nav-item chat-nav-item" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                <Link to="/chat" className="nav-link chat-link" onClick={() => setIsMenuOpen(false)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="12" rx="2" ry="2"></rect>
                    <line x1="2" y1="20" x2="22" y2="20"></line>
                    <line x1="8" y1="12" x2="8" y2="16"></line>
                    <line x1="16" y1="12" x2="16" y2="16"></line>
                    <rect x="8" y="8" width="2" height="2"></rect>
                    <rect x="14" y="8" width="2" height="2"></rect>
                  </svg>
                  Chat
                </Link>
              </motion.li>
            </>
          )}
        </motion.ul>
      </div>
    </motion.nav>
  );
};

export default Navbar;
