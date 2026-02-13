import React, { useState, useEffect } from 'react';
import api from '../utils/axiosConfig';
import apiUtils from '../utils/apiUtils';
import './EditProfile.css';

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

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            const fileReader = new FileReader();
            fileReader.onload = () => setPreviewUrl(fileReader.result);
            fileReader.readAsDataURL(selectedFile);
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
                
                <form onSubmit={handleSubmit}>
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

                    <div className="form-group">
                        <label htmlFor="profilePicture">Profile Picture</label>
                        <div className="profile-picture-preview">
                            {previewUrl && (
                                <img src={previewUrl} alt="Profile Preview" />
                            )}
                        </div>
                        <input
                            type="file"
                            id="profilePicture"
                            name="profilePicture"
                            onChange={handleFileChange}
                            accept="image/*"
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
                </form>
            </div>
        </div>
    );
};

export default EditProfile;