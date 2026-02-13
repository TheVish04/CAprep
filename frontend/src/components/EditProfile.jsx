import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './EditProfile.css';

const EditProfile = ({ userData, onClose, onUpdate }) => {
    const [formData, setFormData] = useState({
        fullName: '',
        profilePicture: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://caprep.onrender.com';

    useEffect(() => {
        if (userData) {
            setFormData({
                fullName: userData.fullName || '',
                profilePicture: userData.profilePicture || ''
            });
            setPreviewUrl(userData.profilePicture || '');
        }
    }, [userData]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            // Create a preview URL
            const fileReader = new FileReader();
            fileReader.onload = () => {
                setPreviewUrl(fileReader.result);
            };
            fileReader.readAsDataURL(selectedFile);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Authentication required');
            }

            let updatedData = { ...formData };

            // If a file was selected, upload it first
            if (file) {
                const formData = new FormData();
                formData.append('profileImage', file);

                const uploadResponse = await axios.post(
                    `${API_BASE_URL}/api/users/me/profile-image`,
                    formData,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'multipart/form-data'
                        }
                    }
                );

                updatedData.profilePicture = uploadResponse.data.profilePicture;
            }

            // Update user profile
            const response = await axios.put(
                `${API_BASE_URL}/api/users/me`,
                updatedData,
                {
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );

            // Call the onUpdate callback with updated user data
            if (onUpdate) {
                onUpdate(response.data);
            }

            // Close the modal
            if (onClose) {
                onClose();
            }

        } catch (err) {
            console.error('Error updating profile:', err);
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