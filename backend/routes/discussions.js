const express = require('express');
const router = express.Router();
const Discussion = require('../models/DiscussionModel');
const User = require('../models/UserModel');
const { authMiddleware } = require('../middleware/authMiddleware');
const mongoose = require('mongoose');

// Get discussion for a specific item
router.get('/:itemType/:itemId', authMiddleware, async (req, res) => {
  try {
    const { itemType, itemId } = req.params;
    
    // Validate itemType
    if (!['question', 'resource'].includes(itemType)) {
      return res.status(400).json({ error: 'Invalid item type' });
    }
    
    // Validate itemId
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }
    
    const itemModel = itemType === 'question' ? 'Question' : 'Resource';
    
    // Find existing discussion or create new one
    let discussion = await Discussion.findOne({ 
      itemType, 
      itemId 
    }).populate({
      path: 'messages.userId',
      select: 'fullName email role' // These are the fields from UserModel
    });
    
    if (!discussion) {
      // Create a new discussion
      discussion = await Discussion.create({
        itemType,
        itemId,
        itemModel,
        messages: [],
        participants: [req.user.id]
      });
      
      // Immediately populate the user info for the new discussion
      discussion = await Discussion.findById(discussion._id).populate({
        path: 'messages.userId',
        select: 'fullName email role'
      });
    }
    
    res.json(discussion);
  } catch (error) {
    console.error('Error fetching discussion:', error);
    res.status(500).json({ 
      error: 'Failed to fetch discussion',
      message: error.message 
    });
  }
});

// Add message to discussion
router.post('/:itemType/:itemId/message', authMiddleware, async (req, res) => {
  try {
    console.log('Received message POST request:', {
      params: req.params,
      body: req.body,
      user: req.user ? { id: req.user.id, role: req.user.role } : 'No user'
    });
    
    const { itemType, itemId } = req.params;
    const { content, parentMessageId } = req.body;
    
    // Validate input
    if (!['question', 'resource'].includes(itemType)) {
      return res.status(400).json({ error: 'Invalid item type' });
    }
    
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }
    
    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Message content cannot be empty' });
    }
    
    // If parentMessageId is provided, validate it
    if (parentMessageId && !mongoose.Types.ObjectId.isValid(parentMessageId)) {
      return res.status(400).json({ error: 'Invalid parent message ID' });
    }
    
    const itemModel = itemType === 'question' ? 'Question' : 'Resource';
    
    // Find or create the discussion
    let discussion = await Discussion.findOne({ itemType, itemId });
    
    if (!discussion) {
      discussion = await Discussion.create({
        itemType,
        itemId,
        itemModel,
        messages: [],
        participants: [req.user.id]
      });
    }
    
    // Add message to discussion
    const newMessage = {
      userId: req.user.id,
      content: content.trim(),
      parentMessageId: parentMessageId || null,
      likes: []
    };
    
    discussion.messages.push(newMessage);
    
    // Add user to participants if not already there
    if (!discussion.participants.includes(req.user.id)) {
      discussion.participants.push(req.user.id);
    }
    
    await discussion.save();
    
    // Return the updated discussion with populated user info
    const updatedDiscussion = await Discussion.findById(discussion._id)
      .populate({
        path: 'messages.userId',
        select: 'fullName email role' // Include role to identify admins
      });
    
    console.log('Successfully added message, returning updated discussion');
    res.json(updatedDiscussion);
  } catch (error) {
    console.error('Error adding message:', error);
    res.status(500).json({ 
      error: 'Failed to add message',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Like a message
router.post('/:discussionId/message/:messageId/like', authMiddleware, async (req, res) => {
  try {
    const { discussionId, messageId } = req.params;
    
    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(discussionId) || !mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const discussion = await Discussion.findById(discussionId);
    
    if (!discussion) {
      return res.status(404).json({ error: 'Discussion not found' });
    }
    
    // Find the message
    const message = discussion.messages.id(messageId);
    
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Check if user already liked the message
    const userIndex = message.likes.indexOf(req.user.id);
    
    if (userIndex === -1) {
      // User hasn't liked the message yet, add the like
      message.likes.push(req.user.id);
    } else {
      // User already liked the message, remove the like
      message.likes.splice(userIndex, 1);
    }
    
    await discussion.save();
    
    // Return the updated discussion
    const updatedDiscussion = await Discussion.findById(discussionId)
      .populate({
        path: 'messages.userId',
        select: 'fullName email role'
      });
    
    res.json(updatedDiscussion);
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// Edit a message
router.put('/:discussionId/message/:messageId', authMiddleware, async (req, res) => {
  try {
    const { discussionId, messageId } = req.params;
    const { content } = req.body;
    
    // Validate parameters
    if (!mongoose.Types.ObjectId.isValid(discussionId) || !mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Message content cannot be empty' });
    }
    
    const discussion = await Discussion.findById(discussionId);
    
    if (!discussion) {
      return res.status(404).json({ error: 'Discussion not found' });
    }
    
    // Find the message
    const message = discussion.messages.id(messageId);
    
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Check permissions: only allow users to edit their own messages or admins to edit any message
    const isAdmin = req.user.role === 'admin';
    const isAuthor = message.userId.toString() === req.user.id.toString();
    
    if (!isAdmin && !isAuthor) {
      return res.status(403).json({ error: 'You do not have permission to edit this message' });
    }
    
    // Update the message
    message.content = content.trim();
    message.edited = true;
    message.editedAt = Date.now();
    
    await discussion.save();
    
    // Return the updated discussion
    const updatedDiscussion = await Discussion.findById(discussionId)
      .populate({
        path: 'messages.userId',
        select: 'fullName email role'
      });
    
    res.json(updatedDiscussion);
  } catch (error) {
    console.error('Error editing message:', error);
    res.status(500).json({ 
      error: 'Failed to edit message',
      message: error.message
    });
  }
});

// Delete a message
router.delete('/:discussionId/message/:messageId', authMiddleware, async (req, res) => {
  try {
    const { discussionId, messageId } = req.params;
    
    // Validate parameters
    if (!mongoose.Types.ObjectId.isValid(discussionId) || !mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const discussion = await Discussion.findById(discussionId);
    
    if (!discussion) {
      return res.status(404).json({ error: 'Discussion not found' });
    }
    
    // Find the message
    const message = discussion.messages.id(messageId);
    
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Check permissions: only allow users to delete their own messages or admins to delete any message
    const isAdmin = req.user.role === 'admin';
    const isAuthor = message.userId.toString() === req.user.id.toString();
    
    if (!isAdmin && !isAuthor) {
      return res.status(403).json({ error: 'You do not have permission to delete this message' });
    }
    
    // Find all message IDs to be deleted (the message itself and all its replies recursively)
    const messageIdsToDelete = [];
    
    // Recursive function to collect message IDs to delete
    const collectReplies = (parentId) => {
      // Find direct replies to this parent
      const replies = discussion.messages.filter(msg => 
        msg.parentMessageId && msg.parentMessageId.toString() === parentId.toString()
      );
      
      // For each reply, add it to the delete list and check for its own replies
      replies.forEach(reply => {
        messageIdsToDelete.push(reply._id.toString());
        // Recursively collect replies to this reply
        collectReplies(reply._id);
      });
    };
    
    // Start with the target message
    messageIdsToDelete.push(messageId);
    // Collect all replies to the target message
    collectReplies(messageId);
    
    console.log(`Deleting message ${messageId} and ${messageIdsToDelete.length - 1} related replies`);
    
    // Remove all collected messages from the discussion
    messageIdsToDelete.forEach(id => {
      discussion.messages.pull(id);
    });
    
    await discussion.save();
    
    // Return the updated discussion
    const updatedDiscussion = await Discussion.findById(discussionId)
      .populate({
        path: 'messages.userId',
        select: 'fullName email role'
      });
    
    res.json(updatedDiscussion);
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ 
      error: 'Failed to delete message',
      message: error.message
    });
  }
});

// Get all discussions for a user (for notification/activity purposes)
router.get('/user/me', authMiddleware, async (req, res) => {
  try {
    const discussions = await Discussion.find({
      participants: req.user.id
    })
    .select('itemType itemId updatedAt messages')
    .sort('-updatedAt')
    .limit(10);
    
    res.json(discussions);
  } catch (error) {
    console.error('Error fetching user discussions:', error);
    res.status(500).json({ error: 'Failed to fetch discussions' });
  }
});

module.exports = router; 