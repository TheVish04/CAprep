import React, { useState, useEffect } from 'react';
import api from '../utils/axiosConfig';
import apiUtils from '../utils/apiUtils';
import './EditProfile.css';

const defaultAvatar = 'https://res.cloudinary.com/demo/image/upload/v1/samples/default-avatar.png';

const EditProfile = ({ userData, onClose, onUpdate }) => {
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        profilePicture: ''
    });
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const [showChangePhotoModal, setShowChangePhotoModal] = useState(false);
    const [photoActionLoading, setPhotoActionLoading] = useState(false);
    const fileInputRef = React.useRef(null);

    useEffect(() => {
        if (userData) {
            setFormData({
                fullName: userData.fullName || '',
                email: userData.email || '',
                profilePicture: userData.profilePicture || ''
            });
            setPreviewUrl(userData.profilePicture || '');
        }
    }, [userData]);

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePasswordChange = (e) => {
        const { name, value } = e.target;
        setPasswordData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = async (e) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;
        const fileReader = new FileReader();
        fileReader.onload = () => setPreviewUrl(fileReader.result);
        fileReader.readAsDataURL(selectedFile);
        if (showChangePhotoModal) {
            setPhotoActionLoading(true);
            setError(null);
            try {
                const fd = new FormData();
                fd.append('profileImage', selectedFile);
                const res = await api.post('/users/me/profile-image', fd);
                setPreviewUrl(res.data.profilePicture || defaultAvatar);
                setFormData(prev => ({ ...prev, profilePicture: res.data.profilePicture || '' }));
                setFile(null);
                if (onUpdate) onUpdate(res.data);
                setShowChangePhotoModal(false);
            } catch (err) {
                setError(err.response?.data?.error || 'Failed to upload photo');
            } finally {
                setPhotoActionLoading(false);
            }
        } else {
            setFile(selectedFile);
        }
        e.target.value = '';
    };

    const handleUploadPhoto = () => {
        fileInputRef.current?.click();
    };

    const handleRemovePhoto = async () => {
        setPhotoActionLoading(true);
        setError(null);
        try {
            const res = await api.delete('/users/me/profile-image');
            const url = res.data.profilePicture || defaultAvatar;
            setPreviewUrl(url);
            setFormData(prev => ({ ...prev, profilePicture: url }));
            setFile(null);
            if (onUpdate) onUpdate(res.data);
            setShowChangePhotoModal(false);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to remove photo');
        } finally {
            setPhotoActionLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { newPassword, confirmPassword, currentPassword } = passwordData;
        if (newPassword || confirmPassword || currentPassword) {
            if (!currentPassword || !newPassword) {
                setError('To change password, enter current password and new password.');
                setLoading(false);
                return;
            }
            if (newPassword !== confirmPassword) {
                setError('New password and confirmation do not match.');
                setLoading(false);
                return;
            }
        }

        try {
            if (!apiUtils.getAuthToken()) {
                throw new Error('Authentication required');
            }

            if (file) {
                const fd = new FormData();
                fd.append('profileImage', file);
                await api.post('/users/me/profile-image', fd);
            }

            const response = await api.put('/users/me', {
                fullName: formData.fullName.trim(),
                email: formData.email?.trim() || undefined
            });

            if (newPassword && currentPassword) {
                await api.put('/users/me/password', {
                    currentPassword,
                    newPassword
                });
                setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
            }

            if (onUpdate) onUpdate(response.data);
            if (onClose) onClose();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="edit-profile-modal">
            <div className="edit-profile-content">
                <h2>Edit Profile</h2>
                {error && <div className="error-message">{error}</div>}
                <input
                    ref={fileInputRef}
                    type="file"
                    id="profilePicture"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="edit-profile-hidden-file-input"
                    aria-hidden="true"
                />
                <form onSubmit={handleSubmit} className="edit-profile-form">
                    <div className="edit-profile-left">
                        <div className="profile-photo-card">
                            <div className="profile-photo-card-avatar-wrap">
                                <img
                                    src={previewUrl || defaultAvatar}
                                    alt="Profile"
                                    className="profile-photo-card-avatar"
                                />
                            </div>
                            <div className="profile-photo-card-info">
                                <span className="profile-photo-card-name">{formData.fullName || 'Name'}</span>
                                <span className="profile-photo-card-meta">{formData.email || ''}</span>
                            </div>
                            <button
                                type="button"
                                className="profile-photo-card-change-btn"
                                onClick={() => setShowChangePhotoModal(true)}
                            >
                                Change photo
                            </button>
                        </div>
                    </div>
                    <div className="edit-profile-right">
                        <div className="form-group">
                            <label htmlFor="fullName">Full Name</label>
                            <input
                                type="text"
                                id="fullName"
                                name="fullName"
                                value={formData.fullName}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="email">Email</label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="form-group edit-profile-password-section">
                            <span className="form-section-label">Change password (optional)</span>
                            <input
                                type="password"
                                name="currentPassword"
                                value={passwordData.currentPassword}
                                onChange={handlePasswordChange}
                                placeholder="Current password"
                                autoComplete="current-password"
                                className="edit-profile-password-input"
                            />
                            <input
                                type="password"
                                name="newPassword"
                                value={passwordData.newPassword}
                                onChange={handlePasswordChange}
                                placeholder="New password"
                                autoComplete="new-password"
                                className="edit-profile-password-input"
                            />
                            <input
                                type="password"
                                name="confirmPassword"
                                value={passwordData.confirmPassword}
                                onChange={handlePasswordChange}
                                placeholder="Confirm new password"
                                autoComplete="new-password"
                                className="edit-profile-password-input"
                            />
                        </div>
                        <div className="form-actions">
                            <button
                                type="button"
                                className="cancel-button"
                                onClick={onClose}
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="save-button"
                                disabled={loading}
                            >
                                {loading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            {showChangePhotoModal && (
                <div className="change-photo-modal-overlay" onClick={() => !photoActionLoading && setShowChangePhotoModal(false)}>
                    <div className="change-photo-modal" onClick={e => e.stopPropagation()}>
                        <h3 className="change-photo-modal-title">Change Profile Photo</h3>
                        <div className="change-photo-modal-actions">
                            <button
                                type="button"
                                className="change-photo-option change-photo-upload"
                                onClick={handleUploadPhoto}
                                disabled={photoActionLoading}
                            >
                                Upload Photo
                            </button>
                            <button
                                type="button"
                                className="change-photo-option change-photo-remove"
                                onClick={handleRemovePhoto}
                                disabled={photoActionLoading}
                            >
                                Remove Current Photo
                            </button>
                            <button
                                type="button"
                                className="change-photo-option change-photo-cancel"
                                onClick={() => !photoActionLoading && setShowChangePhotoModal(false)}
                                disabled={photoActionLoading}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EditProfile;