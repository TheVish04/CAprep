import React, { useState, useEffect } from 'react';
import Navbar from '../components/layout/Navbar';
import apiUtils from '../utils/apiUtils';
import './Content.css';

const ContactUs = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [reportData, setReportData] = useState({
    subject: '',
    description: '',
  });
  const [featureData, setFeatureData] = useState({
    featureTitle: '',
    category: '',
    description: '',
  });
  const [submitStatus, setSubmitStatus] = useState({ type: '', message: '' });
  const [featureStatus, setFeatureStatus] = useState({ type: '', message: '' });

  useEffect(() => {
    setIsLoggedIn(!!apiUtils.getAuthToken());
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setReportData(prev => ({ ...prev, [name]: value }));
  };

  const handleFeatureChange = (e) => {
    const { name, value } = e.target;
    setFeatureData(prev => ({ ...prev, [name]: value }));
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (!reportData.subject || !reportData.description) {
      setSubmitStatus({ type: 'error', message: 'Please fill out all fields' });
      return;
    }
    setSubmitStatus({ type: '', message: '' });
    const token = apiUtils.getAuthToken();
    if (!token) {
      setSubmitStatus({ type: 'error', message: 'Please log in to submit.' });
      return;
    }
    try {
      const baseUrl = apiUtils.getApiBaseUrl();
      const res = await fetch(`${baseUrl}/contact/issue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ subject: reportData.subject, description: reportData.description }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setReportData({ subject: '', description: '' });
        setSubmitStatus({ type: 'success', message: 'Thank you! Your issue report has been submitted.' });
      } else {
        setSubmitStatus({ type: 'error', message: data.error || data.message || 'Failed to submit. Please try again.' });
      }
    } catch (err) {
      setSubmitStatus({ type: 'error', message: 'Unable to submit. Please check your connection and try again.' });
    }
  };

  const handleFeatureSubmit = async (e) => {
    e.preventDefault();
    if (!featureData.featureTitle || !featureData.description) {
      setFeatureStatus({ type: 'error', message: 'Please fill in feature title and description.' });
      return;
    }
    setFeatureStatus({ type: '', message: '' });
    const token = apiUtils.getAuthToken();
    if (!token) {
      setFeatureStatus({ type: 'error', message: 'Please log in to submit.' });
      return;
    }
    try {
      const baseUrl = apiUtils.getApiBaseUrl();
      const res = await fetch(`${baseUrl}/contact/feature`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          featureTitle: featureData.featureTitle,
          category: featureData.category,
          description: featureData.description,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setFeatureData({ featureTitle: '', category: '', description: '' });
        setFeatureStatus({ type: 'success', message: 'Thank you! Your feature request has been submitted.' });
      } else {
        setFeatureStatus({ type: 'error', message: data.error || data.message || 'Failed to submit. Please try again.' });
      }
    } catch (err) {
      setFeatureStatus({ type: 'error', message: 'Unable to submit. Please check your connection and try again.' });
    }
  };

  return (
    <div className="page-wrapper">
      <Navbar />
      <div className="content-container">
        <section className="content-page-hero">
          <div className="content-page-hero-content">
            <h1>Contact Us</h1>
            <p>We're here to help! Reach out to us with any questions or feedback.</p>
          </div>
        </section>

        <section className="content-section">
          <div className="contact-info">
            <h2>Get in Touch</h2>
            <p>
              Have questions about our platform or need assistance?
              We're always happy to hear from you. Our team is dedicated to providing
              the best support to help you succeed in your CA journey.
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

            {!isLoggedIn && (
              <div className="login-warning">
                Please Note: You must be logged in to submit this form.
              </div>
            )}

            {isLoggedIn && (
              <>
                {submitStatus.message && (
                  <div className={`status-message ${submitStatus.type}`}>
                    {submitStatus.message}
                  </div>
                )}
                <form onSubmit={handleReportSubmit} className="report-form">
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
              </>
            )}
          </div>

          <div className="feature-request-section">
            <h2>Request a Feature</h2>
            <p>
              Have an idea to make CAprep better? Tell us what you&apos;d like to see—new tools,
              improvements to quizzes, resources, or anything else. We read every suggestion.
            </p>

            {!isLoggedIn && (
              <div className="login-warning">
                Please Note: You must be logged in to submit this form.
              </div>
            )}

            {isLoggedIn && (
              <>
                {featureStatus.message && (
                  <div className={`status-message ${featureStatus.type}`}>
                    {featureStatus.message}
                  </div>
                )}
                <form onSubmit={handleFeatureSubmit} className="report-form feature-request-form">
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
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ContactUs; 