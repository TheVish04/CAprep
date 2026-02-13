import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import './Resources.css';
import axios from 'axios';
import MoreMenu from './MoreMenu';
import DiscussionModal from './DiscussionModal';
import BookmarkFolderSelector from './BookmarkFolderSelector';

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
  const [filters, setFilters] = useState({
    subject: '',
    paperType: '',
    year: '',
    month: '',
    examStage: '',
    search: '',
    bookmarked: false,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [serverPagination, setServerPagination] = useState({ total: 0, page: 1, pages: 1, limit: 10 });
  const [bookmarkedResourceIds, setBookmarkedResourceIds] = useState(new Set());
  const resourcesPerPage = 10;
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://caprep.onrender.com';
  const [currentDiscussionResource, setCurrentDiscussionResource] = useState(null);
  const [showDiscussionModal, setShowDiscussionModal] = useState(false);
  const [showBookmarkFolderSelector, setShowBookmarkFolderSelector] = useState(false);
  const [resourceToBookmark, setResourceToBookmark] = useState(null);

  // Download a resource and increment download count
  const handleDownload = useCallback(async (resource) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return navigate('/login');
      
      console.log('Starting download process for resource:', resource.title);
      setDownloadingResource(resource._id);
      
      // First track the resource view
      try {
        await axios.post(`${API_BASE_URL}/dashboard/resource-view`, {
          resourceId: resource._id
        }, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (viewError) {
        console.error('Failed to track resource view:', viewError);
        // Continue even if view tracking fails
      }
      
      // Then increment the download count
      try {
        await axios.post(`${API_BASE_URL}/resources/${resource._id}/download`, {}, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (countError) {
        console.error('Failed to increment download count:', countError);
        // Continue even if count increment fails
      }
      
      // Simplest and most reliable method: just open the PDF in a new tab
      // This allows the browser to handle the PDF natively
      window.open(resource.fileUrl, '_blank');
      
    } catch (error) {
      console.error('Error in download process:', error);
      setError('Failed to download the resource. Please try again later.');
      setTimeout(() => setError(null), 5000); // Clear error after 5 seconds
    } finally {
      setDownloadingResource(null);
    }
  }, [API_BASE_URL, navigate]);

  // --- Fetch Bookmarked Resource IDs --- 
  const fetchBookmarkIds = useCallback(async (token) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/users/me/bookmarks/resources/ids`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.data && response.data.bookmarkedResourceIds) {
        setBookmarkedResourceIds(new Set(response.data.bookmarkedResourceIds));
      }
    } catch (err) {
      console.error('Error fetching resource bookmark IDs:', err);
    }
  }, [API_BASE_URL]);

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

      const response = await axios.get(`${API_BASE_URL}/resources`, {
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
  }, [API_BASE_URL, resourcesPerPage]);

  // --- Initial Load --- 
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login'); // Redirect to login if no token
    } else {
      fetchBookmarkIds(token);
      
      // Check if we have state from the dashboard or other navigation
      if (location.state?.preSelectedResource) {
        // Will be processed separately to show the specific resource
        console.log('Pre-selected resource ID:', location.state.preSelectedResource);
      }
      
      // Set search query from navigation state if available
      if (location.state?.searchQuery) {
        setFilters(prev => ({
          ...prev,
          search: location.state.searchQuery
        }));
      }
      
      // Apply URL params to initial filters before fetching
      const params = new URLSearchParams(location.search);
      const initialFilters = { ...filters }; // Start with default filters
      if (params.get('examStage')) initialFilters.examStage = params.get('examStage');
      if (params.get('subject')) initialFilters.subject = params.get('subject');
      if (params.get('bookmarked') === 'true') initialFilters.bookmarked = true;
      // Update state once, triggering the fetch effect
      setFilters(initialFilters);
    }
  }, [navigate, location.search, location.state, fetchBookmarkIds]); // Rerun if location search or state changes
  
  // --- Load specific resource when preSelectedResource is present ---
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token && location.state?.preSelectedResource) {
      const resourceId = location.state.preSelectedResource;
      
      // Find the resource in the current list
      const resource = resources.find(r => r._id === resourceId);
      
      if (resource) {
        // Resource is already loaded, so we can handle it directly
        handleDownload(resource);
        
        // Clear the preSelectedResource from location state to prevent 
        // the PDF from opening again when filters change
        navigate(location.pathname, { 
          replace: true, 
          state: { 
            ...location.state,
            preSelectedResource: null
          } 
        });
      } else if (!loading) {
        // Resource not in current list, fetch it specifically
        const fetchSpecificResource = async () => {
          try {
            const response = await axios.get(`${API_BASE_URL}/resources/${resourceId}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.data) {
              // We have the resource data, now open it
              handleDownload(response.data);
              
              // Clear the preSelectedResource from location state
              navigate(location.pathname, { 
                replace: true, 
                state: { 
                  ...location.state,
                  preSelectedResource: null
                } 
              });
            }
          } catch (err) {
            console.error('Error fetching specific resource:', err);
            setError('Could not load the requested resource.');
          }
        };
        
        fetchSpecificResource();
      }
    }
  }, [location.state?.preSelectedResource, navigate, handleDownload, API_BASE_URL]); // Only depend on preSelectedResource, not resources or loading

  // --- Fetch on Filter or Page Change --- 
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchResources(token, filters, currentPage);
    }
  }, [filters, currentPage]);


  // Get unique years for filtering
  const getUniqueYears = () => {
    const uniqueYears = [...new Set(resources.map((r) => r.year))];
    return uniqueYears.sort((a, b) => b - a); // Sort descending
  };

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

  // --- Handle Bookmark Toggle --- 
  const handleBookmarkToggle = async (resourceId) => {
    const token = localStorage.getItem('token');
    if (!token) return navigate('/login');

    const isCurrentlyBookmarked = bookmarkedResourceIds.has(resourceId);
    
    if (isCurrentlyBookmarked) {
      // If already bookmarked, remove the bookmark
      const url = `${API_BASE_URL}/users/me/bookmarks/resource/${resourceId}`;
      
      try {
        const response = await axios.delete(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.data && response.data.bookmarkedResourceIds) {
          // Update the bookmarked IDs in state
          const newBookmarkedIds = new Set(response.data.bookmarkedResourceIds);
          setBookmarkedResourceIds(newBookmarkedIds);
          
          // If the bookmarked filter is active, remove this resource from the current list immediately
          if (filters.bookmarked) {
            setResources(prevResources => 
              prevResources.filter(resource => resource._id !== resourceId)
            );
          }
        }
      } catch (err) {
        console.error('Error removing resource bookmark:', err);
        alert(err.response?.data?.error || 'Failed to remove bookmark');
      }
    } else {
      // If not bookmarked, show the folder selector
      const resource = resources.find(r => r._id === resourceId);
      setResourceToBookmark(resource);
      setShowBookmarkFolderSelector(true);
    }
  };
  
  // Handle successful bookmark to folder
  const handleBookmarkSuccess = async () => {
    // Refresh bookmark IDs
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const response = await axios.get(`${API_BASE_URL}/users/me/bookmarks/resources/ids`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.data && response.data.bookmarkedResourceIds) {
          setBookmarkedResourceIds(new Set(response.data.bookmarkedResourceIds));
          
          // If we have a resource that was just bookmarked, make sure it's in the set
          if (resourceToBookmark) {
            const updatedSet = new Set(response.data.bookmarkedResourceIds);
            updatedSet.add(resourceToBookmark._id);
            setBookmarkedResourceIds(updatedSet);
          }
        }
      } catch (err) {
        console.error('Error refreshing resource bookmark IDs:', err);
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
          
          {loading && <div className="loading-indicator">Loading resources...</div>}
          {error && <div className="error"><p>Error: {error}</p></div>}

          <div className="resources-actions">
            <div className="search-bar">
              <input
                type="text"
                name="search"
                placeholder="Search resources by title/description..."
                value={filters.search}
                onChange={handleFilterChange}
                disabled={loading}
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
                    <option value="Advanced Accounting">Advanced Accounting</option>
                    <option value="Corporate Laws">Corporate Laws</option>
                    <option value="Taxation">Taxation</option>
                    <option value="Cost & Management">Cost & Management</option>
                    <option value="Auditing">Auditing</option>
                    <option value="Financial Management">Financial Management</option>
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

          {/* --- Resource List --- */}
          {!loading && resources.length === 0 && !error && (
            <div className="no-resources">
              <p>No resources found matching the selected filters.</p>
            </div>
          )}

          {!loading && resources.length > 0 && (
            <div className="resources-list">
              {currentResources.map((r) => (
                <div key={r._id} className="resource-card">
                  <div className="resource-top-actions">
                    <button 
                      onClick={() => handleBookmarkToggle(r._id)} 
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
                    onViewPDF={() => handleDownload(r)}
                    isLoading={downloadingResource === r._id}
                  />
                </div>
              ))}
            </div>
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
      
      {/* Bookmark Folder Selector Modal */}
      {showBookmarkFolderSelector && resourceToBookmark && (
        <BookmarkFolderSelector
          itemId={resourceToBookmark._id}
          itemType="resource"
          onClose={() => {
            setShowBookmarkFolderSelector(false);
            setResourceToBookmark(null);
          }}
          onSuccess={handleBookmarkSuccess}
        />
      )}
    </div>
  );
};

export default Resources;