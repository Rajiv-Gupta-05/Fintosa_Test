const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// ─── POST /api/auth/register ──────────────────────────────────────────────────
const register = async (req, res) => {
  const log = logger.forRequest(req);
  try {
    const { name, email, password } = req.body;
    log.info('Register attempt', { email });

    if (!name || !email || !password) {
      log.warn('Register rejected — missing fields', { email });
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      log.warn('Register rejected — email already exists', { email });
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const user = await User.create({ name, email, password });
    const token = generateToken(user._id);

    log.info('User registered successfully', { userId: user._id, email: user.email });
    res.status(201).json({ message: 'Account created successfully', token, user });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      log.warn('Register rejected — validation error', { errors: messages });
      return res.status(400).json({ message: messages.join(', ') });
    }
    log.error('Register — unexpected error', { error: err.message, stack: err.stack });
    res.status(500).json({ message: 'Server error during registration' });
  }
};

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
const login = async (req, res) => {
  const log = logger.forRequest(req);
  try {
    const { email, password } = req.body;
    log.info('Login attempt', { email });

    if (!email || !password) {
      log.warn('Login rejected — missing credentials');
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      log.warn('Login failed — user not found', { email });
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      log.warn('Login failed — wrong password', { email });
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = generateToken(user._id);
    log.info('Login successful', { userId: user._id, email: user.email });
    res.status(200).json({ message: 'Logged in successfully', token, user: user.toJSON() });
  } catch (err) {
    log.error('Login — unexpected error', { error: err.message, stack: err.stack });
    res.status(500).json({ message: 'Server error during login' });
  }
};

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
const getMe = async (req, res) => {
  logger.forRequest(req).info('getMe', { userId: req.user._id });
  res.status(200).json({ user: req.user });
};

// ─── GET /api/auth/users ──────────────────────────────────────────────────────
const getAllUsers = async (req, res) => {
  const log = logger.forRequest(req);
  try {
    const users = await User.find({}, 'name email avatar role').sort({ name: 1 });
    log.info('getAllUsers', { count: users.length });
    res.status(200).json({ users });
  } catch (err) {
    log.error('getAllUsers — failed', { error: err.message, stack: err.stack });
    res.status(500).json({ message: 'Failed to fetch users' });
  }
};

module.exports = { register, login, getMe, getAllUsers };
