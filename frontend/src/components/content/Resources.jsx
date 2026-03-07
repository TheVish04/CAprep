import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../layout/Navbar';
import { ResourcesListSkeleton } from '../shared/Skeleton';
import './Resources.css';
import axios from 'axios';
import api from '../../utils/axiosConfig';
import apiUtils from '../../utils/apiUtils';
import MoreMenu from '../shared/MoreMenu';
import DiscussionModal from './DiscussionModal';
import AnimatedList from '../ui/AnimatedList';

// Paper Title with View PDF button component
const PaperViewHeader = ({ title, paperType, month, year, examStage, subject, onViewPDF, isLoading }) => {
  return (
    <div className="paper-view-header">
      <div>
        <h2 className="paper-view-title">{title}</h2>
        <div className="paper-tags-container">
          <span className="paper-tag">{examStage}</span>
          <span className="paper-tag">{subject}</span>
          <span className="paper-tag">{paperType}</span>
          <span className="paper-tag">{month} {year}</span>
        </div>
      </div>
      <button
        onClick={onViewPDF}
        className="download-btn view-pdf-btn"
        disabled={isLoading}
      >
        {isLoading ? 'Opening...' : 'View PDF'}
      </button>
    </div>
  );
};

// Re-use Bookmark icon from Questions component (or define it here if preferred)
const BookmarkIcon = ({ filled }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={filled ? '#03a9f4' : 'none'} stroke={filled ? 'none' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
  </svg>
);

const Resources = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [resources, setResources] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloadingResource, setDownloadingResource] = useState(null);
  // Initialize filters from URL so first fetch uses search/params (avoids race with URL effect)
  const [filters, setFilters] = useState(() => {
    const params = new URLSearchParams(location.search);
    return {
      subject: params.get('subject') || '',
      paperType: '',
      year: '',
      month: '',
      examStage: params.get('examStage') || '',
      search: params.get('search') || '',
      bookmarked: params.get('bookmarked') === 'true',
    };
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [serverPagination, setServerPagination] = useState({ total: 0, page: 1, pages: 1, limit: 10 });
  const [bookmarkedResourceIds, setBookmarkedResourceIds] = useState(new Set());
  const resourcesPerPage = 10;
  const [currentDiscussionResource, setCurrentDiscussionResource] = useState(null);
  const [showDiscussionModal, setShowDiscussionModal] = useState(false);
  const [filterOptions, setFilterOptions] = useState({ years: [] });

  // Download a resource and increment download count
  const handleDownload = useCallback(async (resource) => {
    try {
      const token = apiUtils.getAuthToken();
      if (!token) return navigate('/login');

      console.log('Starting download process for resource:', resource.title);
      setDownloadingResource(resource._id);

      // Track resource view for "Recently Viewed Resources" on dashboard
      try {
        await api.post('/dashboard/resource-view', { resourceId: resource._id });
      } catch (viewError) {
        console.error('Failed to track resource view:', viewError);
      }

      // Simplest and most reliable method: open the proxy URL which sets attachment headers
      const safeTitle = (resource.title || 'resource').replace(/[^\w\s.-]/g, '').trim().replace(/\s+/g, '_');
      const filename = `${safeTitle}.pdf`;
      const downloadUrl = `${apiUtils.getApiBaseUrl()}/resources/${resource._id}/download/${encodeURIComponent(filename)}?token=${token}`;
      window.open(downloadUrl, '_blank');

    } catch (error) {
      console.error('Error in download process:', error);
      setError('Failed to download the resource. Please try again later.');
      setTimeout(() => setError(null), 5000); // Clear error after 5 seconds
    } finally {
      setDownloadingResource(null);
    }
  }, [navigate]);

  // --- Fetch Bookmarked Resource IDs --- 
  const fetchBookmarkIds = useCallback(async (token) => {
    try {
      const response = await axios.get(`${apiUtils.getApiBaseUrl()}/users/me/bookmarks/resources/ids`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.data && response.data.bookmarkedResourceIds) {
        setBookmarkedResourceIds(new Set(response.data.bookmarkedResourceIds));
      }
    } catch (err) {
      console.error('Error fetching resource bookmark IDs:', err);
    }
  }, [apiUtils.getApiBaseUrl()]);

  // --- Fetch distinct years from the full database for filter dropdowns ---
  const fetchFilterOptions = useCallback(async (currentFilters) => {
    try {
      const token = apiUtils.getAuthToken();
      if (!token) return;
      const params = new URLSearchParams();
      if (currentFilters.examStage) params.append('examStage', currentFilters.examStage);
      if (currentFilters.subject) params.append('subject', currentFilters.subject);
      if (currentFilters.paperType) params.append('paperType', currentFilters.paperType);
      if (currentFilters.month) params.append('month', currentFilters.month);
      const response = await axios.get(`${apiUtils.getApiBaseUrl()}/resources/filter-options?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.data) {
        setFilterOptions(response.data);
      }
    } catch (err) {
      console.error('Error fetching resource filter options:', err);
    }
  }, [apiUtils.getApiBaseUrl()]);

  // --- Fetch Resources based on filters (with pagination) --- 
  const fetchResources = useCallback(async (token, currentFilters, page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      Object.entries(currentFilters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      params.append('page', String(page));
      params.append('limit', String(resourcesPerPage));

      const response = await axios.get(`${apiUtils.getApiBaseUrl()}/resources`, {
        headers: { 'Authorization': `Bearer ${token}` },
        params: params
      });
      const data = response.data;
      const list = Array.isArray(data) ? data : (data?.data ?? []);
      const pagination = data?.pagination ?? { total: list.length, page: 1, pages: 1, limit: resourcesPerPage };
      setResources(list);
      setServerPagination(pagination);
    } catch (err) {
      console.error('Error fetching resources:', err);
      setError(err.response?.data?.error || err.message || 'Failed to fetch resources');
      setResources([]);
      setServerPagination({ total: 0, page: 1, pages: 1, limit: resourcesPerPage });
    } finally {
      setLoading(false);
    }
  }, [apiUtils.getApiBaseUrl(), resourcesPerPage]);

  // --- Initial Load: auth check, bookmarks, and sync URL to filters when URL changes --- 
  useEffect(() => {
    const token = apiUtils.getAuthToken();
    if (!token) {
      navigate('/login');
    } else {
      fetchBookmarkIds(token);
      const params = new URLSearchParams(location.search);
      const fromUrl = {
        examStage: params.get('examStage') || '',
        subject: params.get('subject') || '',
        bookmarked: params.get('bookmarked') === 'true',
        search: params.get('search') || '',
      };
      setFilters(prev => {
        const next = { ...prev, ...fromUrl };
        fetchFilterOptions(next);
        if (prev.examStage === fromUrl.examStage && prev.subject === fromUrl.subject &&
          prev.bookmarked === fromUrl.bookmarked && prev.search === fromUrl.search) {
          return prev;
        }
        return next;
      });
    }
  }, [navigate, location.search, location.state, fetchBookmarkIds]);

  // --- Fetch on Filter or Page Change --- 
  useEffect(() => {
    const token = apiUtils.getAuthToken();
    if (token) {
      fetchResources(token, filters, currentPage);
      fetchFilterOptions(filters);
    }
  }, [filters, currentPage]);


  // Get unique years for filtering (from full DB via filterOptions)
  const getUniqueYears = () => filterOptions.years;

  // --- Handle Filter Input Change --- 
  const handleFilterChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;

    setFilters(prevFilters => {
      const updatedFilters = { ...prevFilters, [name]: newValue };
      if (name === 'examStage') {
        updatedFilters.subject = '';
      }
      setCurrentPage(1); // Reset page on filter change
      return updatedFilters;
    });
  };

  // --- Handle Bookmark Toggle (direct add/remove, no folder) --- 
  const handleBookmarkToggle = async (resourceId) => {
    const token = apiUtils.getAuthToken();
    if (!token) return navigate('/login');

    const isCurrentlyBookmarked = bookmarkedResourceIds.has(resourceId);

    if (isCurrentlyBookmarked) {
      try {
        const response = await api.delete(`/users/me/bookmarks/resource/${resourceId}`);
        if (response.data?.bookmarkedResourceIds) {
          setBookmarkedResourceIds(new Set(response.data.bookmarkedResourceIds));
          if (filters.bookmarked) {
            setResources(prev => prev.filter(r => r._id !== resourceId));
          }
        }
      } catch (err) {
        console.error('Error removing resource bookmark:', err);
      }
    } else {
      try {
        const response = await api.post(`/users/me/bookmarks/resource/${resourceId}`, {});
        if (response.data?.bookmarkedResourceIds) {
          setBookmarkedResourceIds(new Set(response.data.bookmarkedResourceIds));
        }
      } catch (err) {
        console.error('Error adding resource bookmark:', err);
      }
    }
  };

  // Server returns one page of resources; no client-side slice
  const currentResources = resources;
  const totalPages = serverPagination.pages || 1;

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0 || !bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // --- Handle opening the discussion modal ---
  const handleOpenDiscussion = (resource) => {
    setCurrentDiscussionResource(resource);
    setShowDiscussionModal(true);
  };

  // --- Handle closing the discussion modal ---
  const handleCloseDiscussion = () => {
    setShowDiscussionModal(false);
  };

  return (
    <div className="page-wrapper">
      <Navbar />
      <div className="resources-section">
        <div className="resources-container">
          <h1>Study Resources</h1>

          {error && <div className="error"><p>Error: {error}</p></div>}

          <div className="resources-actions">
            <div className="search-bar">
              <input
                type="text"
                name="search"
                placeholder="Search resources by title/description..."
                value={filters.search}
                onChange={handleFilterChange}
              />
            </div>
          </div>

          {/* --- Filters Section --- */}
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
                    <option value="1 - Accounting">1 - Accounting</option>
                    <option value="2 - Business Laws">2 - Business Laws</option>
                    <option value="3 - Quantitative Aptitude">3 - Quantitative Aptitude</option>
                    <option value="4 - Business Economics">4 - Business Economics</option>
                  </>
                ) : filters.examStage === 'Intermediate' ? (
                  <>
                    <option value="1 - Advanced Accounting">1 - Advanced Accounting</option>
                    <option value="2 - Corporate and Other Laws">2 - Corporate and Other Laws</option>
                    <option value="3 - Taxation">3 - Taxation</option>
                    <option value="4 - Cost and Management Accounting">4 - Cost and Management Accounting</option>
                    <option value="5 - Auditing and Ethics">5 - Auditing and Ethics</option>
                    <option value="6 - Financial Management and Strategic Management">6 - Financial Management and Strategic Management</option>
                  </>
                ) : filters.examStage === 'Final' ? (
                  <>
                    <option value="1 - Financial Reporting">1 - Financial Reporting</option>
                    <option value="2 - Advanced Financial Management">2 - Advanced Financial Management</option>
                    <option value="3 - Advanced Auditing, Assurance and Professional Ethics">3 - Advanced Auditing, Assurance and Professional Ethics</option>
                    <option value="4 - Direct Tax Laws and International Taxation">4 - Direct Tax Laws and International Taxation</option>
                    <option value="5 - Indirect Tax Laws">5 - Indirect Tax Laws</option>
                    <option value="6 - Integrated Business Solutions (Multidisciplinary Case Study)">6 - Integrated Business Solutions (Multidisciplinary Case Study)</option>
                  </>
                ) : (
                  <>
                    <option value="1 - Advanced Accounting">1 - Advanced Accounting</option>
                    <option value="2 - Corporate and Other Laws">2 - Corporate and Other Laws</option>
                    <option value="3 - Taxation">3 - Taxation</option>
                    <option value="4 - Cost and Management Accounting">4 - Cost and Management Accounting</option>
                    <option value="5 - Auditing and Ethics">5 - Auditing and Ethics</option>
                    <option value="6 - Financial Management and Strategic Management">6 - Financial Management and Strategic Management</option>
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
                {getUniqueYears().map(year => <option key={year} value={year}>{year}</option>)}
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
            <div className="filter-group filter-group-bookmark">
              <label htmlFor="resourceBookmarkFilter" className="bookmark-filter-label">
                <input
                  type="checkbox"
                  id="resourceBookmarkFilter"
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
          {loading && <ResourcesListSkeleton />}
          {/* --- Resource List --- */}
          {!loading && resources.length === 0 && !error && (
            <div className="no-resources">
              <p>No resources found matching the selected filters.</p>
            </div>
          )}

          {!loading && resources.length > 0 && (
            <AnimatedList
              items={currentResources}
              showGradients={false}
              enableArrowNavigation={false}
              displayScrollbar={false}
              renderItem={(r) => (
                <div key={r._id} className="resource-card">
                  <div className="resource-top-actions">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleBookmarkToggle(r._id); }}
                      className="bookmark-btn resource-bookmark"
                      title={bookmarkedResourceIds.has(r._id) ? 'Remove Bookmark' : 'Add Bookmark'}
                    >
                      <BookmarkIcon filled={bookmarkedResourceIds.has(r._id)} />
                    </button>
                    <div className="more-menu-wrapper">
                      <MoreMenu onDiscuss={() => handleOpenDiscussion(r)} />
                    </div>
                  </div>

                  <PaperViewHeader
                    title={r.title}
                    paperType={r.paperType}
                    month={r.month}
                    year={r.year}
                    examStage={r.examStage}
                    subject={r.subject}
                    onViewPDF={(e) => { e?.stopPropagation?.(); handleDownload(r); }}
                    isLoading={downloadingResource === r._id}
                  />
                </div>
              )}
            />
          )}

          {/* --- Pagination --- */}
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
      {showDiscussionModal && currentDiscussionResource && (
        <DiscussionModal
          isOpen={showDiscussionModal}
          onClose={handleCloseDiscussion}
          itemType="resource"
          itemId={currentDiscussionResource._id}
          itemTitle={currentDiscussionResource.title}
        />
      )}
    </div>
  );
};

export default Resources;