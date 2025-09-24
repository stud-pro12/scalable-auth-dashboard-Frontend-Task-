const express = require('express');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Get user profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update user profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { firstName, lastName, username, email } = req.body;
    
    // Check if username or email already exists (excluding current user)
    const existingUser = await User.findOne({
      $and: [
        { _id: { $ne: req.user._id } },
        { $or: [{ email }, { username }] }
      ]
    });

    if (existingUser) {
      return res.status(400).json({
        message: 'Username or email already exists'
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        username,
        email,
        'profile.firstName': firstName,
        'profile.lastName': lastName
      },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    res.status(400).json({ message: 'Update failed', error: error.message });
  }
});

// Change password
router.put('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user._id);
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user stats
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    // Calculate days since joining
    const daysSinceJoining = Math.floor((new Date() - user.createdAt) / (1000 * 60 * 60 * 24));
    
    const stats = {
      memberSince: user.createdAt,
      daysSinceJoining,
      profileCompletion: calculateProfileCompletion(user),
      lastLogin: new Date(),
    };

    res.json({ stats });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Helper function to calculate profile completion
function calculateProfileCompletion(user) {
  let completed = 0;
  let total = 7;

  if (user.username) completed++;
  if (user.email) completed++;
  if (user.profile.firstName) completed++;
  if (user.profile.lastName) completed++;
  if (user.profile.avatar) completed++;
  completed += 2; // Password and createdAt are always present

  return Math.round((completed / total) * 100);
}

module.exports = router;