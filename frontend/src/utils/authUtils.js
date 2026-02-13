/**
 * Authentication utilities for handling token operations and logout
 */
const authUtils = {
  /**
   * Check if the error is related to token expiration
   * @param {Object} error - Error object from API call
   * @returns {boolean} - True if the error is a token expiration error
   */
  isTokenExpirationError: (error) => {
    // Check if the error is a 401 with TOKEN_EXPIRED code
    if (error?.response?.status === 401) {
      return error?.response?.data?.code === 'TOKEN_EXPIRED' || 
             error?.message?.includes('Token has expired') || 
             error?.response?.data?.error?.includes('Token has expired');
    }
    
    // Check for error message in API response
    if (error?.error?.includes('Token has expired') || 
        error?.message?.includes('Token has expired')) {
      return true;
    }
    
    return false;
  },
  
  /**
   * Handle automatic logout when token is expired
   * @param {Object} error - Error object from API call
   * @param {Function} navigate - React Router navigate function
   * @returns {boolean} - True if logout was performed
   */
  handleTokenExpiration: (error, navigate) => {
    if (authUtils.isTokenExpirationError(error)) {
      console.log('Token expired, logging out automatically');
      // Clear auth data
      localStorage.removeItem('token');
      localStorage.removeItem('auth');
      
      // If navigate function is provided, redirect to login
      if (navigate) {
        navigate('/login', { 
          state: { 
            message: 'Your session has expired. Please log in again.',
            alertType: 'info'
          } 
        });
      } else if (window.location.pathname !== '/login') {
        // Fallback if navigate function is not available
        window.location.href = '/login?expired=true';
      }
      
      return true;
    }
    
    return false;
  }
};

export default authUtils; 