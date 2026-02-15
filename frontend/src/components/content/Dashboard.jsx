import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import api from '../../utils/axiosConfig';
import Navbar from '../layout/Navbar';
import apiUtils from '../../utils/apiUtils';
import { DashboardSkeleton } from '../shared/Skeleton';
import './Dashboard.css';
import { format, formatDistanceToNow } from 'date-fns';
import { Line, Bar, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement,
  BarElement,
  ArcElement,
  Title, 
  Tooltip, 
  Legend
);

const Dashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pomodoroActive, setPomodoroActive] = useState(false);
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60); // 25 minutes in seconds
  const [pomodoroSubject, setPomodoroSubject] = useState('');
  const [pomodoroExamStage, setPomodoroExamStage] = useState('');
  const [activeBookmarkTab, setActiveBookmarkTab] = useState('questions'); // Add state for active bookmark tab
  const timerRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const fetchDashboardData = useCallback(async () => {
    try {
      const token = apiUtils.getAuthToken();
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await api.get('/dashboard', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        timeout: 10000
      });

      if (response.data.success) {
        const data = response.data.data;
        if (!data.announcements) data.announcements = [];
        if (!data.recentlyViewedQuestions) data.recentlyViewedQuestions = [];
        if (!data.recentlyViewedResources) data.recentlyViewedResources = [];
        if (!data.bookmarkedContent) data.bookmarkedContent = { questions: [], resources: [] };
        setDashboardData(data);
        setError(null);
      } else {
        setError('Failed to fetch dashboard data');
      }
    } catch (err) {
      console.error('Dashboard data error:', err);
      let errorMessage = 'An error occurred while fetching dashboard data';
      if (err.response) {
        errorMessage = `Server error: ${err.response.status} - ${err.response.data?.message || err.message}`;
      } else if (err.request) {
        errorMessage = 'Network error: Unable to connect to server. Please check your internet connection.';
      } else {
        errorMessage = `Request error: ${err.message}`;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  // Fetch when we're on dashboard (mount or navigate back) and refetch on window focus
  useEffect(() => {
    if (location.pathname !== '/dashboard') return;
    setLoading(true);
    fetchDashboardData();
  }, [location.pathname, fetchDashboardData]);

  useEffect(() => {
    if (location.pathname !== '/dashboard') return;
    const onFocus = () => {
      fetchDashboardData();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [location.pathname, fetchDashboardData]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Format time for Pomodoro timer
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start Pomodoro timer
  const startPomodoro = () => {
    if (pomodoroActive) return;
    
    setPomodoroActive(true);
    timerRef.current = setInterval(() => {
      setPomodoroTime(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handlePomodoroComplete();
          return 25 * 60;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Stop Pomodoro timer
  const stopPomodoro = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setPomodoroActive(false);
  };

  // Reset Pomodoro timer
  const resetPomodoro = () => {
    stopPomodoro();
    setPomodoroTime(25 * 60);
  };

  // Handle Pomodoro completion
  const handlePomodoroComplete = async () => {
    setPomodoroActive(false);
    
    try {
      const token = apiUtils.getAuthToken();
      if (!token) {
        navigate('/login');
        return;
      }
      
      // Record study session (25 min = 0.42 hours)
      await api.post('/dashboard/study-session', {
        hours: 0.42, // 25 minutes in hours
        subject: pomodoroSubject || null,
        examStage: pomodoroExamStage || null
      });
      
      // Show completion notification
      alert('Pomodoro session completed! Take a short break before starting the next one.');
      
    } catch (err) {
      console.error('Error recording study session:', err);
    }
  };

  // Navigate to a specific item
  const navigateToItem = (type, id, title = null) => {
    switch (type) {
      case 'question':
        navigate('/questions', { state: { preSelectedQuestion: id } });
        break;
      case 'resource':
        navigate('/resources', { state: { preSelectedResource: id, searchQuery: title } });
        break;
      case 'quiz':
        navigate('/quiz-review', { state: { quizId: id } });
        break;
      case 'announcement':
        // Simply display the announcement in an alert for now
        // In a full implementation, you might navigate to a dedicated announcements page
        const announcement = dashboardData.announcements.find(a => a._id === id);
        if (announcement) {
          alert(`${announcement.title}\n\n${announcement.content}`);
        }
        break;
      default:
        break;
    }
  };

  // Track resource view
  const trackResourceView = async (resourceId, resourceTitle = null) => {
    try {
      const token = apiUtils.getAuthToken();
      if (!token) return;
      
      // Track the resource view on the backend
      await api.post('/dashboard/resource-view', { resourceId });
      
      // Navigate to the resource
      navigateToItem('resource', resourceId, resourceTitle);
    } catch (err) {
      console.error('Error tracking resource view:', err);
      // Still navigate even if tracking fails
      navigateToItem('resource', resourceId, resourceTitle);
    }
  };
  
  // Download resource directly
  const downloadResource = async (resourceId, resourceTitle = null) => {
    try {
      const token = apiUtils.getAuthToken();
      if (!token) return;
      
      // Increment download count
      try {
        await api.post(`/resources/${resourceId}/download`, {});
      } catch (countError) {
        console.error('Failed to increment download count:', countError);
      }
      
      // Get the resource data
      const response = await api.get(`/resources/${resourceId}`);
      
      if (response.data && response.data.fileUrl) {
        // Open the PDF in a new tab (browser's native PDF viewer)
        window.open(response.data.fileUrl, '_blank');
      } else {
        alert('Could not download the resource. Please try again later.');
      }
    } catch (err) {
      console.error('Error downloading resource:', err);
      alert('Failed to download the resource. Please try the Details option instead.');
    }
  };

  // Track question view
  const trackQuestionView = async (questionId) => {
    try {
      const token = apiUtils.getAuthToken();
      if (!token) return;
      
      await api.post('/dashboard/question-view', { questionId });
      
      navigateToItem('question', questionId);
    } catch (err) {
      console.error('Error tracking question view:', err);
    }
  };

  // Get subjects based on exam stage
  const getSubjectsForExamStage = (stage) => {
    switch (stage) {
      case 'Foundation':
        return [
          'Accounting',
          'Business Laws',
          'Quantitative Aptitude',
          'Business Economics'
        ];
      case 'Intermediate':
        return [
          'Advanced Accounting',
          'Corporate Laws',
          'Cost and Management Accounting',
          'Taxation',
          'Auditing and Code of Ethics',
          'Financial and Strategic Management'
        ];
      case 'Final':
        return [
          'Financial Reporting',
          'Advanced Financial Management',
          'Advanced Auditing',
          'Direct and International Tax Laws',
          'Indirect Tax Laws',
          'Integrated Business Solutions'
        ];
      default:
        return [];
    }
  };

  // Handle exam stage change
  const handleExamStageChange = (e) => {
    const newStage = e.target.value;
    setPomodoroExamStage(newStage);
    // Reset subject when exam stage changes
    setPomodoroSubject('');
  };

  const handleDismissAnnouncement = async (id) => {
    try {
      await api.patch(`/announcements/${id}/dismiss`);
      setDashboardData((prev) => ({
        ...prev,
        announcements: (prev.announcements || []).filter((a) => a._id !== id)
      }));
    } catch (err) {
      console.error('Failed to dismiss announcement:', err);
    }
  };

  const handleAcknowledgeAnnouncement = async (id) => {
    try {
      await api.patch(`/announcements/${id}/acknowledge`);
      setDashboardData((prev) => ({
        ...prev,
        announcements: (prev.announcements || []).filter((a) => a._id !== id)
      }));
    } catch (err) {
      console.error('Failed to acknowledge announcement:', err);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <Navbar />
        <DashboardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <Navbar />
        <div className="dashboard-error">
          <h2>Error Loading Dashboard</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Try Again</button>
        </div>
      </div>
    );
  }

  // Prepare quiz trends chart data
  const quizTrendsData = {
    labels: [],
    datasets: []
  };

  if (dashboardData && dashboardData.quizScoreTrends) {
    // Process each subject
    Object.entries(dashboardData.quizScoreTrends).forEach(([subject, scores], index) => {
      // Get dates and scores
      const dates = scores.map(item => new Date(item.date).toLocaleDateString());
      const scoreValues = scores.map(item => item.score);
      
      // Add dataset for this subject
      quizTrendsData.datasets.push({
        label: subject,
        data: scoreValues,
        borderColor: getColorByIndex(index),
        backgroundColor: getColorByIndex(index, 0.2),
        tension: 0.3
      });
      
      // Set labels if not already set
      if (quizTrendsData.labels.length === 0) {
        quizTrendsData.labels = dates;
      }
    });
  }

  // Prepare study hours chart data
  const studyHoursData = {
    labels: [],
    datasets: [
      {
        label: 'Study Hours',
        data: [],
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1
      }
    ]
  };

  if (dashboardData && dashboardData.studyHoursSummary && dashboardData.studyHoursSummary.daily) {
    // Get last 7 days of data
    const lastWeekData = dashboardData.studyHoursSummary.daily.slice(-7);
    studyHoursData.labels = lastWeekData.map(item => new Date(item.date).toLocaleDateString());
    studyHoursData.datasets[0].data = lastWeekData.map(item => item.hours);
  }

  // Helper function to get colors by index
  function getColorByIndex(index, alpha = 1) {
    const colors = [
      `rgba(75, 192, 192, ${alpha})`,   // Teal
      `rgba(153, 102, 255, ${alpha})`,  // Purple
      `rgba(255, 159, 64, ${alpha})`,   // Orange
      `rgba(255, 99, 132, ${alpha})`,   // Red
      `rgba(54, 162, 235, ${alpha})`,   // Blue
      `rgba(255, 206, 86, ${alpha})`,   // Yellow
    ];
    return colors[index % colors.length];
  }

  // Subject strengths pie chart data
  const subjectStrengthsData = {
    labels: [],
    datasets: [
      {
        data: [],
        backgroundColor: [],
        borderColor: [],
        borderWidth: 1
      }
    ]
  };

  if (dashboardData && dashboardData.subjectStrengths && dashboardData.subjectStrengths.length > 0) {
    dashboardData.subjectStrengths.forEach((subject, index) => {
      subjectStrengthsData.labels.push(subject.subject);
      subjectStrengthsData.datasets[0].data.push(subject.strengthScore);
      subjectStrengthsData.datasets[0].backgroundColor.push(getColorByIndex(index, 0.6));
      subjectStrengthsData.datasets[0].borderColor.push(getColorByIndex(index));
    });
  }

  // Resource usage data - by specific resource (which PDF), not just type
  const resourceUsageData = {
    labels: [],
    datasets: [
      {
        label: 'Time Spent (minutes)',
        data: [],
        backgroundColor: [],
        borderColor: [],
        borderWidth: 1
      }
    ]
  };

  if (dashboardData && dashboardData.resourceStats && dashboardData.resourceStats.timeSpentByResource && dashboardData.resourceStats.timeSpentByResource.length > 0) {
    dashboardData.resourceStats.timeSpentByResource.forEach((item, index) => {
      const shortTitle = item.title && item.title.length > 35 ? item.title.substring(0, 35) + '…' : (item.title || 'Unknown');
      resourceUsageData.labels.push(shortTitle);
      resourceUsageData.datasets[0].data.push(Math.round((item.timeSpent || 0) / 60));
      resourceUsageData.datasets[0].backgroundColor.push(getColorByIndex(index, 0.6));
      resourceUsageData.datasets[0].borderColor.push(getColorByIndex(index));
    });
  }

  return (
    <div className="dashboard-container">
      <Navbar />
      <div className="dashboard-wrapper">
        <h1 className="dashboard-title">Your Personal Dashboard</h1>
        
        {loading ? (
          <DashboardSkeleton />
        ) : error ? (
          <div className="dashboard-error">
            <h2>Error Loading Dashboard</h2>
            <p>{error}</p>
            <button onClick={() => window.location.reload()}>Try Again</button>
          </div>
        ) : (
          <div className="dashboard-grid">
            {/* Quiz Performance Trends - full width */}
            <div className="dashboard-card quiz-trends dashboard-card-full-width">
              <h2>Quiz Performance Trends</h2>
              {dashboardData && dashboardData.quizScoreTrends && Object.keys(dashboardData.quizScoreTrends).length > 0 ? (
                <div className="chart-container chart-container-quiz-trends">
                  <Line 
                    data={quizTrendsData} 
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { position: 'top' },
                        title: {
                          display: true,
                          text: 'Subject-wise Quiz Performance'
                        }
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          max: 100,
                          title: {
                            display: true,
                            text: 'Score (%)'
                          }
                        }
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="no-data">
                  <p>No quiz data available yet. Complete some quizzes to see your performance trends.</p>
                  <Link to="/quiz" className="dashboard-cta">Take your first quiz</Link>
                </div>
              )}
            </div>

            {/* Recently Viewed Questions */}
            <div className="dashboard-card recent-questions">
              <h2>Recently Viewed Questions</h2>
              {dashboardData && dashboardData.recentlyViewedQuestions && dashboardData.recentlyViewedQuestions.length > 0 ? (
                <ul className="recent-list">
                  {dashboardData.recentlyViewedQuestions.map((item) => (
                    <li key={item.questionId._id} onClick={() => trackQuestionView(item.questionId._id)}>
                      <div className="recent-item-content">
                        <p className="item-title">
                          {item.questionId && (item.questionId.questionText || item.questionId.text)
                            ? (() => { const t = item.questionId.questionText || item.questionId.text; return t.substring(0, 80) + (t.length > 80 ? '...' : ''); })()
                            : 'No question text available'}
                        </p>
                        <p className="item-meta">
                          <span className="subject-tag">{item.questionId && item.questionId.subject}</span>
                          <span className="timestamp">{formatDistanceToNow(new Date(item.viewedAt), { addSuffix: true })}</span>
                        </p>
                      </div>
                      <div className="recent-item-arrow">›</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="no-data">
                  <p>No recently viewed questions. Start exploring questions to see them here.</p>
                  <Link to="/questions" className="dashboard-cta">Browse questions</Link>
                </div>
              )}
            </div>

            {/* Recently Viewed Resources */}
            <div className="dashboard-card recent-resources">
              <h2>Recently Viewed Resources</h2>
              {dashboardData && dashboardData.recentlyViewedResources && dashboardData.recentlyViewedResources.length > 0 ? (
                <ul className="recent-list">
                  {dashboardData.recentlyViewedResources.map((item) => (
                    <li key={item.resourceId._id} onClick={() => trackResourceView(item.resourceId._id, item.resourceId.title)}>
                      <div className="recent-item-content">
                        <p className="item-title">{item.resourceId.title}</p>
                        <p className="item-meta">
                          <span className="subject-tag">{item.resourceId.subject}</span>
                          <span className="type-tag">{item.resourceId.resourceType}</span>
                          <span className="timestamp">{formatDistanceToNow(new Date(item.viewedAt), { addSuffix: true })}</span>
                        </p>
                      </div>
                      <div className="recent-item-arrow">›</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="no-data">
                  <p>No recently viewed resources. Start exploring resources to see them here.</p>
                  <Link to="/resources" className="dashboard-cta">Browse resources</Link>
                </div>
              )}
            </div>

            {/* Bookmarked Content */}
            <div className="dashboard-card bookmarks">
              <h2>Bookmarked Content</h2>
              <div className="tabs">
                <button 
                  className={`tab ${activeBookmarkTab === 'questions' ? 'active' : ''}`}
                  onClick={() => setActiveBookmarkTab('questions')}
                >
                  Questions
                </button>
                <button 
                  className={`tab ${activeBookmarkTab === 'resources' ? 'active' : ''}`}
                  onClick={() => setActiveBookmarkTab('resources')}
                >
                  Resources
                </button>
              </div>
              <div className="tab-content">
                {activeBookmarkTab === 'questions' ? (
                  dashboardData && dashboardData.bookmarkedContent && dashboardData.bookmarkedContent.questions.length > 0 ? (
                    <ul className="bookmark-list">
                      {dashboardData.bookmarkedContent.questions.slice(0, 5).map((question) => (
                        <li key={question._id} onClick={() => trackQuestionView(question._id)}>
                          <div className="bookmark-item-content">
                            <p className="item-title">
                              {(question.questionText || question.text) ? (question.questionText || question.text).substring(0, 80) + ((question.questionText || question.text).length > 80 ? '...' : '') : 'No question text available'}
                            </p>
                            <p className="item-meta">
                              <span className="subject-tag">{question.subject}</span>
                              <span className="difficulty-tag">{question.difficulty}</span>
                            </p>
                          </div>
                          <div className="bookmark-item-arrow">›</div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="no-data">
                      <p>No bookmarked questions. Bookmark important questions to access them quickly.</p>
                      <Link to="/questions" className="dashboard-cta">Browse questions</Link>
                    </div>
                  )
                ) : (
                  dashboardData && dashboardData.bookmarkedContent && dashboardData.bookmarkedContent.resources.length > 0 ? (
                    <ul className="bookmark-list">
                      {dashboardData.bookmarkedContent.resources.slice(0, 5).map((resource) => (
                        <li key={resource._id} onClick={() => trackResourceView(resource._id, resource.title)}>
                          <div className="bookmark-item-content">
                            <p className="item-title">{resource.title}</p>
                            <p className="item-meta">
                              <span className="subject-tag">{resource.subject}</span>
                              <span className="type-tag">{resource.resourceType || 'PDF'}</span>
                            </p>
                          </div>
                          <div className="bookmark-item-arrow">›</div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="no-data">
                      <p>No bookmarked resources. Bookmark useful resources to access them quickly.</p>
                      <Link to="/resources" className="dashboard-cta">Browse resources</Link>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Subject-wise Strength/Weakness Analysis */}
            <div className="dashboard-card subject-strengths">
              <h2>Subject Performance Analysis</h2>
              {dashboardData && dashboardData.subjectStrengths && dashboardData.subjectStrengths.length > 0 ? (
                <div className="chart-container chart-container-full">
                  <Pie 
                    data={subjectStrengthsData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { position: 'right' },
                        title: {
                          display: true,
                          text: 'Strength by Subject (%)'
                        }
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="no-data">
                  <p>No subject performance data available yet. Complete more quizzes to see your strengths and weaknesses.</p>
                </div>
              )}
            </div>

            {/* Announcements and Updates */}
            <div className="dashboard-card announcements">
              <h2>Announcements & Updates</h2>
              {dashboardData && dashboardData.announcements && dashboardData.announcements.length > 0 ? (
                <ul className="announcement-list">
                  {dashboardData.announcements.map((announcement) => (
                    <li key={announcement._id}
                      className={`priority-${announcement.priority}`}
                      onClick={() => navigateToItem('announcement', announcement._id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="announcement-header">
                        <span className={`announcement-type ${announcement.type}`}>{announcement.type}</span>
                        <span className="announcement-date">{formatDistanceToNow(new Date(announcement.createdAt), { addSuffix: true })}</span>
                      </div>
                      <h3>{announcement.title}</h3>
                      <p>{announcement.content}</p>
                      <div className="announcement-actions" onClick={(e) => e.stopPropagation()}>
                        {announcement.needsAcknowledgment && (
                          <button
                            type="button"
                            className="btn-acknowledge"
                            onClick={() => handleAcknowledgeAnnouncement(announcement._id)}
                          >
                            Acknowledge
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-dismiss"
                          onClick={() => handleDismissAnnouncement(announcement._id)}
                        >
                          Dismiss
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="no-data">
                  <p>No active announcements at this time.</p>
                </div>
              )}
            </div>

            {/* New Resources */}
            <div className="dashboard-card new-resources">
              <h2>New Resources Added</h2>
              {dashboardData && dashboardData.newResources && dashboardData.newResources.length > 0 ? (
                <ul className="new-resources-list">
                  {dashboardData.newResources.map((resource) => (
                    <li key={resource._id} onClick={() => trackResourceView(resource._id, resource.title)}>
                      <div className="resource-item-content">
                        <h3>{resource.title}</h3>
                        <p className="resource-meta">
                          <span className="subject-tag">{resource.subject}</span>
                          <span className="type-tag">{resource.resourceType}</span>
                          <span className="resource-date">Added {formatDistanceToNow(new Date(resource.createdAt), { addSuffix: true })}</span>
                        </p>
                      </div>
                      <div className="resource-buttons">
                        <button className="resource-arrow-btn view-resource-btn" onClick={(e) => {
                          e.stopPropagation();
                          downloadResource(resource._id, resource.title);
                        }}>Download PDF</button>
                        <button className="resource-arrow-btn" onClick={(e) => {
                          e.stopPropagation();
                          trackResourceView(resource._id, resource.title);
                        }}>Details</button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="no-data">
                  <p>No new resources added recently.</p>
                  <Link to="/resources" className="dashboard-cta">Browse resources</Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard; 