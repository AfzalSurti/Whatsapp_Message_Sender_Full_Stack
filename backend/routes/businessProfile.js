const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const { getProfile, updateProfile } = require('../controllers/businessProfileController');

const updateValidation = [
  body('businessName').optional().isString().trim().isLength({ max: 120 }),
  body('footerText').optional().isString().trim().isLength({ max: 200 }),
  body('footerEnabled').optional().isBoolean().withMessage('footerEnabled must be true or false'),
  body('footerSeparator').optional().isString().trim().isLength({ max: 40 })
];

router.get('/', protect, getProfile);
router.put('/', protect, updateValidation, updateProfile);

module.exports = router;
