const express = require('express');
const router = express.Router();
const {
  getTasks,
  createTask,
  updateTask,
  updateStatus,
  deleteTask,
} = require('../controllers/task.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect); // All task routes require authentication

router.get('/', getTasks);
router.post('/', createTask);
router.put('/:id', updateTask);
router.patch('/:id/status', updateStatus);
router.delete('/:id', deleteTask);

module.exports = router;
