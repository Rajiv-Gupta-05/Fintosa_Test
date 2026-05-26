const mongoose = require('mongoose');
const Task = require('../models/Task');
const logger = require('../utils/logger');

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Emit a socket event and log it
const emit = (req, event, data) => {
  if (req.io) {
    req.io.emit(event, data);
    logger.debug('Socket event emitted', { event, taskId: data?._id || data?.id });
  }
};

/**
 * Safe findById using lean() so Mongoose never tries to cast stale string
 * values (e.g. old assignedTo:"Rajiv") into ObjectIds — that was causing
 * ValidationError on document initialisation before any write happened.
 */
const findTaskLean = (taskId) =>
  Task.findById(taskId).lean();

/**
 * After a write we always re-fetch with populate so the client gets full
 * user objects. We use lean() here too to avoid casting issues on read.
 */
const fetchPopulated = (taskId) =>
  Task.findById(taskId)
    .populate('assignedTo', 'name email avatar')
    .populate('createdBy', 'name email avatar')
    .lean();

// ─── GET /api/tasks ────────────────────────────────────────────────────────────
const getTasks = async (req, res) => {
  const log = logger.forRequest(req);
  try {
    const { status, priority, assignedTo, search } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    log.info('Fetching tasks', { filter });

    // Use lean + populate — avoids document-init casting errors on stale data
    const tasks = await Task.find(filter)
      .populate('assignedTo', 'name email avatar')
      .populate('createdBy', 'name email avatar')
      .sort({ status: 1, order: 1, createdAt: -1 })
      .lean();

    log.info('Tasks fetched', { count: tasks.length });
    res.status(200).json({ tasks });
  } catch (err) {
    log.error('getTasks — failed', { error: err.message, stack: err.stack });
    res.status(500).json({ message: 'Failed to fetch tasks' });
  }
};

// ─── POST /api/tasks ──────────────────────────────────────────────────────────
const createTask = async (req, res) => {
  const log = logger.forRequest(req);
  try {
    const { title, description, priority, status, assignedTo, dueDate } = req.body;
    log.info('Create task attempt', { title, priority, status, assignedTo });

    if (!title || title.trim() === '') {
      log.warn('createTask rejected — empty title');
      return res.status(400).json({ message: 'Task title should not be empty' });
    }

    if (dueDate) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const due = new Date(dueDate);
      due.setHours(0, 0, 0, 0);
      if (due < now) {
        log.warn('createTask rejected — past due date', { dueDate });
        return res.status(400).json({ message: 'Due date cannot be in the past' });
      }
    }

    // Validate assignedTo is a valid ObjectId if provided
    if (assignedTo && !mongoose.Types.ObjectId.isValid(assignedTo)) {
      log.warn('createTask rejected — invalid assignedTo ObjectId', { assignedTo });
      return res.status(400).json({ message: 'Invalid assignee ID' });
    }

    const task = await Task.create({
      title: title.trim(),
      description,
      priority,
      status,
      assignedTo: assignedTo || null,
      dueDate: dueDate || null,
      createdBy: req.user._id,
    });

    const populated = await fetchPopulated(task._id);
    emit(req, 'task:created', populated);
    log.info('Task created', { taskId: task._id, title: task.title, priority, status });
    res.status(201).json({ message: 'Task created successfully', task: populated });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      log.warn('createTask rejected — validation', { errors: messages });
      return res.status(400).json({ message: messages.join(', ') });
    }
    log.error('createTask — unexpected error', { error: err.message, stack: err.stack });
    res.status(500).json({ message: 'Failed to create task' });
  }
};

// ─── PUT /api/tasks/:id ───────────────────────────────────────────────────────
const updateTask = async (req, res) => {
  const log = logger.forRequest(req);
  const taskId = req.params.id;
  try {
    const { title, description, priority, status, assignedTo, dueDate, order } = req.body;
    log.info('Update task attempt', { taskId, fields: Object.keys(req.body) });

    // Use lean() to avoid document-init cast errors on existing stale data
    const existing = await findTaskLean(taskId);
    if (!existing) {
      log.warn('updateTask — task not found', { taskId });
      return res.status(404).json({ message: 'Task not found' });
    }

    // Business rule: DONE → TODO not allowed
    if (existing.status === 'DONE' && status === 'TODO') {
      log.warn('updateTask rejected — DONE→TODO not allowed', { taskId });
      return res.status(400).json({ message: 'Completed tasks cannot be moved back to TODO' });
    }

    if (title !== undefined && title.trim() === '') {
      log.warn('updateTask rejected — empty title', { taskId });
      return res.status(400).json({ message: 'Task title should not be empty' });
    }

    if (dueDate) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const due = new Date(dueDate);
      due.setHours(0, 0, 0, 0);
      if (due < now) {
        log.warn('updateTask rejected — past due date', { taskId, dueDate });
        return res.status(400).json({ message: 'Due date cannot be in the past' });
      }
    }

    if (assignedTo && !mongoose.Types.ObjectId.isValid(assignedTo)) {
      log.warn('updateTask rejected — invalid assignedTo ObjectId', { taskId, assignedTo });
      return res.status(400).json({ message: 'Invalid assignee ID' });
    }

    // Build the $set payload — only include fields that were actually sent
    const updates = {};
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description;
    if (priority !== undefined) updates.priority = priority;
    if (status !== undefined) updates.status = status;
    if (assignedTo !== undefined) updates.assignedTo = assignedTo || null;
    if (dueDate !== undefined) updates.dueDate = dueDate || null;
    if (order !== undefined) updates.order = order;

    // findByIdAndUpdate skips document init entirely — no cast error on stale fields not in updates
    await Task.findByIdAndUpdate(taskId, { $set: updates }, { runValidators: true });

    const populated = await fetchPopulated(taskId);
    emit(req, 'task:updated', populated);
    log.info('Task updated', {
      taskId,
      statusChange: status && existing.status !== status ? `${existing.status} → ${status}` : undefined,
    });
    res.status(200).json({ message: 'Task updated successfully', task: populated });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      log.warn('updateTask rejected — validation', { taskId, errors: messages });
      return res.status(400).json({ message: messages.join(', ') });
    }
    log.error('updateTask — unexpected error', { taskId, error: err.message, stack: err.stack });
    res.status(500).json({ message: 'Failed to update task' });
  }
};

// ─── PATCH /api/tasks/:id/status ──────────────────────────────────────────────
const updateStatus = async (req, res) => {
  const log = logger.forRequest(req);
  const taskId = req.params.id;
  try {
    const { status } = req.body;
    const ALLOWED = ['TODO', 'IN_PROGRESS', 'DONE'];
    log.info('Status update attempt', { taskId, status });

    if (!status || !ALLOWED.includes(status)) {
      log.warn('updateStatus rejected — invalid status', { taskId, status });
      return res.status(400).json({ message: `Status must be one of: ${ALLOWED.join(', ')}` });
    }

    // lean() — avoids Mongoose casting stale string ObjectId values in old docs
    const existing = await findTaskLean(taskId);
    if (!existing) {
      log.warn('updateStatus — task not found', { taskId });
      return res.status(404).json({ message: 'Task not found' });
    }

    // Business rule: DONE → TODO blocked
    if (existing.status === 'DONE' && status === 'TODO') {
      log.warn('updateStatus rejected — DONE→TODO not allowed', { taskId });
      return res.status(400).json({ message: 'Completed tasks cannot be moved back to TODO' });
    }

    // Direct atomic update — never touches stale fields, no document-init error
    await Task.findByIdAndUpdate(taskId, { $set: { status } }, { runValidators: true });

    const populated = await fetchPopulated(taskId);
    emit(req, 'task:statusChanged', populated);
    log.info('Task status changed', { taskId, from: existing.status, to: status });
    res.status(200).json({ message: 'Status updated successfully', task: populated });
  } catch (err) {
    log.error('updateStatus — unexpected error', { taskId, error: err.message, stack: err.stack });
    res.status(500).json({ message: 'Failed to update task status' });
  }
};

// ─── DELETE /api/tasks/:id ────────────────────────────────────────────────────
const deleteTask = async (req, res) => {
  const log = logger.forRequest(req);
  const taskId = req.params.id;
  try {
    log.info('Delete task attempt', { taskId });

    // findByIdAndDelete doesn't trigger document init, so safe on stale data
    const task = await Task.findByIdAndDelete(taskId).lean();
    if (!task) {
      log.warn('deleteTask — task not found', { taskId });
      return res.status(404).json({ message: 'Task not found' });
    }

    emit(req, 'task:deleted', { id: taskId });
    log.info('Task deleted', { taskId, title: task.title });
    res.status(200).json({ message: 'Task deleted successfully', id: taskId });
  } catch (err) {
    log.error('deleteTask — unexpected error', { taskId, error: err.message, stack: err.stack });
    res.status(500).json({ message: 'Failed to delete task' });
  }
};

module.exports = { getTasks, createTask, updateTask, updateStatus, deleteTask };
