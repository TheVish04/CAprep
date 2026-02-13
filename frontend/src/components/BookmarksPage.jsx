import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/axiosConfig';
import Navbar from './Navbar';
import './UserProfile.css'; // Reuse existing styles
import './BookmarksPage.css'; // Use dedicated styles
import './BookmarkFolderSelector.css'; // Reuse existing styles

const BookmarksPage = () => {
    const [bookmarkFolders, setBookmarkFolders] = useState([]);
    const [folderLoading, setFolderLoading] = useState(false);
    const [folderError, setFolderError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [newFolderName, setNewFolderName] = useState('');
    const [newFolderType, setNewFolderType] = useState('question');
    const [selectedFolder, setSelectedFolder] = useState(null);
    const [editingFolderId, setEditingFolderId] = useState(null);
    const [editingFolderName, setEditingFolderName] = useState('');
    const [noteEdit, setNoteEdit] = useState({}); // { [itemId]: note }

    useEffect(() => {
        const fetchFolders = async () => {
            setFolderLoading(true);
            setFolderError(null);
            try {
                const res = await api.get('/api/users/me/bookmark-folders');
                setBookmarkFolders(res.data.bookmarkFolders || []);
            } catch (err) {
                setFolderError(err.response?.data?.error || 'Failed to load bookmark folders');
            } finally {
                setFolderLoading(false);
            }
        };
        fetchFolders();
    }, []);

    // --- Bookmark Folder CRUD ---
    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        try {
            setFolderLoading(true);
            const res = await api.post('/api/users/me/bookmark-folders', { name: newFolderName, type: newFolderType });
            setBookmarkFolders(res.data.bookmarkFolders);
            setNewFolderName('');
        } catch (err) {
            setFolderError(err.response?.data?.error || 'Failed to create folder');
        } finally {
            setFolderLoading(false);
        }
    };

    const handleRenameFolder = async (folderId) => {
        if (!editingFolderName.trim()) return;
        try {
            setFolderLoading(true);
            const res = await api.put(`/api/users/me/bookmark-folders/${folderId}`, { name: editingFolderName });
            setBookmarkFolders(res.data.bookmarkFolders);
            setEditingFolderId(null);
            setEditingFolderName('');
        } catch (err) {
            setFolderError(err.response?.data?.error || 'Failed to rename folder');
        } finally {
            setFolderLoading(false);
        }
    };

    const handleDeleteFolder = async (folderId) => {
        if (!window.confirm('Delete this folder and all its bookmarks?')) return;
        try {
            setFolderLoading(true);
            setFolderError(null); // Clear any previous errors
            
            // Find the folder to be deleted (for error handling)
            const folderToDelete = bookmarkFolders.find(f => f._id === folderId);
            if (!folderToDelete) {
                setFolderError('Folder not found');
                setFolderLoading(false);
                return;
            }
            
            const res = await api.delete(`/api/users/me/bookmark-folders/${folderId}`);
            
            // Update the local state with the response data
            setBookmarkFolders(res.data.bookmarkFolders);
            
            // If the currently selected folder is being deleted, clear the selection
            if (selectedFolder && selectedFolder._id === folderId) {
                setSelectedFolder(null);
            }
            
        } catch (err) {
            console.error('Delete folder error:', err);
            // Provide a more specific error message
            if (err.response?.status === 404) {
                setFolderError(`Folder "${bookmarkFolders.find(f => f._id === folderId)?.name || ''}" not found or already deleted`);
            } else {
                setFolderError(err.response?.data?.error || 'Failed to delete bookmark folder');
            }
        } finally {
            setFolderLoading(false);
        }
    };

    // --- Bookmark Note Edit ---
    const handleNoteChange = (itemId, note) => {
        setNoteEdit(prev => ({ ...prev, [itemId]: note }));
    };

    const handleSaveNote = async (folderId, itemId) => {
        try {
            setFolderLoading(true);
            const note = noteEdit[itemId] || '';
            const res = await api.put(`/api/users/me/bookmark-folders/${folderId}/items/${itemId}/note`, { note });
            setBookmarkFolders(folders => folders.map(f => f._id === folderId ? res.data.folder : f));
            setNoteEdit(prev => ({ ...prev, [itemId]: undefined }));
        } catch (err) {
            setFolderError(err.response?.data?.error || 'Failed to update note');
        } finally {
            setFolderLoading(false);
        }
    };

    return (
        <div className="page-wrapper user-profile-page">
            <Navbar />
            <div className="profile-container">
                <h1 className="bookmarks-title">My Bookmarks</h1>
                <div className="profile-bookmark-folders card bookmark-container">
                    <h2>Bookmark Folders</h2>
                    {folderError && <div className="error-message">{folderError}</div>}
                    
                    <div className="bookmark-controls">
                        <div className="search-container">
                            <input 
                                type="text" 
                                placeholder="Search folders..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="search-input"
                            />
                        </div>
                    
                    <div className="bookmark-folder-create">
                        <input 
                            type="text" 
                            value={newFolderName} 
                            onChange={e => setNewFolderName(e.target.value)} 
                            placeholder="New folder name" 
                            maxLength={100} 
                        />
                        <select 
                            value={newFolderType} 
                            onChange={e => setNewFolderType(e.target.value)}
                        >
                            <option value="question">Questions</option>
                            <option value="resource">Resources</option>
                        </select>
                        <button 
                            onClick={handleCreateFolder} 
                            disabled={folderLoading || !newFolderName.trim()}
                            className="create-folder-btn"
                        >
                            Create Folder
                        </button>
                    </div>
                    </div>

                    {folderLoading && !selectedFolder ? (
                        <div className="loading-message">Loading folders...</div>
                    ) : (
                        <div className="bookmark-folder-list">
                            {bookmarkFolders.length === 0 && <div className="empty-state">No bookmark folders yet. Create your first folder above!</div>}
                            {bookmarkFolders
                                .filter(folder => folder.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                .map(folder => (
                                <div key={folder._id} className={`bookmark-folder-item${selectedFolder && selectedFolder._id === folder._id ? ' selected' : ''}`}> 
                                    {editingFolderId === folder._id ? (
                                        <div className="folder-edit-mode">
                                            <input 
                                                type="text" 
                                                value={editingFolderName} 
                                                onChange={e => setEditingFolderName(e.target.value)} 
                                                maxLength={100} 
                                            />
                                            <div className="folder-edit-actions">
                                                <button 
                                                    onClick={() => handleRenameFolder(folder._id)} 
                                                    disabled={folderLoading || !editingFolderName.trim()}
                                                    className="save-btn"
                                                >
                                                    Save
                                                </button>
                                                <button 
                                                    onClick={() => setEditingFolderId(null)}
                                                    className="cancel-btn"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="folder-view-mode">
                                            <div className="folder-info">
                                                <span 
                                                    className="folder-name" 
                                                    onClick={() => setSelectedFolder(folder)}
                                                >
                                                    {folder.name}
                                                </span>
                                                <span className="folder-type">{folder.type === 'question' ? 'Questions' : 'Resources'}</span>
                                                <span className="folder-count">{folder.items.length} items</span>
                                            </div>
                                            <div className="folder-actions">
                                                <button 
                                                    onClick={() => { setEditingFolderId(folder._id); setEditingFolderName(folder.name); }}
                                                    className="edit-btn"
                                                >
                                                    Rename
                                                </button>
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation(); // Prevent folder selection when clicking delete
                                                        handleDeleteFolder(folder._id);
                                                    }}
                                                    className="delete-btn"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Folder Details */}
                    {selectedFolder && (
                        <div className="bookmark-folder-details">
                            <div className="folder-details-header">
                                <h3>Folder: {selectedFolder.name} ({selectedFolder.type === 'question' ? 'Questions' : 'Resources'})</h3>
                                <button onClick={() => setSelectedFolder(null)} className="close-btn">Back to Folders</button>
                            </div>
                            
                            {folderLoading ? (
                                <div className="loading-message">Loading bookmarks...</div>
                            ) : (
                                <ul className="bookmark-items-list">
                                    {selectedFolder.items.length === 0 && 
                                        <li className="empty-state">No bookmarks in this folder yet.</li>
                                    }
                                    
                                    {selectedFolder.items.map(item => (
                                        <li key={item.itemId} className="bookmark-item">
                                            <div className="bookmark-item-header">
                                                <h4>{item.title || 'Bookmarked Item'}</h4>
                                                <span className="bookmark-date">
                                                    Added: {item.addedAt ? new Date(item.addedAt).toLocaleString() : ''}
                                                </span>
                                            </div>
                                            
                                            <div className="bookmark-item-actions">
                                                {selectedFolder.type === 'question' && (
                                                    <Link 
                                                        to={`/questions?preSelectedQuestion=${item.itemId}`} 
                                                        className="view-bookmark-btn"
                                                    >
                                                        View Question
                                                    </Link>
                                                )}
                                                {selectedFolder.type === 'resource' && (
                                                    <Link 
                                                        to={`/resources?preSelectedResource=${item.itemId}`} 
                                                        className="view-bookmark-btn"
                                                    >
                                                        View Resource
                                                    </Link>
                                                )}
                                            </div>
                                            
                                            <div className="bookmark-note-section">
                                                <textarea
                                                    value={noteEdit[item.itemId] !== undefined ? noteEdit[item.itemId] : item.note || ''}
                                                    onChange={e => handleNoteChange(item.itemId, e.target.value)}
                                                    placeholder="Add a note..."
                                                    maxLength={1000}
                                                />
                                                <button 
                                                    onClick={() => handleSaveNote(selectedFolder._id, item.itemId)} 
                                                    disabled={folderLoading}
                                                    className="save-note-btn"
                                                >
                                                    Save Note
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>
                
                <div className="back-to-profile">
                    <Link to="/profile" className="back-link">Back to Profile</Link>
                </div>
            </div>
        </div>
    );
};

export default BookmarksPage;