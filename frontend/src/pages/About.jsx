import React from 'react';
import Navbar from '../components/layout/Navbar';
import { Link } from 'react-router-dom';
import './Content.css';

const About = () => {
  return (
    <div className="page-wrapper">
      <Navbar />
      <div className="content-container">
        <section className="content-page-hero">
          <div className="content-page-hero-content">
            <h1>About Us</h1>
            <p>Learn more about our mission to support CA Aspirants in their exam preparation journey.</p>
          </div>
        </section>

        <section className="content-section">
          <h2>Our Mission</h2>
          <p>
            At CAprep, we are dedicated to providing high-quality resources and tools
            to help Chartered Accountancy aspirants prepare effectively for their exams.
            Our platform offers a comprehensive collection of past question papers, organized
            by subject, exam type, and year to facilitate focused study.
          </p>

          <h2>Our Story</h2>
          <p>
            Founded by a team of CA professionals and technology experts, our platform
            was born from the recognition that aspirants needed better access to organized
            study materials. We understand the challenges of CA exam preparation and have
            designed our platform to address these specific needs.
          </p>

          <h2>What We Offer</h2>
          <ul>
            <li>Comprehensive database of past question papers</li>
            <li>Organized content by subject, exam type, and year</li>
            <li>User-friendly interface for easy navigation</li>
            <li>Regular updates with the latest exam papers</li>
            <li>Secure and reliable platform for your study needs</li>
          </ul>

          <div className="support-section">
            <h2>Support Our Work</h2>
            <p>
              We are committed to keeping our platform accessible to all CA Aspirants. Your feedback
              and engagement help us maintain and improve our services. Share your experience and
              suggestions via the Contact Us page if you find our platform valuable.
            </p>
          </div>

          <h2>Our Vision</h2>
          <p>
            We envision a world where every CA aspirant has equal access to the best resources,
            regardless of their location or background. By leveraging technology, we aim to
            simplify the complex journey of becoming a Chartered Accountant.
          </p>

          <h2>Why Choose CAprep?</h2>
          <ul>
            <li><strong>Curated Content:</strong> Materials handpicked by experts.</li>
            <li><strong>Community Driven:</strong> Built on feedback from real aspirants.</li>
            <li><strong>Always Up-to-Date:</strong> Content refreshed with every exam cycle.</li>
          </ul>
        </section>
      </div>
    </div>
  );
};

export default About;