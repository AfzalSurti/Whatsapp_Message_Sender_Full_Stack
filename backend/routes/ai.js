const express= require('express');
const router = express.Router();
const  {protect}=require('../middleware/auth');
const {generateAIMessage}=require('../controllers/aiController');

// protected route to generate AI message

router.post('/generate', protect, generateAIMessage);

module.exports=router;