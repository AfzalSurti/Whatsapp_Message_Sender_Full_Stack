const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const {
  getContacts,
  createContact,
  updateContact,
  deleteContact
} = require('../controllers/contactController');

const createValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('phoneNumber').trim().notEmpty().withMessage('Phone number is required')
];

const updateValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('phoneNumber').trim().notEmpty().withMessage('Phone number is required')
];

router.get('/', protect, getContacts);
router.post('/', protect, createValidation, createContact);
router.put('/:id', protect, updateValidation, updateContact);
router.delete('/:id', protect, deleteContact);

module.exports = router;
