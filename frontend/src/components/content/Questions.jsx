import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import DOMPurify from 'dompurify';
import Navbar from '../layout/Navbar';
import { generateQuestionsPDF, savePDF } from '../../utils/pdfGenerator';
import './Questions.css';
import api from '../../utils/axiosConfig';
import apiUtils from '../../utils/apiUtils';
import DiscussionModal from './DiscussionModal';
import { QuestionsListSkeleton } from '../shared/Skeleton';

// AI Icon component
const AiIcon = () => (
  <svg
    className="ai-icon"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="11" width="18" height="10" rx="2"></rect>
    <circle cx="12" cy="5" r="2"></circle>
    <path d="M12 7v4"></path>
    <line x1="8" y1="16" x2="8" y2="16"></line>
    <line x1="16" y1="16" x2="16" y2="16"></line>
  </svg>
);

// Add a Bookmark icon component (simple example)
const DiscussIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
  </svg>
);

const BookmarkIcon = ({ filled }) => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill={filled ? '#03a9f4' : 'none'} stroke={filled ? 'none' : 'currentColor'} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
  </svg>
);

const Questions = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  // Initialize filters from URL so first fetch uses search/params (avoids race with URL effect)
  const [filters, setFilters] = useState(() => {
    const params = new URLSearchParams(location.search);
    return {
      subject: params.get('subject') || '',
      paperType: '',
      year: '',
      questionNumber: '',
      month: '',
      examStage: params.get('examStage') || '',
      paperNo: '',
      search: params.get('search') || '',
      bookmarked: params.get('bookmarked') === 'true',
    };
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [isAllMode, setIsAllMode] = useState(false);
  const [serverPagination, setServerPagination] = useState({ total: 0, page: 1, pages: 1, limit: 10 });
  const [showAnswers, setShowAnswers] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [individualShowAnswers, setIndividualShowAnswers] = useState({});
  const [bookmarkedQuestionIds, setBookmarkedQuestionIds] = useState(new Set());
  const questionsPerPage = 10;
  const [currentDiscussionQuestion, setCurrentDiscussionQuestion] = useState(null);
  const [showDiscussionModal, setShowDiscussionModal] = useState(false);
  const [aiExplanation, setAiExplanation] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  // Streaming animation state: { full: string, displayed: number } | null
  const [streamingAiText, setStreamingAiText] = useState(null);
  // Local search input (not committed to filters until Search is clicked)
  const [searchInput, setSearchInput] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('search') || '';
  });

  // Streaming animation constants (chars per tick, tick interval ms)
  const AI_STREAM_CHARS = 5;
  const AI_STREAM_MS = 25;

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
      if (!isAllMode) {
        params.append('page', String(page));
        params.append('limit', String(questionsPerPage));
      } else {
        params.append('limit', 'all');
      }

      const response = await api.get(`/questions?${params.toString()}`);

      const data = response.data;
      const list = Array.isArray(data) ? data : (data?.data ?? []);
      const pagination = data?.pagination ?? { total: list.length, page: 1, pages: 1, limit: isAllMode ? list.length : questionsPerPage };
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
  }, [questionsPerPage, isAllMode]);

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

  // --- Handle Filter Changes: refetch page 1 when filters change --- 
  useEffect(() => {
    const token = apiUtils.getAuthToken();
    if (token) {
      if (!isAllMode) {
        setCurrentPage(1);
        fetchQuestions(filters, 1);
      } else {
        fetchQuestions(filters); // fetch all with current filters
      }
    }
  }, [filters, isAllMode, fetchQuestions]);

  // --- Apply query parameters from URL when URL changes (e.g. back/forward) --- 
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const examStageParam = params.get('examStage') || '';
    const subjectParam = params.get('subject') || '';
    const bookmarkedParam = params.get('bookmarked') === 'true';
    const searchParam = params.get('search') || '';

    setFilters(prevFilters => {
      const examStage = examStageParam || prevFilters.examStage;
      const subject = subjectParam || prevFilters.subject;
      const bookmarked = bookmarkedParam;
      const search = searchParam || prevFilters.search;
      if (examStage === prevFilters.examStage && subject === prevFilters.subject &&
        bookmarked === prevFilters.bookmarked && search === prevFilters.search) {
        return prevFilters;
      }
      return { ...prevFilters, examStage, subject, bookmarked, search };
    });
  }, [location.search]);

  // --- Handle AI Explanation Fetching ---
  // Triggered only when filters.search is committed (via Search button/Enter), NOT on every keystroke
  useEffect(() => {
    const searchTerm = filters.search?.trim();
    // Only fetch if 2–30 characters (user-requested limit)
    if (!searchTerm || searchTerm.length < 2 || searchTerm.length > 30) {
      setAiExplanation(null);
      setIsAiLoading(false);
      setStreamingAiText(null);
      return;
    }

    // No debounce needed anymore — this only fires on committed search (button click / Enter)
    setIsAiLoading(true);
    let ignore = false;

    const fetchExplanation = async () => {
      try {
        const response = await api.post('/ai-quiz/search-explanation', { searchTerm });
        if (!ignore) {
          if (response.data?.explanation) {
            setAiExplanation(null);
            setStreamingAiText({ full: response.data.explanation, displayed: 0 });
          } else {
            setAiExplanation(null);
            setStreamingAiText(null);
          }
        }
      } catch (err) {
        if (!ignore) {
          console.error('Error fetching AI explanation:', err);
          setAiExplanation("Our AI assistant is experiencing high traffic. Please try again in a few moments.");
          setStreamingAiText(null);
        }
      } finally {
        if (!ignore) setIsAiLoading(false);
      }
    };

    fetchExplanation();

    return () => { ignore = true; };
  }, [filters.search]);

  // --- Streaming animation for AI explanation ---
  useEffect(() => {
    if (!streamingAiText) return;
    const { full, displayed } = streamingAiText;
    if (displayed >= full.length) {
      setAiExplanation(full);
      setStreamingAiText(null);
      return;
    }
    const timer = setInterval(() => {
      setStreamingAiText(prev => {
        if (!prev) return null;
        const next = Math.min(prev.displayed + AI_STREAM_CHARS, prev.full.length);
        return { ...prev, displayed: next };
      });
    }, AI_STREAM_MS);
    return () => clearInterval(timer);
  }, [streamingAiText]);

  // --- Get unique years for filtering --- 
  const getUniqueYears = () => {
    const uniqueYears = [...new Set(questions.map((q) => q.year))];
    return uniqueYears.sort((a, b) => b - a);
  };

  // --- Get unique question numbers for filtering --- 
  const getUniqueQuestionNumbers = () => {
    const subjectFiltered = questions.filter((q) => !filters.subject || q.subject === filters.subject);
    const uniqueQuestionNumbers = [...new Set(subjectFiltered.map((q) => q.questionNumber))];
    return uniqueQuestionNumbers.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  };

  // --- Handle Filter Input Change (dropdowns & checkbox only, not search) --- 
  const handleFilterChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;

    // Search box is handled separately via searchInput state + Search button
    if (name === 'search') return;

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

  // --- Commit the search input into filters (triggers question fetch + AI) ---
  const handleSearch = () => {
    const trimmed = searchInput.trim();
    setAiExplanation(null);
    setStreamingAiText(null);
    setIsAiLoading(false);
    setCurrentPage(1);
    setFilters(prev => ({ ...prev, search: trimmed }));
  };

  const handleShowAll = () => {
    setIsAllMode(prev => !prev);
    setCurrentPage(1);
  };

  // Allow pressing Enter in search box to trigger search
  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
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
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Enter keywords"
                className="search-input"
                maxLength={200}
              />
            </div>
            <button
              className="search-submit-btn"
              onClick={handleSearch}
              disabled={loading}
            >
              Search
            </button>
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

          {/* AI Explanation Box — only shown when search is committed and ≤30 chars */}
          {filters.search?.trim().length >= 2 && filters.search?.trim().length <= 30 && (isAiLoading || streamingAiText || aiExplanation) ? (
            <div className="ai-explanation-container">
              <div className="ai-explanation-header">
                <AiIcon /> AI Assistant explains "{filters.search.trim()}"
              </div>
              <div className="ai-explanation-content">
                {isAiLoading ? (
                  <div className="ai-loading-shimmer">
                    <div className="shimmer-line"></div>
                    <div className="shimmer-line"></div>
                    <div className="shimmer-line short"></div>
                  </div>
                ) : streamingAiText ? (
                  <p>
                    {streamingAiText.full.slice(0, streamingAiText.displayed)}
                    <span className="ai-stream-cursor" aria-hidden="true">|</span>
                  </p>
                ) : (
                  <p>{aiExplanation}</p>
                )}
              </div>
            </div>
          ) : null}

          {loading && <QuestionsListSkeleton />}

          {error && (
            <div className="error">
              <p>Error: {error}</p>
            </div>
          )}

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
                      <button 
                        className="discuss-btn" 
                        onClick={() => handleOpenDiscussion(q)}
                        title="Discuss this question"
                      >
                        <DiscussIcon /> Discuss
                      </button>
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
                    {individualShowAnswers[q._id] ? 'Hide Answer / Details' : 'Show Answer / Details'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {!loading && (serverPagination.total > questionsPerPage || isAllMode) && (
            <div className="pagination">
              {!isAllMode && Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => paginate(page)}
                  className={currentPage === page ? 'active' : ''}
                >
                  {page}
                </button>
              ))}
              <button 
                className={`show-all-btn ${isAllMode ? 'active' : ''}`}
                onClick={handleShowAll}
              >
                {isAllMode ? 'Show Pages' : 'Show All Questions'}
              </button>
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
