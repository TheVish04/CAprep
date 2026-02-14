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
  const [featureData, setFeatureData] = useState({
    name: '',
    email: '',
    featureTitle: '',
    category: '',
    description: '',
  });
  const [submitStatus, setSubmitStatus] = useState({ type: '', message: '' });
  const [featureStatus, setFeatureStatus] = useState({ type: '', message: '' });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setReportData(prev => ({ ...prev, [name]: value }));
  };

  const handleFeatureChange = (e) => {
    const { name, value } = e.target;
    setFeatureData(prev => ({ ...prev, [name]: value }));
  };

  const handleReportSubmit = (e) => {
    e.preventDefault();
    
    if (!reportData.name || !reportData.email || !reportData.subject || !reportData.description) {
      setSubmitStatus({ type: 'error', message: 'Please fill out all fields' });
      return;
    }

    const mailtoLink = `mailto:caprep8@gmail.com?subject=${encodeURIComponent(`Issue Report: ${reportData.subject}`)}&body=${encodeURIComponent(
      `Name: ${reportData.name}\nEmail: ${reportData.email}\n\nDescription:\n${reportData.description}`
    )}`;

    window.location.href = mailtoLink;
    
    setReportData({ name: '', email: '', subject: '', description: '' });
    setSubmitStatus({ type: 'success', message: 'Thank you! Your email client should have opened to send your report.' });
  };

  const handleFeatureSubmit = (e) => {
    e.preventDefault();

    if (!featureData.name || !featureData.email || !featureData.featureTitle || !featureData.description) {
      setFeatureStatus({ type: 'error', message: 'Please fill in name, email, feature title, and description.' });
      return;
    }

    const categoryLine = featureData.category ? `Category: ${featureData.category}\n\n` : '';
    const body = `Name: ${featureData.name}\nEmail: ${featureData.email}\n\n${categoryLine}Feature: ${featureData.featureTitle}\n\nDescription:\n${featureData.description}`;
    const mailtoLink = `mailto:caprep8@gmail.com?subject=${encodeURIComponent(`Feature Request: ${featureData.featureTitle}`)}&body=${encodeURIComponent(body)}`;

    window.location.href = mailtoLink;

    setFeatureData({ name: '', email: '', featureTitle: '', category: '', description: '' });
    setFeatureStatus({ type: 'success', message: 'Thank you! Your email client will open to send your feature request.' });
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

          <div className="feature-request-section">
            <h2>Request a Feature</h2>
            <p>
              Have an idea to make CAprep better? Tell us what you&apos;d like to see—new tools, 
              improvements to quizzes, resources, or anything else. We read every suggestion.
            </p>

            {featureStatus.message && (
              <div className={`status-message ${featureStatus.type}`}>
                {featureStatus.message}
              </div>
            )}

            <form onSubmit={handleFeatureSubmit} className="report-form feature-request-form">
              <div className="form-group">
                <label htmlFor="feature-name">Your Name</label>
                <input
                  type="text"
                  id="feature-name"
                  name="name"
                  value={featureData.name}
                  onChange={handleFeatureChange}
                  placeholder="Enter your name"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="feature-email">Your Email</label>
                <input
                  type="email"
                  id="feature-email"
                  name="email"
                  value={featureData.email}
                  onChange={handleFeatureChange}
                  placeholder="Enter your email"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="featureTitle">Feature / Idea (short title)</label>
                <input
                  type="text"
                  id="featureTitle"
                  name="featureTitle"
                  value={featureData.featureTitle}
                  onChange={handleFeatureChange}
                  placeholder="e.g. Add topic-wise quiz filter"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="feature-category">Category (optional)</label>
                <select
                  id="feature-category"
                  name="category"
                  value={featureData.category}
                  onChange={handleFeatureChange}
                  className="form-select"
                >
                  <option value="">Select area</option>
                  <option value="Quiz">Quiz</option>
                  <option value="Resources">Resources</option>
                  <option value="Questions">Questions</option>
                  <option value="Dashboard">Dashboard</option>
                  <option value="Chat">Chat</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="feature-description">Description</label>
                <textarea
                  id="feature-description"
                  name="description"
                  value={featureData.description}
                  onChange={handleFeatureChange}
                  placeholder="Describe your feature idea and how it would help you."
                  rows="5"
                  required
                />
              </div>
              <button type="submit" className="submit-button">
                Send feature request
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ContactUs; 