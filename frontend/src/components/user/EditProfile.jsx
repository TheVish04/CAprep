import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/axiosConfig';
import apiUtils from '../../utils/apiUtils';
import ProfilePlaceholder from '../shared/ProfilePlaceholder';
import './EditProfile.css';

const defaultAvatar = 'https://res.cloudinary.com/demo/image/upload/v1/samples/default-avatar.png';
const hasCustomProfileImage = (url) => url && url !== defaultAvatar;

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
    const [banner, setBanner] = useState(null); // { type: 'success' | 'error', message }
    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const [showChangePhotoModal, setShowChangePhotoModal] = useState(false);
    const [photoActionLoading, setPhotoActionLoading] = useState(false);
    const [emailVerifiedForChange, setEmailVerifiedForChange] = useState(null);
    const [otpSent, setOtpSent] = useState(false);
    const [otpValue, setOtpValue] = useState('');
    const [otpSending, setOtpSending] = useState(false);
    const [otpVerifying, setOtpVerifying] = useState(false);
    const fileInputRef = React.useRef(null);
    const bannerTimeoutRef = React.useRef(null);

    const showBanner = useCallback((type, message) => {
        if (bannerTimeoutRef.current) {
            clearTimeout(bannerTimeoutRef.current);
            bannerTimeoutRef.current = null;
        }
        setError(null);
        setBanner({ type, message });
        if (type === 'success') {
            bannerTimeoutRef.current = setTimeout(() => {
                setBanner(null);
                bannerTimeoutRef.current = null;
            }, 5000);
        }
    }, []);

    useEffect(() => {
        if (userData) {
            setFormData({
                fullName: userData.fullName || '',
                email: userData.email || '',
                profilePicture: userData.profilePicture || ''
            });
            setPreviewUrl(userData.profilePicture || '');
        }
        setEmailVerifiedForChange(null);
        setOtpSent(false);
        setOtpValue('');
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
        if (name === 'email') {
            setEmailVerifiedForChange(null);
            setOtpSent(false);
            setOtpValue('');
        }
    };

    const handlePasswordChange = (e) => {
        const { name, value } = e.target;
        setPasswordData(prev => ({ ...prev, [name]: value }));
    };

    const handleSendEmailChangeOtp = async () => {
        const newEmail = formData.email?.trim();
        if (!newEmail || !/^\S+@\S+\.\S+$/.test(newEmail)) {
            setBanner({ type: 'error', message: 'Please enter a valid email address.' });
            return;
        }
        setOtpSending(true);
        setBanner(null);
        setError(null);
        try {
            await api.post('/users/me/send-email-change-otp', { newEmail });
            setOtpSent(true);
            setOtpValue('');
            showBanner('success', 'OTP sent to your new email. Check your inbox.');
        } catch (err) {
            const msg = err.response?.data?.error || 'Failed to send OTP. Try again later.';
            setError(null);
            setBanner({ type: 'error', message: msg });
        } finally {
            setOtpSending(false);
        }
    };

    const handleVerifyEmailChangeOtp = async () => {
        const newEmail = formData.email?.trim();
        if (!newEmail || !otpValue.trim()) {
            setBanner({ type: 'error', message: 'Enter the OTP you received.' });
            return;
        }
        setOtpVerifying(true);
        setBanner(null);
        setError(null);
        try {
            await api.post('/users/me/verify-email-change-otp', { newEmail, otp: otpValue.trim() });
            setEmailVerifiedForChange(newEmail.toLowerCase());
            showBanner('success', 'Email verified. Click "Save changes" to update your email.');
        } catch (err) {
            const msg = err.response?.data?.error || 'Invalid or expired OTP. Request a new one.';
            setError(null);
            setBanner({ type: 'error', message: msg });
        } finally {
            setOtpVerifying(false);
        }
    };

    const handleFileChange = async (e) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;
        if (showChangePhotoModal) {
            setPhotoActionLoading(true);
            setError(null);
            setBanner(null);
            try {
                const fd = new FormData();
                fd.append('profileImage', selectedFile);
                const res = await api.post('/users/me/profile-image', fd);
                const newUrl = res.data?.profilePicture || defaultAvatar;
                setPreviewUrl(newUrl);
                setFormData(prev => ({ ...prev, profilePicture: newUrl }));
                setFile(null);
                if (onUpdate) onUpdate(res.data);
                setShowChangePhotoModal(false);
                showBanner('success', 'Profile photo updated successfully.');
            } catch (err) {
                const msg = err.response?.data?.error || 'Failed to upload photo.';
                setError(null);
                setBanner({ type: 'error', message: msg });
            } finally {
                setPhotoActionLoading(false);
            }
        } else {
            const fileReader = new FileReader();
            fileReader.onload = () => setPreviewUrl(fileReader.result);
            fileReader.readAsDataURL(selectedFile);
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
        setBanner(null);
        try {
            const res = await api.delete('/users/me/profile-image');
            const url = res.data.profilePicture || defaultAvatar;
            setPreviewUrl(url);
            setFormData(prev => ({ ...prev, profilePicture: url }));
            setFile(null);
            if (onUpdate) onUpdate(res.data);
            setShowChangePhotoModal(false);
            showBanner('success', 'Profile photo removed.');
        } catch (err) {
            const msg = err.response?.data?.error || 'Failed to remove photo.';
            setError(null);
            setBanner({ type: 'error', message: msg });
        } finally {
            setPhotoActionLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setBanner(null);

        const newEmail = formData.email?.trim() || '';
        const currentEmail = (userData?.email || '').toLowerCase();
        const emailChanged = newEmail && newEmail.toLowerCase() !== currentEmail;

        if (emailChanged && emailVerifiedForChange !== newEmail.toLowerCase()) {
            setError('Please verify your new email with OTP before saving. Use "Send OTP" and enter the code sent to your new email.');
            setLoading(false);
            return;
        }

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

            const payload = { fullName: formData.fullName.trim() };
            if (emailChanged && emailVerifiedForChange) {
                payload.email = newEmail;
            }
            const response = await api.put('/users/me', payload);

            if (newPassword && currentPassword) {
                await api.put('/users/me/password', {
                    currentPassword,
                    newPassword
                });
                setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
            }

            showBanner('success', 'Profile updated successfully.');
            if (onUpdate) onUpdate(response.data);
            setEmailVerifiedForChange(null);
            setOtpSent(false);
            setOtpValue('');
            setTimeout(() => {
                if (onClose) onClose();
            }, 1500);
        } catch (err) {
            const msg = err.response?.data?.error || 'Failed to update profile.';
            setError(null);
            setBanner({ type: 'error', message: msg });
        } finally {
            setLoading(false);
        }
    };

    const currentEmail = (userData?.email || '').toLowerCase();
    const newEmailTrimmed = formData.email?.trim().toLowerCase();
    const emailChanged = newEmailTrimmed && newEmailTrimmed !== currentEmail;
    const emailVerified = emailChanged && emailVerifiedForChange === newEmailTrimmed;

    return (
        <div className="edit-profile-modal" role="dialog" aria-labelledby="edit-profile-title">
            <div className="edit-profile-content">
                <header className="edit-profile-header">
                    <h2 id="edit-profile-title">Edit Profile</h2>
                    <button
                        type="button"
                        className="edit-profile-close"
                        onClick={onClose}
                        aria-label="Close"
                        disabled={loading}
                    >
                        ×
                    </button>
                </header>

                {banner && (
                    <div
                        className={`edit-profile-banner edit-profile-banner-${banner.type}`}
                        role="alert"
                    >
                        {banner.message}
                    </div>
                )}
                {error && <div className="edit-profile-error" role="alert">{error}</div>}

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
                    <div className="edit-profile-body">
                        <div className="edit-profile-photo-col">
                            <div className="edit-profile-photo-row">
                                <div className="edit-profile-avatar-wrap">
                                    {hasCustomProfileImage(previewUrl) ? (
                                        <img
                                            src={previewUrl}
                                            alt=""
                                            className="edit-profile-avatar"
                                        />
                                    ) : (
                                        <ProfilePlaceholder className="edit-profile-placeholder" />
                                    )}
                                </div>
                                <button
                                    type="button"
                                    className="edit-profile-change-photo-btn"
                                    onClick={() => setShowChangePhotoModal(true)}
                                >
                                    Change photo
                                </button>
                            </div>
                        </div>
                        <div className="edit-profile-fields-col">
                            <section className="edit-profile-section" aria-labelledby="account-heading">
                                <h3 id="account-heading" className="edit-profile-section-title">Account</h3>
                                <div className="form-group">
                                    <label htmlFor="fullName">Full name</label>
                                    <input
                                        type="text"
                                        id="fullName"
                                        name="fullName"
                                        value={formData.fullName}
                                        onChange={handleChange}
                                        required
                                        autoComplete="name"
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
                                        autoComplete="email"
                                    />
                                    {emailChanged && (
                                        <div className="edit-profile-email-otp">
                                            {!emailVerified ? (
                                                <>
                                                    {!otpSent ? (
                                                        <button
                                                            type="button"
                                                            className="edit-profile-otp-btn"
                                                            onClick={handleSendEmailChangeOtp}
                                                            disabled={otpSending}
                                                        >
                                                            {otpSending ? 'Sending…' : 'Send OTP to new email'}
                                                        </button>
                                                    ) : (
                                                        <>
                                                            <input
                                                                type="text"
                                                                inputMode="numeric"
                                                                maxLength={6}
                                                                placeholder="Enter 6-digit OTP"
                                                                value={otpValue}
                                                                onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, ''))}
                                                                className="edit-profile-otp-input"
                                                            />
                                                            <button
                                                                type="button"
                                                                className="edit-profile-otp-btn"
                                                                onClick={handleVerifyEmailChangeOtp}
                                                                disabled={otpVerifying || otpValue.length < 6}
                                                            >
                                                                {otpVerifying ? 'Verifying…' : 'Verify OTP'}
                                                            </button>
                                                        </>
                                                    )}
                                                </>
                                            ) : (
                                                <span className="edit-profile-email-verified">✓ New email verified. Save changes to update.</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </section>

                            <section className="edit-profile-section edit-profile-password-section" aria-labelledby="password-heading">
                                <h3 id="password-heading" className="edit-profile-section-title">Password (optional)</h3>
                                <div className="form-group">
                                    <label htmlFor="currentPassword">Current password</label>
                                    <input
                                        type="password"
                                        id="currentPassword"
                                        name="currentPassword"
                                        value={passwordData.currentPassword}
                                        onChange={handlePasswordChange}
                                        placeholder="Enter current password"
                                        autoComplete="current-password"
                                        className="edit-profile-password-input"
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="newPassword">New password</label>
                                    <input
                                        type="password"
                                        id="newPassword"
                                        name="newPassword"
                                        value={passwordData.newPassword}
                                        onChange={handlePasswordChange}
                                        placeholder="Enter new password"
                                        autoComplete="new-password"
                                        className="edit-profile-password-input"
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="confirmPassword">Confirm new password</label>
                                    <input
                                        type="password"
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        value={passwordData.confirmPassword}
                                        onChange={handlePasswordChange}
                                        placeholder="Confirm new password"
                                        autoComplete="new-password"
                                        className="edit-profile-password-input"
                                    />
                                </div>
                            </section>
                        </div>
                    </div>

                    <footer className="edit-profile-footer">
                        <button
                            type="button"
                            className="edit-profile-btn edit-profile-btn-secondary"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="edit-profile-btn edit-profile-btn-primary"
                            disabled={loading}
                        >
                            {loading ? 'Saving…' : 'Save changes'}
                        </button>
                    </footer>
                </form>
            </div>

            {showChangePhotoModal && (
                <div
                    className="change-photo-overlay"
                    onClick={() => !photoActionLoading && setShowChangePhotoModal(false)}
                    role="dialog"
                    aria-labelledby="change-photo-title"
                >
                    <div className="change-photo-dialog" onClick={e => e.stopPropagation()}>
                        <h3 id="change-photo-title" className="change-photo-title">Change profile photo</h3>
                        <div className="change-photo-actions">
                            <button
                                type="button"
                                className="change-photo-action change-photo-upload"
                                onClick={handleUploadPhoto}
                                disabled={photoActionLoading}
                            >
                                Upload photo
                            </button>
                            <button
                                type="button"
                                className="change-photo-action change-photo-remove"
                                onClick={handleRemovePhoto}
                                disabled={photoActionLoading}
                            >
                                Remove current photo
                            </button>
                            <button
                                type="button"
                                className="change-photo-action change-photo-cancel"
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
