import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from './components/shared/ErrorBoundary';
import apiUtils from './utils/apiUtils';
import { setAuthRedirectHandler } from './utils/axiosConfig';

// Statically import all components
import LandingPage from './pages/LandingPage';
import About from './pages/About';
import ContactUs from './pages/ContactUs';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import ForgotPassword from './components/auth/ForgotPassword';
import ResetPassword from './components/auth/ResetPassword';
import Questions from './components/content/Questions';
import AdminPanel from './components/admin/AdminPanel';
import Quiz from './components/content/Quiz';
import Resources from './components/content/Resources';
import ResourceUploader from './components/admin/ResourceUploader';
import QuizHistory from './components/content/QuizHistory';
import UserProfile from './components/user/UserProfile';
import BookmarksPage from './components/user/BookmarksPage';
import QuizReview from './pages/QuizReview';
import Dashboard from './components/content/Dashboard';
import AdminAnnouncements from './components/admin/AdminAnnouncements';
import ChatBotPage from './pages/ChatBotPage';
import FAQ from './pages/FAQ';

const ProtectedRoute = ({ element, requireAdmin = false }) => {
  const token = apiUtils.getAuthToken();
  let isAdmin = false;

  if (token) {
    try {
      // Safely decode JWT token
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }
      const payload = JSON.parse(atob(parts[1]));
      if (payload.role === 'admin') {
        isAdmin = true;
      }
    } catch (error) {
      console.error('Error decoding token:', error);
      apiUtils.clearAuthToken();
    }
  }

  if (!token) {
    return <Navigate to="/login" />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" />;
  }

  return element;
};

// Redirect already logged in users away from auth pages
const RedirectIfLoggedIn = ({ element, path }) => {
  const token = apiUtils.getAuthToken();
  
  if (token && (path === '/login' || path === '/register')) {
    try {
      // Validate token format
      const parts = token.split('.');
      if (parts.length === 3) {
        // Token seems valid, redirect to dashboard
        return <Navigate to="/dashboard" />;
      }
    } catch (error) {
      console.error('Error checking token:', error);
      apiUtils.clearAuthToken();
    }
  }
  
  // No valid token, render the requested auth page
  return element;
};

// Sets axios 401 redirect to use navigate() instead of window.location (preserves SPA state)
function AuthRedirectSetup() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    setAuthRedirectHandler(() => {
      navigate('/login', {
        state: { from: location.pathname, message: 'Your session has expired. Please log in again.' },
        replace: true,
      });
    });
  }, [navigate, location.pathname]);
  return null;
}

const App = () => {
  return (
    <Router>
      <AuthRedirectSetup />
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <div className="App">
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<RedirectIfLoggedIn element={<Login />} path="/login" />} />
            <Route path="/register" element={<RedirectIfLoggedIn element={<Register />} path="/register" />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/about" element={<About />} />
            <Route path="/contactus" element={<ContactUs />} />
            <Route path="/chat" element={<ProtectedRoute element={<ChatBotPage />} />} />
            <Route path="/faq" element={<FAQ />} />
            
            {/* Protected Routes */}
            <Route
              path="/questions"
              element={<ProtectedRoute element={<Questions />} />}
            />
            <Route
              path="/quiz"
              element={<ProtectedRoute element={<Quiz />} />}
            />
            <Route
              path="/quiz-history"
              element={<ProtectedRoute element={<QuizHistory />} />}
            />
            <Route
              path="/quiz-review"
              element={<ProtectedRoute element={<QuizReview />} />}
            />
            <Route
              path="/profile"
              element={<ProtectedRoute element={<UserProfile />} />}
            />
            <Route
              path="/bookmarks"
              element={<ProtectedRoute element={<BookmarksPage />} />}
            />
            <Route
              path="/resources"
              element={<ProtectedRoute element={<Resources />} />}
            />
            <Route
              path="/dashboard"
              element={<ProtectedRoute element={<Dashboard />} />}
            />
            
            {/* Admin Routes */}
            <Route
              path="/admin"
              element={<ProtectedRoute element={<AdminPanel />} requireAdmin={true} />}
            />
            <Route
              path="/admin/resources"
              element={<ProtectedRoute element={<ResourceUploader />} requireAdmin={true} />}
            />
            <Route
              path="/admin/announcements"
              element={<ProtectedRoute element={<AdminAnnouncements />} requireAdmin={true} />}
            />
            <Route
              path="/admin/analytics"
              element={<ProtectedRoute element={<AdminPanel />} requireAdmin={true} />}
            />
            <Route
              path="/admin/feature-requests"
              element={<ProtectedRoute element={<AdminPanel />} requireAdmin={true} />}
            />
            <Route
              path="/admin/report-issues"
              element={<ProtectedRoute element={<AdminPanel />} requireAdmin={true} />}
            />
            
            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </ErrorBoundary>
      <Analytics />
    </Router>
  );
};

export default App;