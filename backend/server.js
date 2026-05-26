require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('crypto').randomUUID ? { v4: () => require('crypto').randomUUID() } : require('crypto');

const logger = require('./src/utils/logger');
const authRoutes = require('./src/routes/auth.routes');
const taskRoutes = require('./src/routes/task.routes');

const app = express();
const httpServer = http.createServer(app);

// ─── Unique request ID middleware (must be first) ─────────────────────────────
app.use((req, _res, next) => {
  req.id = require('crypto').randomUUID();
  next();
});

// ─── Socket.io setup ─────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      // Allow all origins
      callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  },
});

io.on('connection', (socket) => {
  logger.info('Socket client connected', {
    socketId: socket.id,
    transport: socket.conn.transport.name,
    totalClients: io.engine.clientsCount,
  });

  socket.on('disconnect', (reason) => {
    logger.info('Socket client disconnected', {
      socketId: socket.id,
      reason,
      totalClients: io.engine.clientsCount - 1,
    });
  });

  socket.on('error', (err) => {
    logger.error('Socket error', { socketId: socket.id, error: err.message });
  });
});

// ─── CORS ────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow all origins
      callback(null, true);
    },
    credentials: true,
  })
);

// ─── HTTP request logging via Morgan ─────────────────────────────────────────
// Custom token: attach the request ID to each log line
morgan.token('req-id', (req) => req.id);
morgan.token('user-id', (req) => req.user?._id?.toString() || 'anon');

const morganFormat = process.env.NODE_ENV === 'production'
  ? ':req-id :method :url :status :res[content-length] - :response-time ms [:user-id]'
  : ':req-id :method :url :status :response-time ms - :res[content-length]b [:user-id]';

app.use(morgan(morganFormat, { stream: logger.httpStream }));

// ─── Body parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Attach io to every request ───────────────────────────────────────────────
app.use((req, _res, next) => {
  req.io = io;
  next();
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  logger.warn('Route not found', {
    reqId: req.id,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
  });
  res.status(404).json({ message: 'Route not found' });
});

// ─── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  logger.error('Unhandled application error', {
    reqId: req.id,
    method: req.method,
    url: req.originalUrl,
    status,
    error: err.message,
    stack: err.stack,
  });
  res.status(status).json({ message: err.message || 'Internal server error' });
});

// ─── Process-level error handling ────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION — shutting down', {
    error: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('UNHANDLED PROMISE REJECTION', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  // Do not exit — let the server continue; log is enough for debugging
});

// ─── Database + Server start ──────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  logger.error('MONGO_URI is not set in .env — cannot start server');
  process.exit(1);
}

// Mongoose connection event hooks
mongoose.connection.on('connected', () =>
  logger.info('Mongoose default connection opened')
);
mongoose.connection.on('disconnected', () =>
  logger.warn('Mongoose default connection lost — will attempt reconnect')
);
mongoose.connection.on('reconnected', () =>
  logger.info('Mongoose reconnected successfully')
);
mongoose.connection.on('error', (err) =>
  logger.error('Mongoose connection error', { error: err.message })
);

logger.info('Connecting to MongoDB…');

mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000,
  })
  .then(() => {
    logger.info('MongoDB connected', { host: mongoose.connection.host, db: mongoose.connection.name });
    httpServer.listen(PORT, () => {
      logger.info(`Server listening`, { port: PORT, env: process.env.NODE_ENV || 'development' });
    });
  })
  .catch((err) => {
    logger.error('MongoDB initial connection failed', { error: err.message, stack: err.stack });
    process.exit(1);
  });
