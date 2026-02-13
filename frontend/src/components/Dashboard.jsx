import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from './Navbar';
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

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          navigate('/login');
          return;
        }

        const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/dashboard`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Cache-Control': 'no-cache', // Prevent caching issues
            'Pragma': 'no-cache'
          },
          timeout: 10000 // 10 seconds timeout
        });

        if (response.data.success) {
          const data = response.data.data;
          // Ensure announcements exists even if it's missing in the response
          if (!data.announcements) {
            data.announcements = [];
          }
          setDashboardData(data);
        } else {
          setError('Failed to fetch dashboard data');
        }
      } catch (err) {
        console.error('Dashboard data error:', err);
        // More detailed error message
        let errorMessage = 'An error occurred while fetching dashboard data';
        if (err.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          errorMessage = `Server error: ${err.response.status} - ${err.response.data?.message || err.message}`;
        } else if (err.request) {
          // The request was made but no response was received
          errorMessage = 'Network error: Unable to connect to server. Please check your internet connection.';
        } else {
          // Something happened in setting up the request that triggered an Error
          errorMessage = `Request error: ${err.message}`;
        }
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
    
    // Cleanup function
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [navigate]);

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
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }
      
      // Record study session (25 min = 0.42 hours)
      await axios.post(`${import.meta.env.VITE_API_URL}/api/dashboard/study-session`, {
        hours: 0.42, // 25 minutes in hours
        subject: pomodoroSubject || null,
        examStage: pomodoroExamStage || null
      }, {
        headers: { Authorization: `Bearer ${token}` }
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
      const token = localStorage.getItem('token');
      if (!token) return;
      
      // Track the resource view on the backend
      await axios.post(`${import.meta.env.VITE_API_URL}/api/dashboard/resource-view`, {
        resourceId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
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
      const token = localStorage.getItem('token');
      if (!token) return;
      
      // Increment download count
      try {
        await axios.post(`${import.meta.env.VITE_API_URL}/api/resources/${resourceId}/download`, {}, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (countError) {
        console.error('Failed to increment download count:', countError);
      }
      
      // Get the resource data
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/resources/${resourceId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
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
      const token = localStorage.getItem('token');
      if (!token) return;
      
      await axios.post(`${import.meta.env.VITE_API_URL}/api/dashboard/question-view`, {
        questionId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
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

  if (loading) {
    return (
      <div className="dashboard-container">
        <Navbar />
        <div className="dashboard-loading">
          <div className="spinner"></div>
          <p>Loading your personalized dashboard...</p>
        </div>
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

  // Resource usage data
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

  if (dashboardData && dashboardData.resourceStats && dashboardData.resourceStats.timeSpentByType) {
    Object.entries(dashboardData.resourceStats.timeSpentByType).forEach(([type, time], index) => {
      resourceUsageData.labels.push(type);
      // Convert seconds to minutes
      resourceUsageData.datasets[0].data.push(Math.round(time / 60));
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
          <div className="dashboard-loading">
            <div className="spinner"></div>
            <p>Loading your personalized dashboard...</p>
          </div>
        ) : error ? (
          <div className="dashboard-error">
            <h2>Error Loading Dashboard</h2>
            <p>{error}</p>
            <button onClick={() => window.location.reload()}>Try Again</button>
          </div>
        ) : (
          <div className="dashboard-grid">
            {/* Recent Quiz Scores with Trend */}
            <div className="dashboard-card quiz-trends">
              <h2>Quiz Performance Trends</h2>
              {dashboardData && dashboardData.quizScoreTrends && Object.keys(dashboardData.quizScoreTrends).length > 0 ? (
                <div className="chart-container">
                  <Line 
                    data={quizTrendsData} 
                    options={{
                      responsive: true,
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
                </div>
              )}
            </div>

            {/* Weekly Study Hours */}
            <div className="dashboard-card study-hours">
              <h2>Weekly Study Hours</h2>
              {dashboardData && dashboardData.studyHoursSummary && dashboardData.studyHoursSummary.daily.length > 0 ? (
                <div className="chart-container">
                  <Bar 
                    data={studyHoursData} 
                    options={{
                      responsive: true,
                      plugins: {
                        legend: { position: 'top' },
                        title: {
                          display: true,
                          text: 'Study Hours (Last 7 Days)'
                        }
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          title: {
                            display: true,
                            text: 'Hours'
                          }
                        }
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="no-data">
                  <p>No study hours tracked yet. Use the Pomodoro timer to start logging your study sessions.</p>
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
                          {item.questionId && item.questionId.text 
                            ? item.questionId.text.substring(0, 80) + '...' 
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
                              {question.text ? question.text.substring(0, 80) + '...' : 'No question text available'}
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
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Subject-wise Strength/Weakness Analysis */}
            <div className="dashboard-card subject-strengths">
              <h2>Subject Performance Analysis</h2>
              {dashboardData && dashboardData.subjectStrengths && dashboardData.subjectStrengths.length > 0 ? (
                <div className="chart-container">
                  <Pie 
                    data={subjectStrengthsData}
                    options={{
                      responsive: true,
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
                </div>
              )}
            </div>

            {/* Pomodoro Timer */}
            <div className="dashboard-card pomodoro">
              <h2>Pomodoro Study Timer</h2>
              <div className="pomodoro-container">
                <div className="pomodoro-description">
                  <p>The Pomodoro Technique is a time management method that breaks study sessions into focused 25-minute intervals, separated by short 5-minute breaks. This method enhances concentration, reduces mental fatigue, and improves productivity.</p>
                </div>
                <div className="pomodoro-timer">{formatTime(pomodoroTime)}</div>
                <div className="pomodoro-controls">
                  {!pomodoroActive ? (
                    <button className="pomodoro-start" onClick={startPomodoro}>Start</button>
                  ) : (
                    <button className="pomodoro-stop" onClick={stopPomodoro}>Pause</button>
                  )}
                  <button className="pomodoro-reset" onClick={resetPomodoro}>Reset</button>
                </div>
                <div className="pomodoro-subject">
                  <select 
                    value={pomodoroExamStage} 
                    onChange={handleExamStageChange}
                    disabled={pomodoroActive}
                    className="pomodoro-select"
                  >
                    <option value="">Select Exam Stage</option>
                    <option value="Foundation">Foundation</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Final">Final</option>
                  </select>
                </div>
                <div className="pomodoro-subject">
                  <select 
                    value={pomodoroSubject} 
                    onChange={(e) => setPomodoroSubject(e.target.value)}
                    disabled={pomodoroActive || !pomodoroExamStage}
                    className="pomodoro-select"
                  >
                    <option value="">Select Subject</option>
                    {getSubjectsForExamStage(pomodoroExamStage).map(subject => (
                      <option key={subject} value={subject}>{subject}</option>
                    ))}
                  </select>
                </div>
                <div className="pomodoro-info">
                  <p>Complete a session to automatically log 25 minutes of study time.</p>
                </div>
              </div>
            </div>

            {/* Resource Usage Statistics */}
            <div className="dashboard-card resource-usage">
              <h2>Resource Usage Statistics</h2>
              {dashboardData && dashboardData.resourceStats && dashboardData.resourceStats.mostUsed && dashboardData.resourceStats.mostUsed.length > 0 ? (
                <div className="resource-stats-container">
                  <div className="resource-chart">
                    <Bar 
                      data={resourceUsageData}
                      options={{
                        responsive: true,
                        plugins: {
                          legend: { position: 'top' },
                          title: {
                            display: true,
                            text: 'Time Spent by Resource Type (minutes)'
                          }
                        },
                        indexAxis: 'y'
                      }}
                    />
                  </div>
                  <div className="most-used-resources">
                    <h3>Most Used Resources</h3>
                    <ul>
                      {dashboardData.resourceStats.mostUsed.map((resource) => (
                        <li key={resource.resourceId}>
                          <span className="resource-title">{resource.title}</span>
                          <span className="access-count">{resource.accessCount} views</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="no-data">
                  <p>No resource usage data available yet. Start using resources to see your usage statistics.</p>
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