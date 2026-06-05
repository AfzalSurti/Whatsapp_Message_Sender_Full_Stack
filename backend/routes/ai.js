const express= require('express');
const router = express.Router();
const { body } = require('express-validator');
const  {protect}=require('../middleware/auth');
const {generateAIMessage}=require('../controllers/aiController');

const aiValidation = [
  body('preset').optional().isIn(['best', 'sales', 'reminder', 'support', 'festival']),
  body('prompt').optional().trim().isLength({ max: 2000 }),
  body('tone').optional().trim().isLength({ max: 80 }),
  body('language').optional().trim().isLength({ max: 80 }),
  body('festival').optional().trim().isLength({ max: 80 }),
  body('audience').optional().trim().isLength({ max: 80 }),
  body('guidance').optional().trim().isLength({ max: 1000 }),
  body('mode').optional().isIn(['generate', 'rewrite', 'shorten', 'translate']),
  body('currentMessage').optional().trim().isLength({ max: 4096 })
];

router.post('/generate', protect, aiValidation, generateAIMessage);

module.exports=router;
