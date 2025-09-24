const express = require('express');
const Task = require('../models/Task');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Get all tasks for user (with filtering and search)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { 
      status, 
      priority, 
      search, 
      sortBy = 'createdAt', 
      sortOrder = 'desc',
      limit = 50,
      page = 1 
    } = req.query;

    // Build filter object
    const filter = { userId: req.user._id };
    
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get tasks with filtering, sorting, and pagination
    const tasks = await Task.find(filter)
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .limit(parseInt(limit))
      .skip(skip);

    // Get total count for pagination
    const totalTasks = await Task.countDocuments(filter);

    res.json({
      tasks,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalTasks / parseInt(limit)),
        totalTasks,
        hasNext: skip + tasks.length < totalTasks,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create new task
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, description, priority, dueDate, tags } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }

    const task = new Task({
      title,
      description,
      priority,
      dueDate: dueDate ? new Date(dueDate) : null,
      tags: tags || [],
      userId: req.user._id
    });

    await task.save();
    
    res.status(201).json({
      message: 'Task created successfully',
      task
    });
  } catch (error) {
    res.status(400).json({ message: 'Task creation failed', error: error.message });
  }
});

// Update task
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { title, description, status, priority, dueDate, tags } = req.body;

    const task = await Task.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    });

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Update fields
    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (status !== undefined) task.status = status;
    if (priority !== undefined) task.priority = priority;
    if (dueDate !== undefined) task.dueDate = dueDate ? new Date(dueDate) : null;
    if (tags !== undefined) task.tags = tags;

    await task.save();

    res.json({
      message: 'Task updated successfully',
      task
    });
  } catch (error) {
    res.status(400).json({ message: 'Task update failed', error: error.message });
  }
});

// Delete task
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({ 
      _id: req.params.id, 
      userId: req.user._id 
    });

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Task deletion failed', error: error.message });
  }
});

// Get task statistics
router.get('/stats/overview', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;

    // Get task counts by status
    const statusStats = await Task.aggregate([
      { $match: { userId } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Get priority distribution
    const priorityStats = await Task.aggregate([
      { $match: { userId } },
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);

    // Get overdue tasks count
    const overdueCount = await Task.countDocuments({
      userId,
      status: { $ne: 'completed' },
      dueDate: { $lt: new Date() }
    });

    // Format response
    const stats = {
      byStatus: statusStats.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, { todo: 0, 'in-progress': 0, completed: 0 }),
      
      byPriority: priorityStats.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, { low: 0, medium: 0, high: 0 }),
      
      overdueCount,
      totalTasks: statusStats.reduce((sum, curr) => sum + curr.count, 0)
    };

    res.json({ stats });
  } catch (error) {
    res.status(500).json({ message: 'Stats fetch failed', error: error.message });
  }
});

module.exports = router;