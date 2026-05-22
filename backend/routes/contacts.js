const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const { validateAndNormalizePhoneField } = require('../middleware/validatePhoneNumber');
const {
  getContacts,
  createContact,
  updateContact,
  deleteContact
} = require('../controllers/contactController');

const createValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  validateAndNormalizePhoneField({ field: 'phoneNumber' })
];

const updateValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  validateAndNormalizePhoneField({ field: 'phoneNumber' })
];

router.get('/', protect, getContacts);
router.post('/', protect, createValidation, createContact);
router.put('/:id', protect, updateValidation, updateContact);
router.delete('/:id', protect, deleteContact);

module.exports = router;
