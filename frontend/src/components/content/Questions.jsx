import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import DOMPurify from 'dompurify';
import Navbar from '../layout/Navbar';
import { generateQuestionsPDF, savePDF } from '../../utils/pdfGenerator';
import './Questions.css';
import api from '../../utils/axiosConfig';
import apiUtils from '../../utils/apiUtils';
import MoreMenu from '../shared/MoreMenu';
import DiscussionModal from './DiscussionModal';
import { QuestionsListSkeleton } from '../shared/Skeleton';

// Add a Bookmark icon component (simple example)
const BookmarkIcon = ({ filled }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={filled ? '#03a9f4' : 'none'} stroke={filled ? 'none' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
  </svg>
);

const Questions = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    subject: '',
    paperType: '',
    year: '',
    questionNumber: '',
    month: '',
    examStage: '',
    paperNo: '',
    search: '',
    bookmarked: false,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [serverPagination, setServerPagination] = useState({ total: 0, page: 1, pages: 1, limit: 10 });
  const [showAnswers, setShowAnswers] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [individualShowAnswers, setIndividualShowAnswers] = useState({});
  const [bookmarkedQuestionIds, setBookmarkedQuestionIds] = useState(new Set());
  const questionsPerPage = 10;
  const [currentDiscussionQuestion, setCurrentDiscussionQuestion] = useState(null);
  const [showDiscussionModal, setShowDiscussionModal] = useState(false);

  // --- Fetch Bookmarked Question IDs --- 
  const fetchBookmarkIds = useCallback(async () => {
    try {
      const response = await api.get('/users/me/bookmarks/ids');
      if (response.data?.bookmarkedQuestionIds) {
        setBookmarkedQuestionIds(new Set(response.data.bookmarkedQuestionIds));
      }
    } catch (err) {
      console.error('Error fetching bookmark IDs:', err);
    }
  }, []);

  // --- Fetch Questions based on filters (with pagination) --- 
  const fetchQuestions = useCallback(async (currentFilters, page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      Object.entries(currentFilters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      params.append('page', String(page));
      params.append('limit', String(questionsPerPage));

      const response = await api.get(`/questions?${params.toString()}`);

      const data = response.data;
      const list = Array.isArray(data) ? data : (data?.data ?? []);
      const pagination = data?.pagination ?? { total: list.length, page: 1, pages: 1, limit: questionsPerPage };
      setQuestions(list);
      setServerPagination(pagination);
    } catch (err) {
      console.error('Error fetching questions:', err);
      setError(err.response?.data?.error || err.message || 'Failed to fetch questions');
      setQuestions([]);
      setServerPagination({ total: 0, page: 1, pages: 1, limit: questionsPerPage });
    } finally {
      setLoading(false);
    }
  }, [questionsPerPage]);

  // --- Initial Load: Check Token, Fetch Bookmarks --- 
  useEffect(() => {
    const token = apiUtils.getAuthToken();
    if (!token) {
      navigate('/login');
    } else {
      fetchBookmarkIds();
    }
  }, [navigate]);

  // --- Refetch when page changes (user clicked pagination) --- 
  const initialMount = React.useRef(true);
  useEffect(() => {
    if (initialMount.current) {
      initialMount.current = false;
      return;
    }
    const token = apiUtils.getAuthToken();
    if (!token) return;
    fetchQuestions(filters, currentPage);
  }, [currentPage]);

  // --- Handle preSelectedQuestion from location.state ---
  useEffect(() => {
    const token = apiUtils.getAuthToken();
    if (token && location.state?.preSelectedQuestion) {
      const questionId = location.state.preSelectedQuestion;
      
      // Track the question view in the backend
      const trackQuestionView = async () => {
        try {
          // Call the API endpoint to track question view
          await api.post('/dashboard/question-view', { questionId });
          
          console.log('Question view tracked successfully');
          
          // Scroll to the question once loaded or open it in the UI
          const findAndScrollToQuestion = () => {
            if (!loading) {
              const questionIndex = questions.findIndex(q => q._id === questionId);
              if (questionIndex !== -1) {
                // Calculate which page contains this question
                const targetPage = Math.floor(questionIndex / questionsPerPage) + 1;
                setCurrentPage(targetPage);
                
                // Add a small delay to ensure the DOM has updated
                setTimeout(() => {
                  const questionElement = document.getElementById(`question-${questionId}`);
                  if (questionElement) {
                    questionElement.scrollIntoView({ behavior: 'smooth' });
                    // Highlight the question briefly
                    questionElement.classList.add('highlight-question');
                    setTimeout(() => {
                      questionElement.classList.remove('highlight-question');
                    }, 2000);
                  }
                }, 100);
              }
              
              // Clear the state to prevent repeated tracking
              navigate(location.pathname, { 
                replace: true, 
                state: { ...location.state, preSelectedQuestion: null } 
              });
            } else {
              // Try again after a short delay if questions are still loading
              setTimeout(findAndScrollToQuestion, 500);
            }
          };
          
          findAndScrollToQuestion();
        } catch (err) {
          console.error('Error tracking question view:', err);
        }
      };
      
      trackQuestionView();
    }
  }, [location.state?.preSelectedQuestion, questions, loading, navigate]);

  // --- Handle Filter Changes: refetch page 1 when filters change --- 
  useEffect(() => {
    const token = apiUtils.getAuthToken();
    if (token) {
      setCurrentPage(1);
      fetchQuestions(filters, 1);
    }
  }, [filters, fetchQuestions]);

  // --- Apply query parameters from URL to filters on initial load --- 
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const examStageParam = params.get('examStage');
    const subjectParam = params.get('subject');
    const bookmarkedParam = params.get('bookmarked') === 'true';
    
    setFilters(prevFilters => {
        const newFilters = { ...prevFilters };
        if (examStageParam) newFilters.examStage = examStageParam;
        if (subjectParam) newFilters.subject = subjectParam;
        if (bookmarkedParam) newFilters.bookmarked = bookmarkedParam;
        return newFilters;
    });
    
  }, [location.search]);

  // --- Get unique years for filtering --- 
  const getUniqueYears = () => {
    const uniqueYears = [...new Set(questions.map((q) => q.year))];
    return uniqueYears.sort((a, b) => b - a);
  };

  // --- Get unique question numbers for filtering --- 
  const getUniqueQuestionNumbers = () => {
    const subjectFiltered = questions.filter((q) => !filters.subject || q.subject === filters.subject);
    const uniqueQuestionNumbers = [...new Set(subjectFiltered.map((q) => q.questionNumber))];
    return uniqueQuestionNumbers.sort((a, b) => a.localeCompare(b, undefined, {numeric: true}));
  };

  // --- Handle Filter Input Change --- 
  const handleFilterChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;

    setFilters(prevFilters => {
      const updatedFilters = { ...prevFilters, [name]: newValue };
      
      if (name === 'examStage') {
          updatedFilters.subject = '';
          updatedFilters.paperNo = '';
          updatedFilters.questionNumber = ''; 
      } else if (name === 'subject') {
          updatedFilters.questionNumber = '';
      }
      
      setCurrentPage(1);
      
      return updatedFilters;
    });
  };

  // --- Handle Bookmark Toggle (direct add/remove, no folder) --- 
  const handleBookmarkToggle = async (questionId) => {
    const token = apiUtils.getAuthToken();
    if (!token) return navigate('/login');

    const isCurrentlyBookmarked = bookmarkedQuestionIds.has(questionId);
    
    if (isCurrentlyBookmarked) {
      try {
        const response = await api.delete(`/users/me/bookmarks/${questionId}`);
        if (response.data?.bookmarkedQuestionIds) {
          setBookmarkedQuestionIds(new Set(response.data.bookmarkedQuestionIds));
          if (filters.bookmarked) {
            setQuestions(prev => prev.filter(q => q._id !== questionId));
          }
        }
      } catch (err) {
        console.error('Error removing bookmark:', err);
      }
    } else {
      try {
        const response = await api.post(`/users/me/bookmarks/${questionId}`, {});
        if (response.data?.bookmarkedQuestionIds) {
          setBookmarkedQuestionIds(new Set(response.data.bookmarkedQuestionIds));
        }
      } catch (err) {
        console.error('Error adding bookmark:', err);
      }
    }
  };

  // Server returns one page of questions; no client-side slice
  const currentQuestions = questions;
  const totalPages = serverPagination.pages || 1;

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // Track question view on backend for "Recently Viewed Questions" on dashboard
  const trackQuestionViewForDashboard = useCallback(async (questionId) => {
    try {
      await api.post('/dashboard/question-view', { questionId });
    } catch (err) {
      console.error('Error tracking question view:', err);
    }
  }, []);

  // Handle individual question answer visibility toggle (also tracks view for dashboard)
  const toggleIndividualAnswer = (questionId) => {
    setIndividualShowAnswers(prev => {
      const next = !prev[questionId];
      if (next) trackQuestionViewForDashboard(questionId);
      return { ...prev, [questionId]: next };
    });
  };
  
  // Handle PDF export
  const handleExportPDF = useCallback(async () => {
    if (questions.length === 0) {
      alert('No questions to export');
      return;
    }

    try {
      await savePDF(questions, filters, showAnswers, individualShowAnswers);
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  }, [questions, filters, showAnswers, individualShowAnswers]);

  // --- Handle opening the discussion modal ---
  const handleOpenDiscussion = (question) => {
    setCurrentDiscussionQuestion(question);
    setShowDiscussionModal(true);
  };

  // --- Handle closing the discussion modal ---
  const handleCloseDiscussion = () => {
    setShowDiscussionModal(false);
  };

  return (
    <div className="page-wrapper">
      <Navbar />
      <div className="questions-section">
        <div className="questions-container">
          <h1>Questions</h1>
          
          {loading && <QuestionsListSkeleton />}
          
          {error && (
            <div className="error">
              <p>Error: {error}</p>
            </div>
          )}

          <div className="questions-actions">
            <button className="export-btn" onClick={handleExportPDF} disabled={loading || questions.length === 0}>
              Export to PDF
            </button>
            <button 
              className={`toggle-answers-btn ${showAnswers ? 'active' : ''}`}
              onClick={() => setShowAnswers(!showAnswers)}
              disabled={loading}
            >
              {showAnswers ? 'Hide All Answers' : 'Show All Answers'}
            </button>
          </div>

          <div className="filters">
            <div className="filter-group">
              <label>Exam Stage:</label>
              <select name="examStage" value={filters.examStage} onChange={handleFilterChange} disabled={loading}>
                <option value="">All</option>
                <option value="Foundation">Foundation</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Final">Final</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Subject:</label>
              <select name="subject" value={filters.subject} onChange={handleFilterChange} disabled={loading || !filters.examStage}>
                <option value="">All</option>
                {filters.examStage === 'Foundation' ? (
                  <>
                    <option value="Accounting">Accounting</option>
                    <option value="Business Laws">Business Laws</option>
                    <option value="Quantitative Aptitude">Quantitative Aptitude</option>
                    <option value="Business Economics">Business Economics</option>
                  </>
                ) : filters.examStage === 'Intermediate' ? (
                  <>
                    <option value="Advanced Accounting">Advanced Accounting</option>
                    <option value="Corporate Laws">Corporate Laws</option>
                    <option value="Cost and Management Accounting">Cost and Management Accounting</option>
                    <option value="Taxation">Taxation</option>
                    <option value="Auditing and Code of Ethics">Auditing and Code of Ethics</option>
                    <option value="Financial and Strategic Management">Financial and Strategic Management</option>
                  </>
                ) : filters.examStage === 'Final' ? (
                  <>
                    <option value="Financial Reporting">Financial Reporting</option>
                    <option value="Advanced Financial Management">Advanced Financial Management</option>
                    <option value="Advanced Auditing">Advanced Auditing</option>
                    <option value="Direct and International Tax Laws">Direct and International Tax Laws</option>
                    <option value="Indirect Tax Laws">Indirect Tax Laws</option>
                    <option value="Integrated Business Solutions">Integrated Business Solutions</option>
                  </>
                ) : (
                  <>
                  </>
                )}
              </select>
            </div>
            <div className="filter-group">
              <label>Paper Type:</label>
              <select name="paperType" value={filters.paperType} onChange={handleFilterChange} disabled={loading}>
                <option value="">All</option>
                <option value="MTP">MTP</option>
                <option value="RTP">RTP</option>
                <option value="PYQS">PYQS</option>
                <option value="Model TP">Model TP</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Year:</label>
              <select name="year" value={filters.year} onChange={handleFilterChange} disabled={loading}>
                <option value="">All</option>
                {getUniqueYears().map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Month:</label>
              <select name="month" value={filters.month} onChange={handleFilterChange} disabled={loading}>
                <option value="">All</option>
                <option value="January">January</option>
                <option value="February">February</option>
                <option value="March">March</option>
                <option value="April">April</option>
                <option value="May">May</option>
                <option value="June">June</option>
                <option value="July">July</option>
                <option value="August">August</option>
                <option value="September">September</option>
                <option value="October">October</option>
                <option value="November">November</option>
                <option value="December">December</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Question No.:</label>
              <select name="questionNumber" value={filters.questionNumber} onChange={handleFilterChange} disabled={loading || !filters.subject}>
                <option value="">All</option>
                {getUniqueQuestionNumbers().map((qn) => (
                  <option key={qn} value={qn}>
                    {qn}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-group filter-group-search">
              <label>Search Keyword:</label>
              <input
                type="text"
                name="search"
                value={filters.search}
                onChange={handleFilterChange}
                placeholder="Enter keywords"
                className="search-input"
                disabled={loading}
              />
            </div>
            <div className="filter-group filter-group-bookmark">
               <label htmlFor="bookmarkedFilter" className="bookmark-filter-label">
                 <input
                   type="checkbox"
                   id="bookmarkedFilter"
                   name="bookmarked"
                   checked={filters.bookmarked}
                   onChange={handleFilterChange}
                   disabled={loading}
                   className="bookmark-checkbox"
                 />
                 Show Bookmarked Only
               </label>
            </div>
          </div>

          {!loading && questions.length === 0 && !error && (
            <p className="no-questions">No questions found matching your criteria.</p>
          )}
          
          {!loading && questions.length > 0 && (
              <div className="questions-list">
              {currentQuestions.map((q) => (
                <div key={q._id} id={`question-${q._id}`} className="question-card">
                  <div className="question-header">
                    <h2>
                      Q{q.questionNumber}: {q.subject} ({q.month} {q.year} | {q.paperType})
                    </h2>
                    <div className="action-buttons-container">
                      <button 
                        onClick={() => handleBookmarkToggle(q._id)} 
                        className="bookmark-btn"
                        title={bookmarkedQuestionIds.has(q._id) ? 'Remove Bookmark' : 'Add Bookmark'}
                      >
                        <BookmarkIcon filled={bookmarkedQuestionIds.has(q._id)} />
                      </button>
                      <div className="more-menu-wrapper">
                        <MoreMenu onDiscuss={() => handleOpenDiscussion(q)} />
                      </div>
                    </div>
                  </div>
                  
                  <div className="question-content-container">
                    <p className="question-label">Question:</p>
                    <div 
                       className="question-text"
                       dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(q.questionText || '') }}
                    />
                  </div>

                  {q.answerText && (showAnswers || individualShowAnswers[q._id]) && (
                    <div className="answer-section main-answer">
                      <h3>Answer:</h3>
                      <div 
                        className="answer-text"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(q.answerText) }}
                      />
                    </div>
                  )}
                  
                  {q.subQuestions && q.subQuestions.length > 0 && (
                     <div className="subquestions-container">
                       <h3>Sub-Questions:</h3>
                       {q.subQuestions.map((subQ, index) => (
                         <div key={index} className="subquestion-item">
                           <div className="question-content-container">
                             <p className="question-label"><strong>Question:</strong></p>
                             <div 
                               className="question-text"
                               dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(subQ.subQuestionText || '') }}
                             />
                           </div>

                           {subQ.answerText && (showAnswers || individualShowAnswers[q._id]) && (
                             <div className="answer-section main-answer">
                               <h3>Answer:</h3>
                               <div 
                                 className="answer-text"
                                 dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(subQ.answerText) }}
                               />
                             </div>
                           )}

                           {subQ.subOptions && subQ.subOptions.length > 0 && (
                             <ul className="subquestion-options">
                               {subQ.subOptions.map((opt, optIndex) => (
                                 <li key={optIndex} className={opt.isCorrect && (showAnswers || individualShowAnswers[q._id]) ? 'correct-option' : ''}>
                                   {opt.optionText}
                                   {opt.isCorrect && (showAnswers || individualShowAnswers[q._id]) && <span className="correct-indicator"> (Correct)</span>}
                                 </li>
                               ))}
                             </ul>
                           )}
                         </div>
                       ))}
                     </div>
                  )}
                  
                   {q.pageNumber && (
                       <p className="page-number-ref"><strong>Reference Page:</strong> {q.pageNumber}</p>
                   )}

                   <button 
                     className="toggle-answer-btn"
                     onClick={() => toggleIndividualAnswer(q._id)} 
                   >
                     {individualShowAnswers[q._id] ? 'Hide Answer/Details' : 'Show Answer/Details'}
                   </button>
                  </div>
                ))}
              </div>
          )}

          {!loading && totalPages > 1 && (
              <div className="pagination">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                  key={page}
                  onClick={() => paginate(page)}
                  className={currentPage === page ? 'active' : ''}
                >
                  {page}
                  </button>
                ))}
              </div>
          )}
        </div>
      </div>
      
      {/* Discussion Modal */}
      {showDiscussionModal && currentDiscussionQuestion && (
        <DiscussionModal
          isOpen={showDiscussionModal}
          onClose={handleCloseDiscussion}
          itemType="question"
          itemId={currentDiscussionQuestion._id}
          itemTitle={`Question ${currentDiscussionQuestion.questionNumber} - ${currentDiscussionQuestion.subject}`}
        />
      )}
    </div>
  );
};

export default Questions;
