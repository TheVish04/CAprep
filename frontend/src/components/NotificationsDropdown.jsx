import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/axiosConfig';
import apiUtils from '../utils/apiUtils';
import './NotificationsDropdown.css';

const NotificationsDropdown = () => {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  const fetchNotifications = async () => {
    if (!apiUtils.getAuthToken()) return;
    setLoading(true);
    try {
      const res = await api.get('/notifications?limit=15');
      if (res.data) {
        setList(res.data.data || []);
        setUnreadCount(res.data.unreadCount ?? 0);
      }
    } catch (err) {
      console.error('Fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) return;
    fetchNotifications();
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (id) => {
    if (!apiUtils.getAuthToken()) return;
    try {
      await api.patch(`/notifications/${id}/read`);
      setList((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Mark read:', err);
    }
  };

  const markAllRead = async () => {
    if (!apiUtils.getAuthToken()) return;
    try {
      await api.patch('/notifications/read-all');
      setList((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Mark all read:', err);
    }
  };

  const formatDate = (d) => {
    if (!d) return '';
    const date = new Date(d);
    const now = new Date();
    const diff = now - date;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="notifications-dropdown" ref={dropdownRef}>
      <button
        type="button"
        className="notifications-trigger"
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && <span className="notifications-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>
      {open && (
        <div className="notifications-panel">
          <div className="notifications-panel-header">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <button type="button" className="notifications-mark-all" onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>
          <div className="notifications-list">
            {loading ? (
              <div className="notifications-loading">Loading…</div>
            ) : list.length === 0 ? (
              <div className="notifications-empty">No notifications</div>
            ) : (
              list.map((n) => (
                <div
                  key={n._id}
                  className={`notifications-item ${n.read ? 'read' : ''}`}
                  onClick={() => !n.read && markAsRead(n._id)}
                >
                  <div className="notifications-item-title">{n.title}</div>
                  {n.body && <div className="notifications-item-body">{n.body}</div>}
                  <div className="notifications-item-time">{formatDate(n.createdAt)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsDropdown;
