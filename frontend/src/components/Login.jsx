import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import api from '../utils/axiosConfig';
import apiUtils from '../utils/apiUtils';
import './Login.css';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Login = () => {
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });
  const [isEmailNotRegistered, setIsEmailNotRegistered] = useState(false);
  const [infoMessage, setInfoMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  
  // State for toggling password visibility
  const [showPassword, setShowPassword] = useState(false);

  // Check for session expired message on component mount
  useEffect(() => {
    // Check URL parameters for expired token
    const queryParams = new URLSearchParams(location.search);
    if (queryParams.get('expired') === 'true') {
      setInfoMessage('Your session has expired. Please log in again.');
    }
    
    // Check if there's a message from redirect state (from authUtils)
    if (location.state?.message) {
      setInfoMessage(location.state.message);
      // Clear the state message after displaying it
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials({ ...credentials, [name]: value });
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateFields = () => {
    const errors = { email: '', password: '' };
    if (!credentials.email.trim()) {
      errors.email = 'Email is required';
    } else if (!EMAIL_REGEX.test(credentials.email.trim())) {
      errors.email = 'Please enter a valid email address';
    }
    if (!credentials.password) {
      errors.password = 'Password is required';
    }
    setFieldErrors(errors);
    return !errors.email && !errors.password;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsEmailNotRegistered(false);
    setInfoMessage('');
    if (!validateFields()) return;
    setIsLoading(true);

    try {
      console.log('Attempting login...');
      
      const response = await api.post('/auth/login', credentials);
      
      console.log('Login response received:', response.status);
      
      if (response.data && response.data.token) {
        const { token, expires, user, refreshToken, refreshExpires } = response.data;
        // Store auth object for token refresh flow (apiUtils + axios interceptor)
        apiUtils.setAuthToken({
          token,
          expires,
          user,
          ...(refreshToken && { refreshToken }),
          ...(refreshExpires && { refreshExpires })
        });
        const role = user?.role ?? (() => {
          const parts = token.split('.');
          if (parts.length !== 3) return 'user';
          try {
            return JSON.parse(atob(parts[1])).role || 'user';
          } catch {
            return 'user';
          }
        })();

        console.log('Login successful, navigating to appropriate dashboard');
        if (role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/dashboard');
        }
      } else {
        throw new Error('No token received in response');
      }
    } catch (err) {
      console.error('Login error:', err);
      
      if (err.response) {
        // Server responded with an error status
        console.error('Error response:', err.response.status, err.response.data);
        const isNotRegistered = err.response.data?.code === 'EMAIL_NOT_REGISTERED';
        setIsEmailNotRegistered(!!isNotRegistered);
        setError(err.response.data?.error || 'Invalid credentials or server error');
      } else if (err.request) {
        // Request was made but no response
        console.error('No response received:', err.request);
        setError('Network error: No response from server. Please try again later.');
      } else {
        // Error in request setup
        console.error('Request error:', err.message);
        setError(`Error: ${err.message}`);
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
          <h2>Login</h2>
          {error && <p className="error">{error}</p>}
          {isEmailNotRegistered && (
            <p className="auth-link register-prompt">
              Please <Link to="/register">register as a new user</Link> to continue.
            </p>
          )}
          {infoMessage && <p className="info-message">{infoMessage}</p>}
          <form onSubmit={handleSubmit} id="login-form" aria-labelledby="login-tab">
            <div>
              <label>Email:</label>
              <input
                type="email"
                name="email"
                value={credentials.email}
                onChange={handleChange}
                required
                disabled={isLoading}
                className={fieldErrors.email ? 'input-error' : ''}
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              />
              {fieldErrors.email && <p id="email-error" className="inline-error">{fieldErrors.email}</p>}
            </div>
            <div>
              <label>Password:</label>
              <div className="password-container">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={credentials.password}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  className={fieldErrors.password ? 'input-error' : ''}
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSubmit(e);
                    }
                  }}
                />
                {fieldErrors.password && <p id="password-error" className="inline-error">{fieldErrors.password}</p>}
                <span 
                  className="toggle-password" 
                  onClick={() => !isLoading && setShowPassword(!showPassword)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </span>
              </div>
            </div>
            <div className="forgot-password-link">
              <Link to="/forgot-password">Forgot Password?</Link>
            </div>
            <button type="submit" disabled={isLoading}>
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>
          <p className="auth-link">
            New user? <Link to="/register">Register here</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
