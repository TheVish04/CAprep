import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import './Navbar.css';

const Navbar = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();



  useEffect(() => {
    const token = localStorage.getItem('token');
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
        localStorage.removeItem('token'); // Clear invalid token
        setIsLoggedIn(false);
        setIsAdmin(false);
      }
    } else {
      setIsLoggedIn(false);
      setIsAdmin(false);
    }
  }, [location]);

  const handleLogout = () => {
    localStorage.removeItem('token');
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
          <motion.li 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link to="/" className="nav-link" onClick={() => setIsMenuOpen(false)}>
              Home
            </Link>
          </motion.li>
          
          <motion.li 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link to="/about" className="nav-link" onClick={() => setIsMenuOpen(false)}>
              About
            </Link>
          </motion.li>
          
          <motion.li 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link to="/contactus" className="nav-link" onClick={() => setIsMenuOpen(false)}>
              Contact Us
            </Link>
          </motion.li>
          
          {isLoggedIn ? (
            <>
              <motion.li 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link to="/questions" className="nav-link" onClick={() => setIsMenuOpen(false)}>
                  Questions
                </Link>
              </motion.li>
              
              <motion.li 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link to="/quiz" className="nav-link" onClick={() => setIsMenuOpen(false)}>
                  Quiz
                </Link>
              </motion.li>
              
              <motion.li 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link to="/resources" className="nav-link" onClick={() => setIsMenuOpen(false)}>
                  Resources
                </Link>
              </motion.li>
              
              <motion.li 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link to="/dashboard" className="nav-link" onClick={() => setIsMenuOpen(false)}>
                  Dashboard
                </Link>
              </motion.li>
              
              <motion.li 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link to="/profile" className="nav-link" onClick={() => setIsMenuOpen(false)}>
                  Profile
                </Link>
              </motion.li>
              
              {isAdmin && (
                <motion.li 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Link to="/admin" className="nav-link" onClick={() => setIsMenuOpen(false)}>
                    Admin
                  </Link>
                </motion.li>
              )}
              
              <motion.li 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="nav-item chat-nav-item"
              >
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
              
              <motion.li 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <button onClick={handleLogout} className="nav-button logout-btn">
                  Logout
                </button>
              </motion.li>
            </>
          ) : (
            <>
              <motion.li 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link to="/login" className="nav-link" onClick={() => setIsMenuOpen(false)}>
                  Login
                </Link>
              </motion.li>

              <motion.li 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link to="/register" className="nav-button register-btn" onClick={() => setIsMenuOpen(false)}>
                  Register
                </Link>
              </motion.li>



              <motion.li 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="nav-item chat-nav-item"
              >
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
