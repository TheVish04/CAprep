import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import { Link } from 'react-router-dom';
import './Content.css';

const ContactUs = () => {
  const [reportData, setReportData] = useState({
    name: '',
    email: '',
    subject: '',
    description: '',
  });
  const [submitStatus, setSubmitStatus] = useState({ type: '', message: '' });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setReportData(prev => ({ ...prev, [name]: value }));
  };

  const handleReportSubmit = (e) => {
    e.preventDefault();
    
    // Validate form
    if (!reportData.name || !reportData.email || !reportData.subject || !reportData.description) {
      setSubmitStatus({ type: 'error', message: 'Please fill out all fields' });
      return;
    }

    // Create mailto link with form data
    const mailtoLink = `mailto:caprep8@gmail.com?subject=${encodeURIComponent(`Issue Report: ${reportData.subject}`)}&body=${encodeURIComponent(
      `Name: ${reportData.name}\nEmail: ${reportData.email}\n\nDescription:\n${reportData.description}`
    )}`;

    // Open email client
    window.location.href = mailtoLink;
    
    // Reset form and show success message
    setReportData({ name: '', email: '', subject: '', description: '' });
    setSubmitStatus({ type: 'success', message: 'Thank you! Your email client should have opened to send your report.' });
  };

  return (
    <div className="page-wrapper">
      <Navbar />
      <div className="content-container">
        <section className="hero">
          <div className="hero-content">
            <h1>Contact Us</h1>
            <p>We're here to help! Reach out to us with any questions or feedback.</p>
          </div>
        </section>

        <section className="content-section">
          <div className="contact-info">
            <h2>Get in Touch</h2>
            <p>
              Have questions about our platform or need assistance? 
              We're always happy to hear from you.
            </p>
            
            <div className="contact-details">
              <div className="contact-item">
                <h3>Email</h3>
                <p><a href="mailto:caprep8@gmail.com">caprep8@gmail.com</a></p>
              </div>
              
              <div className="contact-item">
                <h3>Phone</h3>
                <p>+91 8591061249</p>
              </div>
              
              <div className="contact-item">
                <h3>Address</h3>
                <p>
                  CAprep<br />
                  Kandivali West<br />
                  Mumbai, Maharashtra 400067<br />
                  India
                </p>
              </div>
            </div>
          </div>
          
          <div className="report-section">
            <h2>Report an Issue</h2>
            <p>
              Found a bug, incorrect information, or have concerns about content? 
              Use the form below to report it directly to our team.
            </p>
            
            {submitStatus.message && (
              <div className={`status-message ${submitStatus.type}`}>
                {submitStatus.message}
              </div>
            )}
            
            <form onSubmit={handleReportSubmit} className="report-form">
              <div className="form-group">
                <label htmlFor="name">Your Name</label>
                <input 
                  type="text" 
                  id="name" 
                  name="name" 
                  value={reportData.name}
                  onChange={handleInputChange}
                  placeholder="Enter your name"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="email">Your Email</label>
                <input 
                  type="email" 
                  id="email" 
                  name="email" 
                  value={reportData.email}
                  onChange={handleInputChange}
                  placeholder="Enter your email"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="subject">Subject</label>
                <input 
                  type="text" 
                  id="subject" 
                  name="subject" 
                  value={reportData.subject}
                  onChange={handleInputChange}
                  placeholder="What is this regarding?"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea 
                  id="description" 
                  name="description" 
                  value={reportData.description}
                  onChange={handleInputChange}
                  placeholder="Please describe the issue in detail. Include any relevant links or information."
                  rows="6"
                  required
                ></textarea>
              </div>
              
              <button type="submit" className="submit-button">
                Submit Report
              </button>
            </form>
          </div>
          
          
          
          
          <div className="support-section">
            <h3>Support Our Mission</h3>
            <p>
              If you find our platform helpful, consider supporting us with a small donation.
              Your contribution helps us continue providing quality resources to CA Aspirants.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ContactUs; 