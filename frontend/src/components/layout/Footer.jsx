import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="main-footer">
      <div className="footer-content">
        <div className="footer-brand">
          <img src="/logo.png" alt="CAprep Logo" style={{ height: '100px', marginBottom: '10px' }} />
          <p>Your companion for CA exam success</p>
        </div>
        <div className="footer-links">
          <div className="footer-column">
            <h4>Quick Links</h4>
            <ul>
              <li><Link to="/">Home</Link></li>
              <li><Link to="/about">About Us</Link></li>
              <li><Link to="/contactus">Contact Us</Link></li>
            </ul>
          </div>
          <div className="footer-column">
            <h4>Contact Us</h4>
            <ul className="contact-info">
              <li>Email: <a href="mailto:caprep8@gmail.com">caprep8@gmail.com</a></li>
              <li>Phone: +91 8591061249</li>
            </ul>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} CAprep. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer; 