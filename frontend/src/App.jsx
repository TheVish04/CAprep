import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { ErrorBoundary } from 'react-error-boundary';

// Statically import all components
import LandingPage from './pages/LandingPage';
import About from './pages/About';
import ContactUs from './pages/ContactUs';
import Login from './components/Login';
import Register from './components/Register';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import Questions from './components/Questions';
import AdminPanel from './components/AdminPanel';
import Quiz from './components/Quiz';
import Resources from './components/Resources';
import ResourceUploader from './components/ResourceUploader';
import QuizHistory from './components/QuizHistory';
import UserProfile from './components/UserProfile';
import BookmarksPage from './components/BookmarksPage';
import QuizReview from './pages/QuizReview';
import Dashboard from './components/Dashboard';
import AdminAnnouncements from './components/AdminAnnouncements';
import ChatBotPage from './pages/ChatBotPage';
// Policy pages removed
import FAQ from './pages/FAQ';

const ProtectedRoute = ({ element, requireAdmin = false }) => {
  const token = localStorage.getItem('token');
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
      localStorage.removeItem('token'); // Clear invalid token
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
  const token = localStorage.getItem('token');
  
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
      // If token is invalid, remove it
      localStorage.removeItem('token');
    }
  }
  
  // No valid token, render the requested auth page
  return element;
};

const App = () => {
  return (
    <Router>
      <ErrorBoundary>
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
            <Route path="/chat" element={<ChatBotPage />} />
            {/* Policy page routes removed */}
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