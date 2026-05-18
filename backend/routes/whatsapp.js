const express=require('express');
const router=express.Router();
const {protect}=require('../middleware/auth');
const {validateApiKey}=require('../middleware/validateApiKey');
const{
    connectWhatsApp,
    getWhatsAppStatus,
    disconnectWhatsApp,
    sendBulkMessages,
    sendBulkMessagesViaApiKey
}=require('../controllers/whatsappController');

//all routes here are protected — user must be logged in
router.post('/connect',protect,connectWhatsApp);
router.get('/status',protect,getWhatsAppStatus);
router.post('/disconnect',protect,disconnectWhatsApp);
router.post('/send',protect,sendBulkMessages);

// API key-based endpoint for sending messages
router.post('/send-via-api', validateApiKey, sendBulkMessagesViaApiKey);

module.exports=router;
