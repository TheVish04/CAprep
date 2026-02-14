import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/axiosConfig';
import apiUtils from '../utils/apiUtils';
import Navbar from './Navbar';
import EditProfile from './EditProfile';
import ProfilePlaceholder from './ProfilePlaceholder';
import './UserProfile.css';

const defaultAvatar = 'https://res.cloudinary.com/demo/image/upload/v1/samples/default-avatar.png';
const hasCustomProfileImage = (url) => url && url !== defaultAvatar;

const UserProfile = () => {
    const navigate = useNavigate();
    const [userData, setUserData] = useState(null);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteError, setDeleteError] = useState(null);

    useEffect(() => {
        const token = apiUtils.getAuthToken();
        if (!token) {
            navigate('/login');
            return;
        }

        const fetchProfileAndStats = async () => {
            setLoading(true);
            setError(null);
            try {
                const [profileRes, statsRes] = await Promise.all([
                    api.get('/users/me'),
                    api.get('/users/me/stats').catch(() => ({ data: null }))
                ]);
                setUserData(profileRes.data);
                setStats(statsRes.data);
            } catch (err) {
                setError(err.response?.data?.error || "Failed to load profile.");
                if (err.response?.status === 401) {
                    apiUtils.clearAuthToken();
                    navigate('/login', { 
                        state: { 
                            message: 'Your session has expired. Please log in again.',
                            alertType: 'info'
                        } 
                    });
                }
            } finally {
                setLoading(false);
            }
        };
        fetchProfileAndStats();
    }, [navigate]);

    const handleLogout = () => {
        apiUtils.clearAuthToken();
        navigate('/login', { state: { message: 'You have been logged out.', alertType: 'info' } });
    };
    
    const handleDeleteAccount = async () => {
        if (!deletePassword) {
            setDeleteError('Password is required to delete your account');
            return;
        }
        try {
            await api.delete('/users/me', {
                data: { password: deletePassword }
            });
            apiUtils.clearAuthToken();
            navigate('/login', { state: { message: 'Your account has been successfully deleted' } });
        } catch (err) {
            setDeleteError(err.response?.data?.error || 'Failed to delete account. Please try again.');
        }
    };



    if (loading) {
        return (
            <div className="page-wrapper">
                <Navbar />
                <div className="profile-container loading-message">Loading profile...</div>
            </div>
        );
    }
    if (error) {
        return (
            <div className="page-wrapper">
                <Navbar />
                <div className="profile-container error-message">Error: {error}</div>
            </div>
        );
    }
    if (!userData) {
        return (
             <div className="page-wrapper">
                <Navbar />
                <div className="profile-container error-message">Could not load user data.</div>
            </div>
        )
    }
    const bookmarkedQuestionsCount = userData.bookmarkedQuestions?.length || 0;
    const bookmarkedResourcesCount = userData.bookmarkedResources?.length || 0;
    const quizCount = stats?.quizCount ?? 0;
    const totalStudyHours = stats?.totalStudyHours ?? 0;
    const subjectStrengths = stats?.subjectStrengths ?? [];
    const lastQuizAt = stats?.lastQuizAt;
    const lastStudyAt = stats?.lastStudyAt;

    return (
        <div className="page-wrapper user-profile-page">
            <Navbar />
            <div className="profile-container">
                <h1>My Profile</h1>

                {/* Quick actions */}
                <div className="profile-quick-actions card">
                    <h2>Quick actions</h2>
                    <div className="quick-actions-grid">
                        <Link to="/dashboard" className="quick-action-link">Dashboard</Link>
                        <Link to="/chat" className="quick-action-link">Chat</Link>
                        <Link to="/quiz" className="quick-action-link">Quiz</Link>
                        <Link to="/questions" className="quick-action-link">Questions</Link>
                        <Link to="/resources" className="quick-action-link">Resources</Link>
                    </div>
                </div>

                <div className="profile-details card">
                    <div className="profile-header">
                        <div className="profile-picture-container">
                            {hasCustomProfileImage(userData.profilePicture) ? (
                                <img
                                    src={userData.profilePicture}
                                    alt="Profile"
                                    className="profile-picture"
                                />
                            ) : (
                                <ProfilePlaceholder className="profile-picture-placeholder" />
                            )}
                        </div>
                        <div className="profile-info">
                            <h2>Account Information</h2>
                            <p><strong>Name:</strong> {userData.fullName}</p>
                            <p><strong>Email:</strong> {userData.email}</p>
                            <p><strong>Member Since:</strong> {new Date(userData.createdAt).toLocaleDateString()}</p>
                            <div className="profile-actions-inline">
                                <button className="edit-profile-btn" onClick={() => setShowEditModal(true)}>Edit Profile</button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats row */}
                <div className="profile-stats-row">
                    <div className="profile-stat-card card">
                        <span className="profile-stat-value">{quizCount}</span>
                        <span className="profile-stat-label">Quizzes taken</span>
                        {lastQuizAt && (
                            <span className="profile-stat-meta">Last: {new Date(lastQuizAt).toLocaleDateString()}</span>
                        )}
                    </div>
                    <div className="profile-stat-card card">
                        <span className="profile-stat-value">{totalStudyHours}h</span>
                        <span className="profile-stat-label">Study hours</span>
                        {lastStudyAt && (
                            <span className="profile-stat-meta">Last: {new Date(lastStudyAt).toLocaleDateString()}</span>
                        )}
                    </div>
                    <div className="profile-stat-card card">
                        <span className="profile-stat-value">{bookmarkedQuestionsCount + bookmarkedResourcesCount}</span>
                        <span className="profile-stat-label">Bookmarks</span>
                        <span className="profile-stat-meta">{bookmarkedQuestionsCount} Q · {bookmarkedResourcesCount} R</span>
                    </div>
                </div>

                {subjectStrengths.length > 0 && (
                    <div className="profile-subject-strengths card">
                        <h2>Subject strengths</h2>
                        <div className="subject-strengths-list">
                            {subjectStrengths
                                .slice()
                                .sort((a, b) => (b.strengthScore || 0) - (a.strengthScore || 0))
                                .map((s) => (
                                    <div key={s.subject} className="subject-strength-item">
                                        <span className="subject-strength-name">{s.subject}</span>
                                        <div className="subject-strength-bar-wrap">
                                            <div 
                                                className="subject-strength-bar" 
                                                style={{ width: `${s.strengthScore || 0}%` }} 
                                            />
                                        </div>
                                        <span className="subject-strength-score">{s.strengthScore}%</span>
                                    </div>
                                ))}
                        </div>
                    </div>
                )}

                <div className="profile-summary card">
                    <h2>My Content</h2>
                    <div className="summary-item">
                        <p><strong>Bookmarked Questions:</strong> {bookmarkedQuestionsCount}</p>
                        {bookmarkedQuestionsCount > 0 && (
                            <Link to="/questions?bookmarked=true" className="profile-link">View Questions</Link>
                        )}
                    </div>
                    <div className="summary-item">
                        <p><strong>Bookmarked Resources:</strong> {bookmarkedResourcesCount}</p>
                        {bookmarkedResourcesCount > 0 && (
                            <Link to="/resources?bookmarked=true" className="profile-link">View Resources</Link>
                        )}
                    </div>
                    <div className="summary-item">
                         <Link to="/quiz-history" className="profile-link full-width-link">View My Quiz History</Link>
                    </div>
                    <div className="summary-item">
                         <Link to="/bookmarks" className="profile-link full-width-link">Manage Bookmark Folders</Link>
                    </div>
                </div>
                <div className="profile-actions">
                    <button onClick={handleLogout} className="logout-button">Logout</button>
                    <button onClick={() => setShowDeleteConfirm(true)} className="delete-account-button">Delete Account</button>
                </div>
                {showEditModal && (
                    <EditProfile 
                        userData={userData} 
                        onClose={() => setShowEditModal(false)} 
                        onUpdate={(updatedData) => {
                            setUserData(updatedData);
                            setShowEditModal(false);
                        }} 
                    />
                )}
                {/* Delete Account Modal */}
                {showDeleteConfirm && (
                    <div className="modal-overlay">
                        <div className="modal-content delete-confirmation-modal"> {/* Added specific class */}
                            <h2>Confirm Account Deletion</h2>
                            <p>This action is irreversible. Please enter your password to confirm:</p>
                            <input 
                                type="password" 
                                value={deletePassword} 
                                onChange={e => setDeletePassword(e.target.value)} 
                                placeholder="Password" 
                                className="delete-password-input" // Added class
                            />
                            {deleteError && <div className="error-message">{deleteError}</div>}
                            <div className="modal-actions">
                                <button onClick={handleDeleteAccount} className="delete-account-button confirm-delete-btn">Delete</button> {/* Added specific class */}
                                <button onClick={() => setShowDeleteConfirm(false)} className="cancel-delete-button">Cancel</button> {/* Added class */}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserProfile;