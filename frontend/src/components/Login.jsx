import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import api from '../utils/axiosConfig';
import './Login.css';

const Login = () => {
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
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
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');
    setIsLoading(true);

    try {
      console.log('Attempting login...');
      
      const response = await api.post('/api/auth/login', credentials);
      
      console.log('Login response received:', response.status);
      
      if (response.data && response.data.token) {
        const { token } = response.data;

        localStorage.setItem('token', token);
        // Safely decode JWT token
        const parts = token.split('.');
        if (parts.length !== 3) {
          throw new Error('Invalid token format');
        }
        const payload = JSON.parse(atob(parts[1]));
        const role = payload.role;

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
              />
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSubmit(e);
                    }
                  }}
                />
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
