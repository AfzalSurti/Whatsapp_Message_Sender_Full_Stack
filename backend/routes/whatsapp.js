const express=require('express');
const router=express.Router();
const { body, validationResult } = require('express-validator');
const {protect}=require('../middleware/auth');
const {validateApiKey}=require('../middleware/validateApiKey');
const { validateSendPayload } = require('../middleware/validateSend');
const{
    connectWhatsApp,
    getWhatsAppStatus,
    disconnectWhatsApp,
    sendBulkMessages,
    sendBulkMessagesViaApiKey
}=require('../controllers/whatsappController');

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

router.post('/connect',protect,connectWhatsApp);
router.get('/status',protect,getWhatsAppStatus);
router.post('/disconnect',protect,disconnectWhatsApp);
router.post('/send', protect, [
  body('numbers').isArray({ min: 1, max: 500 }).withMessage('Provide 1 to 500 phone numbers'),
  body('message').exists().withMessage('Message is required')
], handleValidation, validateSendPayload, sendBulkMessages);

router.post('/send-via-api', validateApiKey, [
  body('numbers').isArray({ min: 1, max: 500 }).withMessage('Provide 1 to 500 phone numbers'),
  body('message').exists().withMessage('Message is required')
], handleValidation, validateSendPayload, sendBulkMessagesViaApiKey);

module.exports=router;
