const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const {
  generateKey,
  getKeys,
  getFullKey,
  deleteKey,
  getKeyStats
} = require('../controllers/keysController');

// Validation rules
const generateKeyValidation = [
  body('name').optional().trim().isLength({ min: 1, max: 50 })
    .withMessage('Name must be between 1 and 50 characters')
];

// Routes
router.post('/', protect, generateKeyValidation, generateKey);
router.get('/', protect, getKeys);
router.get('/:id/full', protect, getFullKey);
router.get('/:id/stats', protect, getKeyStats);
router.delete('/:id', protect, deleteKey);

module.exports = router;
