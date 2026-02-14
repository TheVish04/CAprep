import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../utils/axiosConfig';
import apiUtils from '../utils/apiUtils';
import NotificationsDropdown from './NotificationsDropdown';
import ProfilePlaceholder from './ProfilePlaceholder';
import './Navbar.css';

const defaultAvatar = 'https://res.cloudinary.com/demo/image/upload/v1/samples/default-avatar.png';

const hasCustomProfileImage = (url) => url && url !== defaultAvatar;

const Navbar = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profilePicture, setProfilePicture] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [studyDropdownOpen, setStudyDropdownOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const studyDropdownRef = useRef(null);
  const profileDropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (studyDropdownRef.current && !studyDropdownRef.current.contains(e.target)) {
        setStudyDropdownOpen(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target)) {
        setProfileDropdownOpen(false);
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
        const parts = token.split('.');
        if (parts.length !== 3) throw new Error('Invalid token format');
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
      setProfilePicture(null);
    }
  }, [location]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const fetchProfilePicture = async () => {
      try {
        const res = await api.get('/users/me');
        if (res.data?.profilePicture) setProfilePicture(res.data.profilePicture);
      } catch {
        setProfilePicture(null);
      }
    };
    fetchProfilePicture();
  }, [isLoggedIn, location]);

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
                className="nav-item nav-dropdown-wrapper"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div ref={studyDropdownRef} className="nav-dropdown-inner">
                <button
                  type="button"
                  className={`nav-link nav-dropdown-trigger ${studyDropdownOpen ? 'open' : ''}`}
                  onClick={() => setStudyDropdownOpen(!studyDropdownOpen)}
                  aria-expanded={studyDropdownOpen}
                  aria-haspopup="true"
                >
                  Study
                  <svg className="nav-dropdown-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {studyDropdownOpen && (
                  <ul className="nav-dropdown-menu" role="menu">
                    <li role="none">
                      <Link to="/questions" className="nav-dropdown-item" onClick={() => { setStudyDropdownOpen(false); setIsMenuOpen(false); }} role="menuitem">
                        Questions
                      </Link>
                    </li>
                    <li role="none">
                      <Link to="/quiz" className="nav-dropdown-item" onClick={() => { setStudyDropdownOpen(false); setIsMenuOpen(false); }} role="menuitem">
                        Quiz
                      </Link>
                    </li>
                    <li role="none">
                      <Link to="/resources" className="nav-dropdown-item" onClick={() => { setStudyDropdownOpen(false); setIsMenuOpen(false); }} role="menuitem">
                        Resources
                      </Link>
                    </li>
                  </ul>
                )}
                </div>
              </motion.li>

              {!isAdmin && (
                <motion.li 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Link to="/dashboard" className="nav-link" onClick={() => setIsMenuOpen(false)}>
                    Dashboard
                  </Link>
                </motion.li>
              )}

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
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="nav-item nav-profile-dropdown-wrapper"
              >
                <div ref={profileDropdownRef} className="nav-dropdown-inner">
                  <button
                    type="button"
                    className={`nav-profile-trigger ${profileDropdownOpen ? 'open' : ''}`}
                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                    aria-expanded={profileDropdownOpen}
                    aria-haspopup="true"
                    title="Profile menu"
                  >
                    {hasCustomProfileImage(profilePicture) ? (
                      <img
                        src={profilePicture}
                        alt="Profile"
                        className="nav-profile-avatar"
                      />
                    ) : (
                      <ProfilePlaceholder className="nav-profile-placeholder" />
                    )}
                  </button>
                  {profileDropdownOpen && (
                    <ul className="nav-dropdown-menu nav-profile-dropdown-menu" role="menu">
                      <li role="none">
                        <Link to="/profile" className="nav-dropdown-item" onClick={() => { setProfileDropdownOpen(false); setIsMenuOpen(false); }} role="menuitem">
                          Profile
                        </Link>
                      </li>
                      <li role="none" className="nav-profile-notifications-item">
                        <NotificationsDropdown embedded />
                      </li>
                      <li role="none">
                        <button type="button" className="nav-dropdown-item nav-dropdown-item-button" onClick={() => { setProfileDropdownOpen(false); handleLogout(); }} role="menuitem">
                          Logout
                        </button>
                      </li>
                    </ul>
                  )}
                </div>
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
