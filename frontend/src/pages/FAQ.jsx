import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import './FAQ.css';

const FAQ = () => {
  const [activeSection, setActiveSection] = useState(null);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
    
    // Set the active section based on hash or default to first section
    const hash = window.location.hash;
    if (hash) {
      const section = hash.substring(1);
      setActiveSection(section);
      
      // Scroll to section after a small delay to ensure rendering
      setTimeout(() => {
        const element = document.getElementById(section);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } else {
      setActiveSection('general');
    }
  }, []);

  // Scroll to a specific section
  const scrollToSection = (sectionId) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      
      // Update URL hash without page reload
      window.history.pushState(null, null, `#${sectionId}`);
    }
  };

  return (
    <div className="faq-page">
      <Navbar />

      <div className="faq-container">
        <div className="faq-header">
          <h1>Frequently Asked Questions</h1>
          <p>Find answers to common questions about CAprep</p>
        </div>
        
        <div className="faq-intro">
          <p>Welcome to our comprehensive FAQ section. We've compiled answers to the most common questions about using CAprep to help you get the most out of your CA exam preparation. If you can't find what you're looking for, please don't hesitate to reach out to our support team.</p>
        </div>
        
        <div className="faq-navigation">
          <button 
            className={`faq-nav-button ${activeSection === 'general' ? 'active' : ''}`}
            onClick={() => scrollToSection('general')}
          >
            General
          </button>
          <button 
            className={`faq-nav-button ${activeSection === 'account' ? 'active' : ''}`}
            onClick={() => scrollToSection('account')}
          >
            Account & Registration
          </button>
          <button 
            className={`faq-nav-button ${activeSection === 'practice' ? 'active' : ''}`}
            onClick={() => scrollToSection('practice')}
          >
            Questions & Practice
          </button>
          <button 
            className={`faq-nav-button ${activeSection === 'quiz' ? 'active' : ''}`}
            onClick={() => scrollToSection('quiz')}
          >
            Quizzes & Exams
          </button>
          <button 
            className={`faq-nav-button ${activeSection === 'resources' ? 'active' : ''}`}
            onClick={() => scrollToSection('resources')}
          >
            Resources
          </button>
          <button 
            className={`faq-nav-button ${activeSection === 'technical' ? 'active' : ''}`}
            onClick={() => scrollToSection('technical')}
          >
            Technical Support
          </button>
        </div>

        <div className="faq-content">
          <div id="general" className="faq-category">
            <h2>General Questions</h2>
            
            <div className="faq-item">
              <details>
                <summary>What is CAprep?</summary>
                <div className="faq-answer">
                  <p>CAprep is a comprehensive web application designed specifically for Chartered Accountancy students preparing for their examinations. Our platform offers:</p>
                  <ul>
                    <li>Extensive practice questions from previous exams</li>
                    <li>Customizable quizzes with instant feedback</li>
                    <li>Study resources organized by subjects</li>
                    <li>Performance analytics to track your progress</li>
                    <li>Discussion forums for peer interaction</li>
                    <li>AI-powered quizzes generated for your specific needs</li>
                  </ul>
                  <p>Our goal is to provide a one-stop solution for CA exam preparation, helping students optimize their study time and achieve better results.</p>
                </div>
              </details>
            </div>

            <div className="faq-item">
              <details>
                <summary>Is CAprep free to use?</summary>
                <div className="faq-answer">
                  <p>Yes! CAprep offers a generous free tier that gives you access to:</p>
                  <ul>
                    <li>Basic question bank access</li>
                    <li>Limited practice quizzes</li>
                    <li>Performance tracking</li>
                    <li>Access to discussion forums</li>
                  </ul>
                  <p>We also offer premium subscription options that provide additional benefits such as:</p>
                  <ul>
                    <li>Unlimited access to our complete question bank</li>
                    <li>Advanced analytics and performance insights</li>
                    <li>AI-generated quizzes</li>
                    <li>Premium study resources</li>
                    <li>Priority support</li>
                  </ul>
                  <p>Our pricing is designed to be student-friendly while supporting the continued development of the platform.</p>
                </div>
              </details>
            </div>

            <div className="faq-item">
              <details>
                <summary>Which CA levels does CAprep cover?</summary>
                <div className="faq-answer">
                  <p>CAprep provides comprehensive coverage for all three levels of the Chartered Accountancy course:</p>
                  <ul>
                    <li><strong>Foundation Level:</strong> All eight subjects including Principles and Practices of Accounting, Business Mathematics, Business Economics, and more.</li>
                    <li><strong>Intermediate Level:</strong> All subjects including Advanced Accounting, Corporate Laws, Cost and Management Accounting, Taxation, Auditing, and Financial Management.</li>
                    <li><strong>Final Level:</strong> Complete coverage of subjects like Financial Reporting, Advanced Financial Management, Advanced Auditing, Direct and International Tax Laws, and more.</li>
                  </ul>
                  <p>We regularly update our content to reflect the latest syllabus changes and exam patterns.</p>
                </div>
              </details>
            </div>
            
            <div className="faq-item">
              <details>
                <summary>How often is the content updated?</summary>
                <div className="faq-answer">
                  <p>We're committed to providing the most current and relevant content for your CA exam preparation:</p>
                  <ul>
                    <li>Question bank updates after each new exam session</li>
                    <li>Regular content reviews to ensure accuracy</li>
                    <li>Updates to reflect syllabus changes by ICAI</li>
                    <li>New study resources added monthly</li>
                    <li>Immediate updates for any amendments in tax laws or accounting standards</li>
                  </ul>
                  <p>Our dedicated team of CA professionals and subject matter experts continuously review and enhance our content to ensure you have access to the most up-to-date material.</p>
                </div>
              </details>
            </div>
          </div>

          <div id="account" className="faq-category">
            <h2>Account & Registration</h2>
            
            <div className="faq-item">
              <details>
                <summary>How do I create an account?</summary>
                <div className="faq-answer">
                  <p>Creating an account on CAprep is simple and takes just a few steps:</p>
                  <ol>
                    <li>Click on the "Register" button in the top navigation bar</li>
                    <li>Enter your email address, full name, and create a secure password</li>
                    <li>Verify your email address through the OTP (One-Time Password) sent to your inbox</li>
                    <li>Complete your profile by selecting your CA level and preferences</li>
                    <li>Start exploring the platform!</li>
                  </ol>
                  <p>The entire process takes less than 2 minutes, and you'll have immediate access to our free features.</p>
                </div>
              </details>
            </div>
            
            <div className="faq-item">
              <details>
                <summary>I forgot my password. How can I reset it?</summary>
                <div className="faq-answer">
                  <p>If you've forgotten your password, follow these steps to reset it:</p>
                  <ol>
                    <li>Click on the "Login" button in the navigation bar</li>
                    <li>Click on the "Forgot Password?" link below the login form</li>
                    <li>Enter your registered email address</li>
                    <li>Check your email for a password reset link (check spam/junk folders if not found)</li>
                    <li>Click the link and follow the instructions to create a new password</li>
                    <li>Log in with your new password</li>
                  </ol>
                  <p>For security reasons, password reset links expire after 24 hours. If you don't reset your password within this timeframe, you'll need to request a new link.</p>
                </div>
              </details>
            </div>
            
            <div className="faq-item">
              <details>
                <summary>Can I change my email address or other account details?</summary>
                <div className="faq-answer">
                  <p>Yes, you can update most of your account information through your profile settings:</p>
                  <ol>
                    <li>Log in to your CAprep account</li>
                    <li>Click on your profile icon in the top-right corner</li>
                    <li>Select "Profile" from the dropdown menu</li>
                    <li>Click on the "Edit Profile" button</li>
                    <li>Update your information as needed</li>
                    <li>Click "Save Changes"</li>
                  </ol>
                  <p>Note: If you need to change your registered email address, you'll need to verify the new email address before the change takes effect. Some changes may require additional verification for security purposes.</p>
                </div>
              </details>
            </div>
            
            <div className="faq-item">
              <details>
                <summary>How can I delete my account?</summary>
                <div className="faq-answer">
                  <p>If you wish to delete your account, please follow these steps:</p>
                  <ol>
                    <li>Log in to your CAprep account</li>
                    <li>Navigate to your Profile settings</li>
                    <li>Scroll to the bottom and click on "Delete Account"</li>
                    <li>Confirm your decision by providing your password</li>
                    <li>Follow the final confirmation steps</li>
                  </ol>
                  <p>Please note the following important information:</p>
                  <ul>
                    <li>Account deletion is permanent and cannot be undone</li>
                    <li>All your data, including quiz history and bookmarks, will be permanently removed</li>
                    <li>If you have an active premium subscription, you may want to cancel it first through the subscription management page</li>
                  </ul>
                  <p>If you're experiencing any issues with the platform, we encourage you to <Link to="/contactus">contact our support team</Link> before deleting your account, as we may be able to address your concerns.</p>
                </div>
              </details>
            </div>
          </div>
          
          <div id="practice" className="faq-category">
            <h2>Questions & Practice</h2>
            
            <div className="faq-item">
              <details>
                <summary>What types of questions are available?</summary>
                <div className="faq-answer">
                  <p>CAprep offers a diverse range of question types to ensure comprehensive exam preparation:</p>
                  <ul>
                    <li><strong>Multiple Choice Questions (MCQs):</strong> Single-answer and multiple-answer formats covering theoretical and practical concepts</li>
                    <li><strong>Previous Years' Questions (PYQs):</strong> Actual questions from past CA examinations with detailed solutions</li>
                    <li><strong>Mock Test Papers (MTPs):</strong> Comprehensive sets designed to simulate exam conditions</li>
                    <li><strong>Revision Test Papers (RTPs):</strong> Important questions released by ICAI for revision purposes</li>
                    <li><strong>Case Studies:</strong> Detailed scenarios requiring application of concepts, especially for Final level</li>
                    <li><strong>AI-Generated Questions:</strong> Customized questions created by our AI system based on your study needs</li>
                  </ul>
                  <p>All questions include detailed explanations and, where applicable, references to the relevant sections of law, accounting standards, or study material.</p>
                </div>
              </details>
            </div>
            
            <div className="faq-item">
              <details>
                <summary>How are questions organized?</summary>
                <div className="faq-answer">
                  <p>Our questions are meticulously organized to help you find exactly what you need:</p>
                  <ul>
                    <li><strong>By Exam Level:</strong> Foundation, Intermediate, and Final</li>
                    <li><strong>By Subject:</strong> All subjects within each level</li>
                    <li><strong>By Topic:</strong> Detailed categorization within each subject</li>
                    <li><strong>By Difficulty Level:</strong> Easy, Medium, and Difficult</li>
                    <li><strong>By Source:</strong> PYQs, MTPs, RTPs, or CAprep-exclusive content</li>
                    <li><strong>By Exam Session:</strong> May, November, and the respective year</li>
                  </ul>
                  <p>Our advanced filtering system allows you to combine these categories to create a highly focused study session tailored to your specific needs.</p>
                </div>
              </details>
            </div>
            
            <div className="faq-item">
              <details>
                <summary>Can I bookmark questions for later review?</summary>
                <div className="faq-answer">
                  <p>Yes! The bookmarking feature is one of our most popular tools:</p>
                  <ul>
                    <li>Click the bookmark icon next to any question to save it for later review</li>
                    <li>Access all your bookmarked questions from the "Bookmarks" section in your dashboard</li>
                    <li>Organize bookmarks into custom folders (e.g., "Difficult Questions," "For Revision," etc.)</li>
                    <li>Add personal notes to bookmarked questions</li>
                    <li>Filter your bookmarks by subject, topic, or difficulty level</li>
                    <li>Create practice quizzes using only your bookmarked questions</li>
                  </ul>
                  <p>This feature is particularly useful for creating a personalized revision plan as you approach your exams.</p>
                </div>
              </details>
            </div>
            
            <div className="faq-item">
              <details>
                <summary>How do I report an incorrect question or answer?</summary>
                <div className="faq-answer">
                  <p>We strive for accuracy in all our content. If you find a question or answer that you believe is incorrect:</p>
                  <ol>
                    <li>Click on the "Report Issue" button available on every question</li>
                    <li>Select the type of issue (incorrect question, incorrect answer, outdated content, etc.)</li>
                    <li>Provide a brief explanation of the issue</li>
                    <li>Include references or sources if available (optional but helpful)</li>
                    <li>Submit your report</li>
                  </ol>
                  <p>Our content team reviews all reports within 48-72 hours. If your report leads to a correction, you'll receive a notification and acknowledgment. We appreciate your contribution to maintaining the quality of our platform!</p>
                </div>
              </details>
            </div>
          </div>
          
          <div id="quiz" className="faq-category">
            <h2>Quizzes & Exams</h2>
            
            <div className="faq-item">
              <details>
                <summary>How do the quizzes work?</summary>
                <div className="faq-answer">
                  <p>CAprep's quiz system is designed to be flexible and powerful:</p>
                  <ol>
                    <li><strong>Quiz Creation:</strong> Navigate to the Quiz section and customize your quiz parameters:
                      <ul>
                        <li>Select exam level, subject(s), and specific topics</li>
                        <li>Choose difficulty level (easy, medium, hard, or mixed)</li>
                        <li>Set the number of questions (1-100)</li>
                        <li>Set a time limit (1-180 minutes, or untimed)</li>
                      </ul>
                    </li>
                    <li><strong>Taking the Quiz:</strong>
                      <ul>
                        <li>Answer questions one at a time or navigate between questions</li>
                        <li>Mark questions for review</li>
                        <li>Submit individual answers or all at once</li>
                        <li>Time remaining is displayed (for timed quizzes)</li>
                      </ul>
                    </li>
                    <li><strong>Results & Review:</strong>
                      <ul>
                        <li>Receive immediate feedback with score and performance metrics</li>
                        <li>Review each question with detailed explanations</li>
                        <li>See which answers were correct, incorrect, or unattempted</li>
                        <li>Bookmark challenging questions for future study</li>
                      </ul>
                    </li>
                  </ol>
                  <p>All quiz results are automatically saved to your profile, allowing you to track your progress over time.</p>
                </div>
              </details>
            </div>
            
            <div className="faq-item">
              <details>
                <summary>What are AI-powered quizzes?</summary>
                <div className="faq-answer">
                  <p>Our AI-powered quizzes represent the cutting edge of personalized learning:</p>
                  <ul>
                    <li>Dynamically generated questions using Google's Generative AI technology</li>
                    <li>Questions tailored to your specific learning needs and knowledge gaps</li>
                    <li>Adaptive difficulty based on your performance</li>
                    <li>Comprehensive explanations generated specifically for each question</li>
                    <li>Focus on areas where you need the most improvement</li>
                  </ul>
                  <p>To generate an AI quiz:</p>
                  <ol>
                    <li>Go to the Quiz section and select "AI Quiz"</li>
                    <li>Choose your subject and topic areas</li>
                    <li>Specify any particular concepts you want to focus on (optional)</li>
                    <li>Set your desired difficulty level and number of questions</li>
                    <li>Click "Generate Quiz"</li>
                  </ol>
                  <p>Note: AI-powered quizzes are available to premium subscribers and may have usage limits depending on your subscription plan.</p>
                </div>
              </details>
            </div>
            
            <div className="faq-item">
              <details>
                <summary>Can I track my quiz performance over time?</summary>
                <div className="faq-answer">
                  <p>Yes! Performance tracking is a core feature of CAprep:</p>
                  <ul>
                    <li><strong>Dashboard Analytics:</strong> Your dashboard shows overall performance metrics, including:
                      <ul>
                        <li>Average scores by subject</li>
                        <li>Performance trends over time</li>
                        <li>Strength and weakness analysis</li>
                        <li>Recommended focus areas</li>
                      </ul>
                    </li>
                    <li><strong>Quiz History:</strong> Access detailed information for every quiz you've taken:
                      <ul>
                        <li>Date and time</li>
                        <li>Quiz parameters (subject, topics, difficulty)</li>
                        <li>Score and completion time</li>
                        <li>Question-by-question breakdown</li>
                      </ul>
                    </li>
                    <li><strong>Subject Analysis:</strong> Deep dive into your performance in specific subjects:
                      <ul>
                        <li>Topic-level performance metrics</li>
                        <li>Most challenging question types</li>
                        <li>Progress indicators</li>
                      </ul>
                    </li>
                  </ul>
                  <p>These analytics help you optimize your study strategy by focusing on areas that need improvement while ensuring comprehensive coverage of all topics.</p>
                </div>
              </details>
            </div>
            
            <div className="faq-item">
              <details>
                <summary>How can I simulate actual exam conditions?</summary>
                <div className="faq-answer">
                  <p>CAprep offers several features to help you simulate actual exam conditions:</p>
                  <ul>
                    <li><strong>Full-Length Mock Tests:</strong> Comprehensive exams that mirror the actual CA exam pattern in terms of question distribution, difficulty level, and time allocation</li>
                    <li><strong>Timed Quizzes:</strong> Set specific time limits to practice managing your time effectively during exams</li>
                    <li><strong>Distraction-Free Mode:</strong> Enable this feature to minimize on-screen distractions during your practice sessions</li>
                    <li><strong>Random Question Order:</strong> Option to randomize questions to better simulate exam conditions</li>
                    <li><strong>Previous Years' Papers:</strong> Practice with actual past exam papers in their original format</li>
                  </ul>
                  <p>For the most authentic experience, we recommend:</p>
                  <ol>
                    <li>Choose a quiet environment with minimal distractions</li>
                    <li>Stick to the allocated time strictly</li>
                    <li>Avoid referring to notes or other materials during the test</li>
                    <li>Complete the entire test in one sitting</li>
                  </ol>
                  <p>Regular practice under simulated exam conditions can significantly improve your time management skills and reduce exam anxiety.</p>
                </div>
              </details>
            </div>
          </div>
          
          <div id="resources" className="faq-category">
            <h2>Resources & Study Materials</h2>
            
            <div className="faq-item">
              <details>
                <summary>What study materials are available?</summary>
                <div className="faq-answer">
                  <p>CAprep offers a comprehensive library of study materials:</p>
                  <ul>
                    <li><strong>PDF Resources:</strong> Downloadable study notes, summaries, and reference materials</li>
                    <li><strong>Subject Guides:</strong> Comprehensive coverage of each subject with key concepts and examples</li>
                    <li><strong>Quick Revision Notes:</strong> Concise materials for last-minute revision</li>
                    <li><strong>Formula Sheets:</strong> Important formulas and calculations for quantitative subjects</li>
                    <li><strong>Case Studies:</strong> Detailed case analyses with explanations for practical understanding</li>
                    <li><strong>Amendment Notes:</strong> Updates on recent changes to laws, standards, and regulations</li>
                    <li><strong>Memory Techniques:</strong> Mnemonics and other memory aids for complex topics</li>
                  </ul>
                  <p>All resources are carefully curated by experienced CA professionals and subject matter experts to ensure accuracy and relevance to the current syllabus.</p>
                </div>
              </details>
            </div>
            
            <div className="faq-item">
              <details>
                <summary>Can I download resources for offline study?</summary>
                <div className="faq-answer">
                  <p>Yes, most resources on CAprep are downloadable for offline study:</p>
                  <ul>
                    <li>Look for the download icon next to any resource</li>
                    <li>Most materials are available in PDF format for easy printing or viewing on any device</li>
                    <li>Downloaded resources can be accessed even when you're not connected to the internet</li>
                    <li>There are no limits on the number of downloads for free resources</li>
                    <li>Premium resources may have download limits based on your subscription plan</li>
                  </ul>
                  <p>For the best experience with downloaded materials:</p>
                  <ul>
                    <li>Use a PDF reader with search functionality to easily find specific content</li>
                    <li>Create an organized folder structure on your device to manage downloaded resources</li>
                    <li>Check for updates periodically, as we continually improve and update our materials</li>
                  </ul>
                </div>
              </details>
            </div>
            
            <div className="faq-item">
              <details>
                <summary>How do I find specific resources?</summary>
                <div className="faq-answer">
                  <p>Finding the right resources on CAprep is easy:</p>
                  <ol>
                    <li><strong>Browse by Category:</strong>
                      <ul>
                        <li>Navigate to the Resources section</li>
                        <li>Filter by exam level, subject, and resource type</li>
                        <li>Sort by popularity, date added, or relevance</li>
                      </ul>
                    </li>
                    <li><strong>Search Functionality:</strong>
                      <ul>
                        <li>Use the search bar at the top of the Resources page</li>
                        <li>Enter keywords, topics, or specific concepts</li>
                        <li>Use advanced search filters to refine results</li>
                      </ul>
                    </li>
                    <li><strong>Recommended Resources:</strong>
                      <ul>
                        <li>View personalized resource recommendations on your dashboard</li>
                        <li>Based on your study history and performance analytics</li>
                      </ul>
                    </li>
                  </ol>
                  <p>You can also bookmark resources for quick access later. Simply click the bookmark icon next to any resource, and it will be saved to your "Bookmarked Resources" section.</p>
                </div>
              </details>
            </div>
            
            <div className="faq-item">
              <details>
                <summary>Are the study materials regularly updated?</summary>
                <div className="faq-answer">
                  <p>Yes, keeping our study materials current is a top priority:</p>
                  <ul>
                    <li>All resources are reviewed and updated following any changes to the CA curriculum</li>
                    <li>Amendment notes are published promptly when there are changes to laws or standards</li>
                    <li>Resources are dated so you can easily identify the most recent versions</li>
                    <li>Notifications are sent when significant updates are made to popular resources</li>
                    <li>User feedback is actively incorporated to improve materials</li>
                  </ul>
                  <p>For subjects particularly affected by frequent changes (like Taxation and Corporate Law), we provide:</p>
                  <ul>
                    <li>Comparison charts highlighting changes from previous years</li>
                    <li>Amendment trackers summarizing all updates in chronological order</li>
                    <li>Quarterly revision updates to ensure all materials remain current</li>
                  </ul>
                  <p>If you notice any outdated information in our resources, please use the "Report Issue" feature to let us know.</p>
                </div>
              </details>
            </div>
          </div>
          
          <div id="technical" className="faq-category">
            <h2>Technical Support & Troubleshooting</h2>
            
            <div className="faq-item">
              <details>
                <summary>How can I contact support?</summary>
                <div className="faq-answer">
                  <p>We offer multiple channels to reach our support team:</p>
                  <ul>
                    <li><strong>Email Support:</strong> Send an email to <a href="mailto:caprep8@gmail.com">caprep8@gmail.com</a> for any questions or issues</li>
                    <li><strong>Contact Form:</strong> Use the <Link to="/contactus">Contact Us</Link> page on our website</li>
                    <li><strong>Chat Support:</strong> Click on the chat icon in the bottom-right corner of the screen during business hours</li>
                    <li><strong>Phone Support:</strong> Call us at +91 8591061249 (Monday to Saturday, 9 AM to 6 PM IST)</li>
                  </ul>
                  <p>Our support team typically responds to all inquiries within 24-48 hours. For premium users, we offer priority support with faster response times.</p>
                </div>
              </details>
            </div>
            
            <div className="faq-item">
              <details>
                <summary>Is my data secure on CAprep?</summary>
                <div className="faq-answer">
                  <p>We take data security very seriously at CAprep:</p>
                  <ul>
                    <li><strong>Encryption:</strong> All data is encrypted both in transit and at rest using industry-standard protocols</li>
                    <li><strong>Password Security:</strong> Passwords are hashed and never stored in plain text</li>
                    <li><strong>Regular Security Audits:</strong> We conduct periodic security assessments to identify and address potential vulnerabilities</li>
                    <li><strong>Data Privacy:</strong> We adhere to strict privacy practices and never share your personal information with third parties without your consent</li>
                    <li><strong>Secure Payments:</strong> All payment processing is handled by trusted providers with PCI DSS compliance</li>
                  </ul>
                  <p>For more detailed information about how we handle your data, please review our <Link to="/privacy">Privacy Policy</Link>.</p>
                </div>
              </details>
            </div>
            
            <div className="faq-item">
              <details>
                <summary>Which browsers and devices are supported?</summary>
                <div className="faq-answer">
                  <p>CAprep is designed to work on a wide range of devices and browsers:</p>
                  <p><strong>Supported Browsers:</strong></p>
                  <ul>
                    <li>Google Chrome (recommended) - version 80 or newer</li>
                    <li>Mozilla Firefox - version 75 or newer</li>
                    <li>Safari - version 13 or newer</li>
                    <li>Microsoft Edge - version 80 or newer</li>
                    <li>Opera - version 67 or newer</li>
                  </ul>
                  <p><strong>Supported Devices:</strong></p>
                  <ul>
                    <li>Desktop and laptop computers (Windows, macOS, Linux)</li>
                    <li>Tablets (iPad, Android tablets)</li>
                    <li>Smartphones (iPhone, Android phones)</li>
                  </ul>
                  <p>For the best experience, we recommend using the latest version of Google Chrome on a desktop or laptop computer with a minimum screen resolution of 1280x720 pixels.</p>
                </div>
              </details>
            </div>
            
            <div className="faq-item">
              <details>
                <summary>Common issues and troubleshooting</summary>
                <div className="faq-answer">
                  <p>Here are solutions to some common issues users may encounter:</p>
                  
                  <p><strong>Issue: Unable to log in</strong></p>
                  <ul>
                    <li>Verify that you're using the correct email address and password</li>
                    <li>Check if Caps Lock is enabled</li>
                    <li>Clear your browser cache and cookies</li>
                    <li>Try resetting your password using the "Forgot Password" link</li>
                    <li>Ensure you've verified your email address during registration</li>
                  </ul>
                  
                  <p><strong>Issue: Pages loading slowly</strong></p>
                  <ul>
                    <li>Check your internet connection speed</li>
                    <li>Close unnecessary browser tabs and applications</li>
                    <li>Clear your browser cache</li>
                    <li>Try using a different browser</li>
                    <li>Disable browser extensions that might be interfering</li>
                  </ul>
                  
                  <p><strong>Issue: Quiz doesn't submit properly</strong></p>
                  <ul>
                    <li>Ensure you have a stable internet connection</li>
                    <li>Check if all questions have been answered (or intentionally skipped)</li>
                    <li>Try refreshing the page (your answers should be saved)</li>
                    <li>Clear browser cache and try again</li>
                    <li>Contact support if the problem persists</li>
                  </ul>
                  
                  <p><strong>Issue: PDFs won't download</strong></p>
                  <ul>
                    <li>Check if you have a PDF reader installed</li>
                    <li>Ensure your browser allows downloads from our site</li>
                    <li>Verify you have sufficient storage space on your device</li>
                    <li>Try using a different browser</li>
                    <li>Disable any download-blocking extensions</li>
                  </ul>
                  
                  <p>If you encounter any issues not covered here or if the suggested solutions don't resolve your problem, please <Link to="/contactus">contact our support team</Link> for assistance.</p>
                </div>
              </details>
            </div>
          </div>
        </div>

        <div className="faq-not-found">
          <h3>Can't find what you're looking for?</h3>
          <p>If you have any other questions or need further assistance, our support team is always ready to help you get the most out of your CAprep experience.</p>
          <Link to="/contactus" className="cta-btn primary-btn">Contact Us</Link>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default FAQ;