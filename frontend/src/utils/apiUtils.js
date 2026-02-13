import axios from 'axios';

/**
 * Utility for making API calls with consistent error handling and authentication
 */
const apiUtils = {
  /**
   * Get the base API URL from environment variables or use default
   * @returns {string} The API base URL without trailing slash
   */
  getApiBaseUrl: () => {
    let apiUrl = import.meta.env.VITE_API_URL || 'https://caprep.onrender.com';
    // Remove trailing slash if it exists
    if (apiUrl.endsWith('/')) {
      apiUrl = apiUrl.slice(0, -1);
    }
    return apiUrl;
  },

  /**
   * Get the authentication token from localStorage
   * @returns {string|null} The JWT token or null if not available
   */
  getAuthToken: () => {
    const authData = localStorage.getItem('auth');
    if (!authData) return null;
    
    try {
      const { token, expires } = JSON.parse(authData);
      
      // Check if token is expired
      if (expires && new Date(expires) < new Date()) {
        console.warn('Auth token expired, clearing local storage');
        localStorage.removeItem('auth');
        return null;
      }
      
      return token;
    } catch (err) {
      console.error('Error parsing auth data', err);
      localStorage.removeItem('auth');
      return null;
    }
  },
  
  /**
   * Set the authentication token in localStorage with expiration
   * @param {Object} authData - The authentication data containing token and user info
   */
  setAuthToken: (authData) => {
    if (!authData || !authData.token) {
      console.error('Invalid auth data provided');
      return;
    }
    
    localStorage.setItem('auth', JSON.stringify(authData));
  },
  
  /**
   * Clear the authentication token from localStorage
   */
  clearAuthToken: () => {
    localStorage.removeItem('auth');
  },
  
  /**
   * Get default headers including authorization if token exists
   * @returns {Object} Headers object
   */
  getHeaders: () => {
    const headers = { 
      'Content-Type': 'application/json'
    };
    
    const token = apiUtils.getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  },
  
  /**
   * Check if token needs refreshing (less than 30 minutes until expiry)
   * @returns {boolean} True if token should be refreshed
   */
  shouldRefreshToken: () => {
    const authData = localStorage.getItem('auth');
    if (!authData) return false;
    
    try {
      const { expires } = JSON.parse(authData);
      if (!expires) return false;
      
      const expiryDate = new Date(expires);
      const now = new Date();
      
      // If token expires in less than 30 minutes (1800000 ms), refresh it
      return expiryDate > now && (expiryDate - now) < 30 * 60 * 1000;
    } catch (err) {
      return false;
    }
  },
  
  /**
   * Refresh the authentication token
   * @returns {Promise<boolean>} True if successful, false otherwise
   */
  refreshToken: async () => {
    // Don't attempt refresh if no token exists
    if (!apiUtils.getAuthToken()) return false;
    
    try {
      const apiUrl = apiUtils.getApiBaseUrl();
      const url = `${apiUrl}/api/auth/refresh-token`;
      
      const response = await axios.post(url, {}, {
        headers: apiUtils.getHeaders(),
        timeout: 10000
      });
      
      // Update token in localStorage
      const { token, expires, user } = response.data;
      apiUtils.setAuthToken({ token, expires, user });
      
      console.log('Token refreshed successfully');
      return true;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      // If refresh fails due to auth issues, clear the token
      if (error.response && error.response.status === 401) {
        apiUtils.clearAuthToken();
      }
      return false;
    }
  },

  /**
   * Make a GET request to the API
   * @param {string} endpoint - API endpoint (without leading slash)
   * @param {Object} options - Additional axios options
   * @returns {Promise} - Axios response promise
   */
  get: async (endpoint, options = {}) => {
    // Check if token needs refreshing
    if (apiUtils.shouldRefreshToken()) {
      await apiUtils.refreshToken();
    }
    
    const apiUrl = apiUtils.getApiBaseUrl();
    const url = `${apiUrl}/${endpoint}`;
    
    const defaultOptions = {
      timeout: 30000,
      headers: apiUtils.getHeaders(),
      withCredentials: false
    };

    try {
      console.log(`Making GET request to: ${url}`);
      return await axios.get(url, { ...defaultOptions, ...options });
    } catch (error) {
      // Handle auth errors consistently
      if (error.response && error.response.status === 401) {
        // Clear token on auth failures
        if (error.response.data.code === 'TOKEN_EXPIRED' ||
            error.response.data.code === 'INVALID_TOKEN') {
          apiUtils.clearAuthToken();
        }
      }
      
      console.error(`Error in GET ${url}:`, error);
      throw apiUtils.handleError(error);
    }
  },

  /**
   * Make a POST request to the API
   * @param {string} endpoint - API endpoint (without leading slash)
   * @param {Object} data - Request data
   * @param {Object} options - Additional axios options
   * @returns {Promise} - Axios response promise
   */
  post: async (endpoint, data, options = {}) => {
    // Skip token refresh for auth endpoints to avoid loops
    if (!endpoint.includes('auth/login') && 
        !endpoint.includes('auth/register') && 
        !endpoint.includes('auth/refresh-token') && 
        apiUtils.shouldRefreshToken()) {
      await apiUtils.refreshToken();
    }
    
    const apiUrl = apiUtils.getApiBaseUrl();
    const url = `${apiUrl}/${endpoint}`;
    
    const defaultOptions = {
      timeout: 30000,
      headers: apiUtils.getHeaders(),
      withCredentials: false
    };

    try {
      console.log(`Making POST request to: ${url}`);
      return await axios.post(url, data, { ...defaultOptions, ...options });
    } catch (error) {
      // Handle auth errors consistently
      if (error.response && error.response.status === 401) {
        // Clear token on auth failures
        if (error.response.data.code === 'TOKEN_EXPIRED' ||
            error.response.data.code === 'INVALID_TOKEN') {
          apiUtils.clearAuthToken();
        }
      }
      
      console.error(`Error in POST ${url}:`, error);
      throw apiUtils.handleError(error);
    }
  },

  /**
   * Handle and standardize error responses
   * @param {Error} error - The error from axios
   * @returns {Object} - Standardized error object
   */
  handleError: (error) => {
    // Network or connection error
    if (error.code === 'ERR_NETWORK') {
      return {
        isNetworkError: true,
        message: 'Network error. Please check your internet connection and try again.',
        originalError: error
      };
    }
    
    // Server responded with an error
    if (error.response) {
      return {
        status: error.response.status,
        data: error.response.data,
        message: error.response.data?.error || 'Server error occurred',
        code: error.response.data?.code,
        redirect: error.response.data?.redirect,
        originalError: error
      };
    }
    
    // Request was made but no response received (timeout, etc)
    if (error.request) {
      return {
        isRequestError: true,
        message: 'No response received from server. Please try again later.',
        originalError: error
      };
    }
    
    // Something else happened while setting up the request
    return {
      isUnknownError: true,
      message: error.message || 'An unknown error occurred',
      originalError: error
    };
  }
};

export default apiUtils; 