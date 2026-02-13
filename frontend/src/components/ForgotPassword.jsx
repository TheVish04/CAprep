import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from './Navbar';
import './ForgotPassword.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError('Please enter a valid email address');
        setIsLoading(false);
        return;
      }

      const response = await axios.post('https://caprep.onrender.com/api/auth/forgot-password', { email });
      
      console.log('Forgot password response:', response.data);
      setSuccess(true);
      setTimeout(() => {
        navigate(`/reset-password?email=${encodeURIComponent(email)}`);
      }, 3000);
    } catch (err) {
      console.error('Forgot password error:', err.response?.data || err.message);
      
      // Handle specific error messages from backend
      if (err.response?.data?.error) {
        if (err.response.data.error.includes('does not exist') || 
            err.response.data.error.includes('cannot receive emails')) {
          setError('This email address appears to be invalid or cannot receive emails. Please check and try again.');
        } else {
          setError(err.response.data.error);
        }
      } else {
        setError('An error occurred. Please try again later.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <Navbar />
      <div className="auth-container">
        <div className="auth-form">
          <h2>Forgot Password</h2>
          
          {error && <p className="error">{error}</p>}
          
          {success ? (
            <div className="success-message">
              <p>We've sent a password reset OTP to your email.</p>
              <p>Redirecting to reset page...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} id="forgot-password-form">
              <div>
                <label>Email:</label>
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Enter your registered email"
                />
              </div>
              <button 
                type="submit" 
                disabled={isLoading}
                className={isLoading ? 'loading' : ''}
              >
                {isLoading ? 'Sending...' : 'Send Reset OTP'}
              </button>
            </form>
          )}
          
          <p className="auth-link">
            <Link to="/login">Back to Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword; 