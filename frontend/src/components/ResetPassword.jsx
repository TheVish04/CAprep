import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import Navbar from './Navbar';
import './ForgotPassword.css';

const ResetPassword = () => {
  const [formData, setFormData] = useState({
    email: '',
    otp: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  
  // Check for email in query params (from ForgotPassword component)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const email = params.get('email');
    if (email) {
      setFormData(prev => ({ ...prev, email }));
      console.log('Email found in URL params:', email);
    }
  }, [location]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // For OTP, automatically remove spaces and non-numeric characters
    if (name === 'otp') {
      // Remove non-numeric characters
      const cleanValue = value.replace(/[^0-9]/g, '');
      setFormData({ ...formData, [name]: cleanValue });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (!formData.email || !formData.otp) {
        setError('Email and OTP are required');
        setIsLoading(false);
        return;
      }

      // Clean and format the OTP - remove any spaces and ensure it's a string
      const cleanOtp = formData.otp.toString().trim();
      
      console.log('Verifying OTP:', { 
        email: formData.email.trim(), 
        otp: cleanOtp,
        originalOtp: formData.otp
      });
      
      const response = await axios.post('https://caprep.onrender.com/api/auth/verify-reset-otp', {
        email: formData.email.trim(),
        otp: cleanOtp
      });

      console.log('OTP verification response:', response.data);
      
      if (response.data.success) {
        setOtpVerified(true);
        setError('');
      } else {
        setError('Invalid or expired OTP');
      }
    } catch (err) {
      console.error('OTP verification error:', err.response?.data || err.message);
      setError(err.response?.data?.error || 'Failed to verify OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (formData.newPassword !== formData.confirmPassword) {
        setError('Passwords do not match');
        setIsLoading(false);
        return;
      }

      if (formData.newPassword.length < 8) {
        setError('Password must be at least 8 characters long');
        setIsLoading(false);
        return;
      }

      console.log('Resetting password for:', { email: formData.email });
      
      const response = await axios.post('https://caprep.onrender.com/api/auth/reset-password', {
        email: formData.email,
        otp: formData.otp,
        newPassword: formData.newPassword
      });

      console.log('Password reset response:', response.data);
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      console.error('Password reset error:', err.response?.data || err.message);
      setError(err.response?.data?.error || 'Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Show password toggle
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div>
      <Navbar />
      <div className="auth-container">
        <div className="auth-form">
          <h2>Reset Password</h2>
          
          {error && <p className="error">{error}</p>}
          
          {success ? (
            <div className="success-message">
              <p>Your password has been reset successfully!</p>
              <p>Redirecting to login page...</p>
            </div>
          ) : (
            !otpVerified ? (
              <form onSubmit={verifyOtp} id="verify-otp-form">
                <div>
                  <label>Email:</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    readOnly={formData.email !== ''}
                    placeholder="Enter your email"
                  />
                </div>
                <div>
                  <label>OTP:</label>
                  <input
                    type="text"
                    name="otp"
                    value={formData.otp}
                    onChange={handleChange}
                    required
                    placeholder="Enter OTP sent to your email"
                    autoComplete="one-time-code"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className={isLoading ? 'loading' : ''}
                >
                  {isLoading ? 'Verifying...' : 'Verify OTP'}
                </button>
              </form>
            ) : (
              <form onSubmit={resetPassword} id="reset-password-form">
                <div>
                  <label>New Password:</label>
                  <div className="password-container">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="newPassword"
                      value={formData.newPassword}
                      onChange={handleChange}
                      required
                      placeholder="Enter new password"
                      minLength="8"
                      autoComplete="new-password"
                    />
                    <span 
                      className="toggle-password" 
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </span>
                  </div>
                </div>
                <div>
                  <label>Confirm Password:</label>
                  <div className="password-container">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      required
                      placeholder="Confirm new password"
                      autoComplete="new-password"
                    />
                  </div>
                </div>
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className={isLoading ? 'loading' : ''}
                >
                  {isLoading ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            )
          )}
          
          <p className="auth-link">
            <Link to="/login">Back to Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword; 