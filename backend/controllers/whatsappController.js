const clientManager=require('../services/clientManager');
const {sendMessages}=require('../services/sender');
const Session=require('../models/Session');

//connect whatsapp
//creates client and returns QR code for authentication
const connectWhatsApp=async(req,res)=>{
    try{
        const userId=req.user._id; // from auth middleware
        const status=clientManager.getStatus(userId);

        if(status==='connected'){
            return res.json({status:'connected',message:'Already connected to WhatsApp.'});
        }

        //webscocket events for QR code, ready, and disconnected
        const ws=req.app.get('wsClients')?.get(userId.toString());

        //create client
        await clientManager.createClient(
            userId,
            (qrImage)=>{
                if(ws && ws.readyState===1){
                    ws.send(JSON.stringify({type:'qr',qr:qrImage}));
                }
            },
            ()=>{
                if(ws && ws.readyState===1){
                    ws.send(JSON.stringify({type:'ready'}));
                }
            }, // onReady callback is handled in clientManager to update status
            (reason)=>{
                if(ws && ws.readyState===1){
                    ws.send(JSON.stringify({type:'disconnected',reason}));
                }   
            }
        );
        res.json({message:'WhatsApp connection initiated. Please scan the QR code sent via WebSocket.',status:'pending'});
    }catch(err){
        res.status(500).json({error:err.message});
    }
};

//get status

const getWhatsAppStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const status = clientManager.getStatus(userId);
    const session = await Session.findOne({ userId });

    res.json({
      status,
      isActive: session?.isActive || false,
      lastSeen: session?.lastSeen || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

//disconnect whatsapp

const disconnectWhatsApp = async (req, res) => {
  try {
    await clientManager.disconnectClient(req.user._id);
    res.json({ message: 'WhatsApp disconnected successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

//send messages

const sendBulkMessages = async (req, res) => {
  try {
    const { numbers, message } = req.body;
    const userId = req.user._id;

    if (!numbers || !numbers.length) {
      return res.status(400).json({ error: 'No numbers provided' });
    }

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const client = clientManager.getClient(userId);
    if (!client) {
      return res.status(400).json({ error: 'WhatsApp not connected' });
    }

    const ws = req.app.get('wsClients')?.get(userId.toString());

    // Start sending — runs in background
    // Response sent immediately — progress via WebSocket
    res.json({ message: 'Sending started', total: numbers.length });

    // Send in background after response    
    await sendMessages(client, userId, numbers, message, (progress) => {
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'progress', ...progress }));
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports={
    connectWhatsApp,
    getWhatsAppStatus,
    disconnectWhatsApp,
    sendBulkMessages
};

