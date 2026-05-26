const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

const protect = async (req, res, next) => {
  const log = logger.forRequest(req);
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      log.warn('Auth rejected — no Bearer token');
      return res.status(401).json({ message: 'Unauthorized — no token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) {
      log.warn('Auth rejected — token valid but user not found', { decodedId: decoded.id });
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = user;
    log.debug('Auth passed', { userId: user._id, email: user.email });
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      log.warn('Auth rejected — token expired', { error: err.message });
      return res.status(401).json({ message: 'Token expired, please login again' });
    }
    if (err.name === 'JsonWebTokenError') {
      log.warn('Auth rejected — invalid token', { error: err.message });
      return res.status(401).json({ message: 'Invalid token' });
    }
    log.error('Auth middleware — unexpected error', { error: err.message, stack: err.stack });
    return res.status(401).json({ message: 'Authentication failed' });
  }
};

module.exports = { protect };
