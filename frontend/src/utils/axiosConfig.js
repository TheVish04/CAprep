import axios from 'axios';
import apiUtils from './apiUtils';

// Use apiUtils to ensure base URL always includes /api (fixes 404 when VITE_API_URL lacks /api)
const API_BASE_URL = apiUtils.getApiBaseUrl();

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 30000,
  withCredentials: true
});

// Request interceptor: use apiUtils so token + auth object are both supported
api.interceptors.request.use(
  (config) => {
    const token = apiUtils.getAuthToken();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Auth redirect handler - set by App to use navigate() (preserves SPA state)
let authRedirectHandler = null;
export function setAuthRedirectHandler(handler) {
  authRedirectHandler = handler;
}

// Response interceptor: on 401 try refresh then retry; on failure redirect to login
let isRefreshing = false;
let failedQueue = [];

const processQueue = (err, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (err) reject(err);
    else resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      const isRefreshEndpoint = originalRequest.url?.includes('/auth/refresh-token');
      const isAuthFailure = error.response?.data?.code === 'TOKEN_EXPIRED' ||
        error.response?.data?.code === 'INVALID_TOKEN' ||
        error.response?.data?.error?.includes('Token') ||
        error.response?.data?.message?.includes('Token');

      if (!isRefreshEndpoint && isAuthFailure) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          }).then((newToken) => {
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
            return api(originalRequest);
          }).catch((e) => Promise.reject(e));
        }
        originalRequest._retry = true;
        isRefreshing = true;
        const refreshed = await apiUtils.refreshToken();
        isRefreshing = false;
        if (refreshed) {
          const token = apiUtils.getAuthToken();
          processQueue(null, token);
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          return api(originalRequest);
        }
        processQueue(error, null);
        apiUtils.clearAuthToken();
        if (authRedirectHandler) {
          authRedirectHandler();
        } else {
          window.location.href = '/login?expired=true';
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
