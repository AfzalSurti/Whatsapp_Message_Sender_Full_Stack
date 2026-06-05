const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { protect } = require('../middleware/auth');
const { validateAndNormalizePhoneField } = require('../middleware/validatePhoneNumber');
const {
  getContacts,
  createContact,
  updateContact,
  deleteContact
} = require('../controllers/contactController');

const createValidation = [
  body('name').trim().isLength({ min: 1, max: 80 }).withMessage('Name must be 1-80 characters'),
  validateAndNormalizePhoneField({ field: 'phoneNumber' })
];

const updateValidation = [
  body('name').trim().isLength({ min: 1, max: 80 }).withMessage('Name must be 1-80 characters'),
  validateAndNormalizePhoneField({ field: 'phoneNumber' })
];

router.get('/', protect, getContacts);
router.post('/', protect, createValidation, createContact);
router.put('/:id', protect, param('id').isMongoId(), updateValidation, updateContact);
router.delete('/:id', protect, param('id').isMongoId(), deleteContact);

module.exports = router;
