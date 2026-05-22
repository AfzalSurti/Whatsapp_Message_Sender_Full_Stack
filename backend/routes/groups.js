const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { protect } = require('../middleware/auth');
const {
  createGroup,
  getGroups,
  getGroup,
  updateGroup,
  deleteGroup,
  addNumber,
  removeNumber,
  bulkAddNumbers
} = require('../controllers/groupsController');

const createValidation = [
  body('name').trim().notEmpty().withMessage('Group name is required')
];

const updateValidation = [
  body('name').trim().optional().notEmpty().withMessage('Group name cannot be empty'),
  body('color').optional().matches(/^#[0-9A-F]{6}$/i).withMessage('Invalid color format')
];

const addNumberValidation = [
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('name').trim().optional(),
  body('tags').optional()
];

const bulkAddValidation = [
  body('numbers').isArray({ min: 1 }).withMessage('Numbers must be a non-empty array')
];

router.post('/', protect, createValidation, createGroup);
router.get('/', protect, getGroups);
router.get('/:id', protect, param('id').isMongoId(), getGroup);
router.put('/:id', protect, param('id').isMongoId(), updateValidation, updateGroup);
router.delete('/:id', protect, param('id').isMongoId(), deleteGroup);
router.post('/:id/numbers', protect, param('id').isMongoId(), addNumberValidation, addNumber);
router.delete('/:id/numbers/:phone', protect, param('id').isMongoId(), removeNumber);
router.post('/:id/bulk', protect, param('id').isMongoId(), bulkAddValidation, bulkAddNumbers);

module.exports = router;
