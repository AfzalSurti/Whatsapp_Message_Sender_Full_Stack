const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { protect } = require('../middleware/auth');
const {
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate
} = require('../controllers/templatesController');

const templateValidation = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('description').optional().trim().isLength({ max: 500 }),
  body('icon').optional().trim().isLength({ max: 8 }),
  body('body').trim().notEmpty().withMessage('Template body is required'),
  body('tags').optional().isArray(),
  body('category').optional().isIn(['eid', 'diwali', 'birthday', 'promo', 'reminder', 'custom', 'ai']),
  body('languages').optional().isArray(),
  body('defaultVariables').optional().isObject()
];

router.get('/', protect, getTemplates);
router.get('/:id', protect, param('id').isMongoId(), getTemplate);
router.post('/', protect, templateValidation, createTemplate);
router.put('/:id', protect, param('id').isMongoId(), templateValidation, updateTemplate);
router.delete('/:id', protect, param('id').isMongoId(), deleteTemplate);

module.exports = router;
