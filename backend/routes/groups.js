const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { protect } = require('../middleware/auth');
const { validateAndNormalizePhoneField } = require('../middleware/validatePhoneNumber');
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
const {
  getOverview,
  getTags,
  createTag,
  deleteTag,
  updateContact,
  deleteContact,
  importContacts
} = require('../controllers/segmentsController');

const createValidation = [
  body('name').trim().isLength({ min: 1, max: 80 }).withMessage('Group name must be 1-80 characters')
];

const updateValidation = [
  body('name').trim().optional().notEmpty().withMessage('Group name cannot be empty'),
  body('color').optional().matches(/^#[0-9A-F]{6}$/i).withMessage('Invalid color format')
];

const addNumberValidation = [
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  validateAndNormalizePhoneField({ field: 'phone' }),
  body('name').trim().optional(),
  body('tags').optional()
];

const bulkAddValidation = [
  body('numbers').isArray({ min: 1 }).withMessage('Numbers must be a non-empty array')
];

const tagValidation = [
  body('name').trim().isLength({ min: 1, max: 40 }).withMessage('Tag name must be 1-40 characters'),
  body('category')
    .optional()
    .isIn(['religion', 'relationship', 'gender', 'custom'])
    .withMessage('Invalid tag category'),
  body('color').optional().matches(/^#[0-9A-F]{6}$/i).withMessage('Invalid color format')
];

const updateContactValidation = [
  body('phone').trim().notEmpty().withMessage('Phone is required'),
  validateAndNormalizePhoneField({ field: 'phone' }),
  body('name').trim().optional(),
  body('tags').optional().isArray()
];

const deleteContactValidation = [
  body('phone').trim().notEmpty().withMessage('Phone is required'),
  validateAndNormalizePhoneField({ field: 'phone' })
];

router.get('/overview', protect, getOverview);
router.get('/tags', protect, getTags);
router.post('/tags', protect, tagValidation, createTag);
router.delete('/tags/:id', protect, param('id').isMongoId(), deleteTag);
router.put('/contacts', protect, updateContactValidation, updateContact);
router.delete('/contacts', protect, deleteContactValidation, deleteContact);
router.post('/import', protect, body('rows').isArray({ min: 1 }), importContacts);

router.post('/', protect, createValidation, createGroup);
router.get('/', protect, getGroups);
router.get('/:id', protect, param('id').isMongoId(), getGroup);
router.put('/:id', protect, param('id').isMongoId(), updateValidation, updateGroup);
router.delete('/:id', protect, param('id').isMongoId(), deleteGroup);
router.post('/:id/numbers', protect, param('id').isMongoId(), addNumberValidation, addNumber);
router.delete('/:id/numbers/:phone', protect, param('id').isMongoId(), removeNumber);
router.post('/:id/bulk', protect, param('id').isMongoId(), bulkAddValidation, bulkAddNumbers);

module.exports = router;
