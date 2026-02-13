import React, { useState, useEffect } from 'react';
import api from '../utils/axiosConfig';
import './UserProfile.css'; // Reuse existing styles
import './BookmarkFolderSelector.css'; // Add specific styles for this component

const BookmarkFolderSelector = ({ itemId, itemType, onClose, onSuccess }) => {
    const [folders, setFolders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedFolderId, setSelectedFolderId] = useState('');
    const [newFolderName, setNewFolderName] = useState('');
    const [showCreateNew, setShowCreateNew] = useState(false);
    const [note, setNote] = useState('');
    
    // Fetch user's bookmark folders
    useEffect(() => {
        const fetchFolders = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await api.get('/api/users/me/bookmark-folders');
                // Filter folders by type (question or resource)
                const filteredFolders = res.data.bookmarkFolders.filter(folder => folder.type === itemType);
                setFolders(filteredFolders || []);
            } catch (err) {
                setError(err.response?.data?.error || 'Failed to load bookmark folders');
            } finally {
                setLoading(false);
            }
        };
        fetchFolders();
    }, [itemType]);

    // Handle creating a new folder
    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        
        try {
            setLoading(true);
            const res = await api.post('/api/users/me/bookmark-folders', { 
                name: newFolderName, 
                type: itemType 
            });
            setFolders(res.data.bookmarkFolders.filter(folder => folder.type === itemType));
            // Select the newly created folder
            const newFolder = res.data.bookmarkFolders.find(f => f.name === newFolderName && f.type === itemType);
            if (newFolder) setSelectedFolderId(newFolder._id);
            setNewFolderName('');
            setShowCreateNew(false);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create folder');
        } finally {
            setLoading(false);
        }
    };

    // Handle adding bookmark to selected folder
    const handleAddToFolder = async () => {
        // If in create folder view and folder name is provided, create folder first
        if (showCreateNew && newFolderName.trim()) {
            try {
                setLoading(true);
                const res = await api.post('/api/users/me/bookmark-folders', { 
                    name: newFolderName, 
                    type: itemType 
                });
                
                // Get the newly created folder
                const newFolder = res.data.bookmarkFolders.find(f => f.name === newFolderName.trim() && f.type === itemType);
                if (newFolder) {
                    // Set the selected folder to the newly created one
                    setSelectedFolderId(newFolder._id);
                    
                    // Add the bookmark to the new folder
                    await api.post(`/api/users/me/bookmark-folders/${newFolder._id}/items`, {
                        itemId,
                        note
                    });
                    
                    // Also add to general bookmarks based on item type
                    if (itemType === 'question') {
                        await api.post(`/api/users/me/bookmarks/${itemId}`, {});
                    } else if (itemType === 'resource') {
                        await api.post(`/api/users/me/bookmarks/resource/${itemId}`, {});
                    }
                    
                    onSuccess && onSuccess();
                    onClose && onClose();
                } else {
                    setError('Failed to create folder');
                }
            } catch (err) {
                setError(err.response?.data?.error || 'Failed to create folder and add bookmark');
            } finally {
                setLoading(false);
            }
            return;
        }
        
        // Regular flow for existing folder
        if (!selectedFolderId) {
            setError('Please select a folder');
            return;
        }
        
        try {
            setLoading(true);
            // Add the bookmark to the folder
            await api.post(`/api/users/me/bookmark-folders/${selectedFolderId}/items`, {
                itemId,
                note
            });
            
            // Also add to general bookmarks based on item type
            if (itemType === 'question') {
                await api.post(`/api/users/me/bookmarks/${itemId}`, {});
            } else if (itemType === 'resource') {
                await api.post(`/api/users/me/bookmarks/resource/${itemId}`, {});
            }
            
            onSuccess && onSuccess();
            onClose && onClose();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to add bookmark to folder');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="delete-confirmation-modal" style={{ maxWidth: '500px' }}>
                <h2>Add to Bookmark Folder</h2>
                
                {error && <div className="error-message">{error}</div>}
                
                {loading ? (
                    <div className="loading-message">Loading folders...</div>
                ) : (
                    <>
                        {!showCreateNew ? (
                            <>
                                {folders.length === 0 ? (
                                    <p>You don't have any {itemType} bookmark folders yet.</p>
                                ) : (
                                    <>
                                        <p>Select a folder to add this {itemType}:</p>
                                        <select 
                                            value={selectedFolderId} 
                                            onChange={(e) => setSelectedFolderId(e.target.value)}
                                            className="delete-password-input"
                                            style={{ marginBottom: '15px' }}
                                        >
                                            <option value="">-- Select a folder --</option>
                                            {folders.map(folder => (
                                                <option key={folder._id} value={folder._id}>
                                                    {folder.name}
                                                </option>
                                            ))}
                                        </select>
                                    </>
                                )}
                                
                                <div className="bookmark-note-section">
                                    <textarea
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                        placeholder="Add a note about this bookmark (optional)"
                                        maxLength={1000}
                                    />
                                </div>
                                
                                <button 
                                    onClick={() => setShowCreateNew(true)}
                                    className="create-folder-btn"
                                >
                                    Create New Folder
                                </button>
                            </>
                        ) : (
                            <>
                                <p>Create a new {itemType} bookmark folder:</p>
                                <input 
                                    type="text" 
                                    value={newFolderName} 
                                    onChange={(e) => setNewFolderName(e.target.value)} 
                                    placeholder="Folder name" 
                                    maxLength={100}
                                    className="delete-password-input"
                                />
                                <div className="bookmark-note-section">
                                    <textarea
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                        placeholder="Add a note about this bookmark (optional)"
                                        maxLength={1000}
                                    />
                                </div>
                                <button 
                                    onClick={handleCreateFolder} 
                                    className="confirm-delete-btn"
                                    disabled={!newFolderName.trim()}
                                    style={{ marginBottom: '15px' }}
                                >
                                    Create Folder
                                </button>
                                <button 
                                    onClick={() => setShowCreateNew(false)}
                                    className="cancel-delete-button"
                                >
                                    Back to Folder Selection
                                </button>
                            </>
                        )}
                        
                        <div className="modal-actions">
                            <button 
                                onClick={handleAddToFolder} 
                                className="add-to-folder-btn"
                                disabled={loading || (!selectedFolderId && !showCreateNew) || (showCreateNew && !newFolderName.trim())}
                            >
                                Add to Folder
                            </button>
                            <button onClick={onClose} className="cancel-button">Cancel</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default BookmarkFolderSelector;