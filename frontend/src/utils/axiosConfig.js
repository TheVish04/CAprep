import axios from 'axios';

// Use API URL from environment variables with fallback
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://caprep.onrender.com';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 30000, // 30 seconds timeout (increased from 15 seconds)
  withCredentials: true // Important for CORS with credentials
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem('token');
    
    // If token exists, add to headers
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('[API Response Error]', error);
    
    // Handle token expiration
    if (error.response && error.response.status === 401) {
      // Check if error is due to invalid token
      if (error.response.data.message === 'Invalid token' || 
          error.response.data.message === 'Token expired') {
        localStorage.removeItem('token');
        window.location.href = '/login?expired=true';
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
