const express=require('express');
const router=express.Router();
const {protect}=require('../middleware/auth');
const{
    connectWhatsApp,
    getWhatsAppStatus,
    disconnectWhatsApp,
    sendBulkMessages
}=require('../controllers/whatsappController');

//all routes here are protected — user must be logged in
router.post('/connect',protect,connectWhatsApp);
router.get('/status',protect,getWhatsAppStatus);
router.post('/disconnect',protect,disconnectWhatsApp);
router.post('/send',protect,sendBulkMessages);

module.exports=router;
