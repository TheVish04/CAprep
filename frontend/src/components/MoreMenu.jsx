import React, { useState, useRef, useEffect } from 'react';
import './MoreMenu.css';

// SVG Icons
const DotsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1"></circle>
    <circle cx="12" cy="5" r="1"></circle>
    <circle cx="12" cy="19" r="1"></circle>
  </svg>
);

const DiscussIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
  </svg>
);

const MoreMenu = ({ onDiscuss }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  
  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };
  
  const handleDiscuss = () => {
    setIsOpen(false);
    onDiscuss();
  };
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  return (
    <div className="more-menu-container" ref={menuRef}>
      <button 
        className="more-button" 
        onClick={toggleMenu}
        aria-label="More options"
        title="More options"
      >
        <DotsIcon />
      </button>
      
      {isOpen && (
        <div className="more-menu">
          <button className="menu-item" onClick={handleDiscuss}>
            <DiscussIcon /> Discuss
          </button>
          {/* Add more menu items here as needed */}
        </div>
      )}
    </div>
  );
};

export default MoreMenu; 