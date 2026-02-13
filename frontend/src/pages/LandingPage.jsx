import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import AOS from 'aos';
import 'aos/dist/aos.css';
import './LandingPage.css';
import Navbar from '../components/Navbar';
import CountUp from 'react-countup';

const LandingPage = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [resourceCount, setResourceCount] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    AOS.init({
      duration: 1000,
      once: false,
      disable: 'mobile',
    });
    
    // Scroll to top on component mount
    window.scrollTo({
      top: 0,
      behavior: 'auto',
    });
    
    // Show elements after a small delay for better animation effect
    setTimeout(() => setIsVisible(true), 100);
    
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (token) {
      try {
        // Validate token format
        const parts = token.split('.');
        if (parts.length === 3) {
          setIsLoggedIn(true);
          // Remove the auto-redirect for logged-in users
          // setShouldRedirect(true); // Redirect logged-in users to dashboard
        } else {
          localStorage.removeItem('token'); // Clear invalid token
        }
      } catch (error) {
        console.error('Error checking token:', error);
        localStorage.removeItem('token'); // Clear invalid token
      }
    }
    
    // Fetch question count from the backend
    const fetchQuestionCount = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/questions/count`);
        if (!response.ok) {
          throw new Error('Failed to fetch question count');
        }
        const data = await response.json();
        setQuestionCount(data.count);
      } catch (error) {
        console.error('Error fetching question count:', error);
        // Set a fallback value if fetch fails
        setQuestionCount(1000);
      }
    };
    
    // Fetch resource count from the backend
    const fetchResourceCount = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/resources/count`);
        if (!response.ok) {
          throw new Error('Failed to fetch resource count');
        }
        const data = await response.json();
        setResourceCount(data.count);
      } catch (error) {
        console.error('Error fetching resource count:', error);
        // Set a fallback value if fetch fails
        setResourceCount(3);
      }
    };
    
    fetchQuestionCount();
    fetchResourceCount();
    AOS.refresh();
  }, []);

  return (
    <div className={`landing-page ${isVisible ? 'visible' : ''}`}>
      <Navbar />
      
      <section className="hero">
        <div className="hero-overlay"></div>
        <div className="hero-content" data-aos="fade-up">
          <h1>Master Your CA Journey</h1>
          <p>Access organized question papers, practice strategically, and excel in your CA examinations with our comprehensive preparation platform.</p>
          <div className="cta-buttons">
            {!isLoggedIn && (
              <Link to="/register" className="cta-btn primary-btn">Get Started</Link>
            )}
            <Link to="/about" className="cta-btn secondary-btn">Learn More</Link>
          </div>
          <div className="hero-stats">
            <div className="stat-item">
              <span className="stat-number">
                <CountUp 
                  end={questionCount} 
                  duration={2.5} 
                  separator="," 
                  enableScrollSpy
                />
              </span>
              <span className="stat-label">QUESTIONS</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">
                <CountUp 
                  end={resourceCount} 
                  duration={2.5} 
                  separator="," 
                  enableScrollSpy
                />
              </span>
              <span className="stat-label">RESOURCES</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">24/7</span>
              <span className="stat-label">ACCESS</span>
            </div>
          </div>
        </div>
      </section>

      <section className="exam-levels" data-aos="fade-up">
        <h2>Comprehensive Coverage for All CA Levels</h2>
        <div className="level-cards">
          <div className="level-card" data-aos="fade-up" data-aos-delay="100">
            <div className="level-icon foundation-icon">
              <i className="fas fa-building"></i>
            </div>
            <h3>Foundation</h3>
            <ul>
              <li><Link to={isLoggedIn ? "/questions?examStage=Foundation&subject=Accounting" : "/login"}>Accounting</Link></li>
              <li><Link to={isLoggedIn ? "/questions?examStage=Foundation&subject=Business Laws" : "/login"}>Business Laws</Link></li>
              <li><Link to={isLoggedIn ? "/questions?examStage=Foundation&subject=Quantitative Aptitude" : "/login"}>Quantitative Aptitude</Link></li>
              <li><Link to={isLoggedIn ? "/questions?examStage=Foundation&subject=Business Economics" : "/login"}>Business Economics</Link></li>
            </ul>
            <Link to={isLoggedIn ? "/questions?examStage=Foundation" : "/login"} className="level-btn">Start Learning</Link>
          </div>
          
          <div className="level-card" data-aos="fade-up" data-aos-delay="200">
            <div className="level-icon intermediate-icon">
              <i className="fas fa-chart-line"></i>
            </div>
            <h3>Intermediate</h3>
            <ul>
              <li><Link to={isLoggedIn ? "/questions?examStage=Intermediate&subject=Advanced Accounting" : "/login"}>Advanced Accounting</Link></li>
              <li><Link to={isLoggedIn ? "/questions?examStage=Intermediate&subject=Corporate Laws" : "/login"}>Corporate Laws</Link></li>
              <li><Link to={isLoggedIn ? "/questions?examStage=Intermediate&subject=Cost and Management Accounting" : "/login"}>Cost and Management Accounting</Link></li>
              <li><Link to={isLoggedIn ? "/questions?examStage=Intermediate&subject=Taxation" : "/login"}>Taxation</Link></li>
              <li><Link to={isLoggedIn ? "/questions?examStage=Intermediate&subject=Auditing and Code of Ethics" : "/login"}>Auditing and Code of Ethics</Link></li>
              <li><Link to={isLoggedIn ? "/questions?examStage=Intermediate&subject=Financial and Strategic Management" : "/login"}>Financial and Strategic Management</Link></li>
            </ul>
            <Link to={isLoggedIn ? "/questions?examStage=Intermediate" : "/login"} className="level-btn">Start Learning</Link>
          </div>
          
          <div className="level-card" data-aos="fade-up" data-aos-delay="300">
            <div className="level-icon final-icon">
              <i className="fas fa-award"></i>
            </div>
            <h3>Final</h3>
            <ul>
              <li><Link to={isLoggedIn ? "/questions?examStage=Final&subject=Financial Reporting" : "/login"}>Financial Reporting</Link></li>
              <li><Link to={isLoggedIn ? "/questions?examStage=Final&subject=Advanced Financial Management" : "/login"}>Advanced Financial Management</Link></li>
              <li><Link to={isLoggedIn ? "/questions?examStage=Final&subject=Advanced Auditing" : "/login"}>Advanced Auditing</Link></li>
              <li><Link to={isLoggedIn ? "/questions?examStage=Final&subject=Direct and International Tax Laws" : "/login"}>Direct and International Tax Laws</Link></li>
              <li><Link to={isLoggedIn ? "/questions?examStage=Final&subject=Indirect Tax Laws" : "/login"}>Indirect Tax Laws</Link></li>
              <li><Link to={isLoggedIn ? "/questions?examStage=Final&subject=Integrated Business Solutions" : "/login"}>Integrated Business Solutions</Link></li>
            </ul>
            <Link to={isLoggedIn ? "/questions?examStage=Final" : "/login"} className="level-btn">Start Learning</Link>
          </div>
        </div>
      </section>

      <section className="features" data-aos="fade-up">
        <div className="section-heading">
          <span className="section-subtitle">Our Platform Benefits</span>
          <h2>Why Top CA Aspirants Choose Us</h2>
          <div className="heading-underline"></div>
        </div>
        
        <div className="feature-grid">
          <div className="feature-item" data-aos="fade-up" data-aos-delay="100">
            <div className="feature-icon">
              <i className="fas fa-file-alt animated-icon"></i>
            </div>
            <h3>Extensive Question Bank</h3>
            <p>Access thousands of previous year questions categorized by subject, topic, and difficulty level.</p>
          </div>
          
          <div className="feature-item" data-aos="fade-up" data-aos-delay="150">
            <div className="feature-icon">
              <i className="fas fa-tasks animated-icon"></i>
            </div>
            <h3>Structured Practice</h3>
            <p>Study with MTP, RTP, and PYQS papers organized systematically for effective preparation.</p>
          </div>
          
          <div className="feature-item" data-aos="fade-up" data-aos-delay="200">
            <div className="feature-icon">
              <i className="fas fa-search animated-icon"></i>
            </div>
            <h3>Smart Search</h3>
            <p>Find relevant questions instantly using our advanced filtering and search capabilities.</p>
          </div>
          
          {/* <div className="feature-item" data-aos="fade-up" data-aos-delay="250">
            <div className="feature-icon">
              <i className="fas fa-laptop-code animated-icon"></i>
            </div>
            <h3>Digital Experience</h3>
            <p>Enjoy a seamless, intuitive interface designed specifically for CA exam preparation.</p>
          </div> */}
          
          <div className="feature-item" data-aos="fade-up" data-aos-delay="300">
            <div className="feature-icon">
              <i className="fas fa-file-export animated-icon"></i>
            </div>
            <h3>PDF Resources</h3>
            <p>Access and download study materials and question sets with answers for offline revision.</p>
          </div>
          
          <div className="feature-item" data-aos="fade-up" data-aos-delay="350">
            <div className="feature-icon">
              <i className="fas fa-stopwatch animated-icon"></i>
            </div>
            <h3>Timed Quizzes</h3>
            <p>Set custom time limits from 1-180 minutes to practice under exam-like conditions.</p>
          </div>

          <div className="feature-item" data-aos="fade-up" data-aos-delay="400">
            <div className="feature-icon">
              <i className="fas fa-question-circle animated-icon"></i>
            </div>
            <h3>Adjustable MCQ Count</h3>
            <p>Choose exactly how many questions you want in your quiz, from quick sessions to comprehensive tests.</p>
          </div>
          
          <div className="feature-item" data-aos="fade-up" data-aos-delay="450">
            <div className="feature-icon">
              <i className="fas fa-magic animated-icon"></i>
            </div>
            <h3>Intelligent Subject Selection</h3>
            <p>Our system displays only subjects with available MCQs, showing the exact count for each.</p>
          </div>
          
          <div className="feature-item" data-aos="fade-up" data-aos-delay="500">
            <div className="feature-icon">
              <i className="fas fa-chart-pie animated-icon"></i>
            </div>
            <h3>Performance Analytics</h3>
            <p>Get immediate feedback on quiz performance with detailed score breakdowns and percentages.</p>
          </div>
        </div>
      </section>

      <section className="how-it-works" data-aos="fade-up">
        <div className="section-heading">
          <span className="section-subtitle">Simple Process</span>
          <h2>How CAprep Works</h2>
          <div className="heading-underline"></div>
        </div>
        
        <div className="steps-container">
          <div className="step" data-aos="fade-right" data-aos-delay="100">
            <div className="step-number">1</div>
            <div className="step-content">
              <h3>Create Your Account</h3>
              <p>Sign up for free to access all features of our CA exam preparation platform.</p>
            </div>
          </div>
          
          <div className="step" data-aos="fade-right" data-aos-delay="200">
            <div className="step-number">2</div>
            <div className="step-content">
              <h3>Select Your Level & Subject</h3>
              <p>Choose from Foundation, Intermediate, or Final levels and select your subject of interest.</p>
            </div>
          </div>
          
          <div className="step" data-aos="fade-right" data-aos-delay="300">
            <div className="step-number">3</div>
            <div className="step-content">
              <h3>Practice with Real Questions</h3>
              <p>Study using actual exam papers from previous years, RTPs, and MTPs.</p>
            </div>
          </div>
          
          <div className="step" data-aos="fade-right" data-aos-delay="400">
            <div className="step-number">4</div>
            <div className="step-content">
              <h3>Track Your Progress</h3>
              <p>Monitor your preparation and identify areas that need more attention.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="call-to-action" data-aos="fade-up">
        <div className="cta-content">
          <h2>Ready to Excel in Your CA Exams?</h2>
          <p>Join thousands of successful CA Aspirants who have transformed their exam preparation.</p>
          {!isLoggedIn && (
            <Link to="/register" className="cta-btn primary-btn">Start Your Journey Today</Link>
          )}
        </div>
      </section>

      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <h3>CAprep</h3>
            <p>Your companion for CA exam success</p>
          </div>
          <div className="footer-links">
            <div className="footer-column">
              <h4>Quick Links</h4>
              <ul>
                <li><Link to="/">Home</Link></li>
                <li><Link to="/about">About Us</Link></li>
                <li><Link to="/contactus">Contact Us</Link></li>
                <li><Link to="/questions">Questions</Link></li>
              </ul>
            </div>
            <div className="footer-column">
              <h4>Resources</h4>
              <ul>
                <li><Link to="/register">Register</Link></li>
                <li><Link to="/login">Login</Link></li>
                <li><Link to="/faq">FAQ</Link></li>
              </ul>
            </div>
            <div className="footer-column">
              <h4>Contact Us</h4>
              <ul className="contact-info">
                <li><i className="fas fa-envelope"></i> caprep8@gmail.com</li>
                <li><i className="fas fa-phone"></i> +91 8591061249</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} CAprep. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;