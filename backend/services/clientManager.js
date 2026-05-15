const {Client,RemoteAuth}=require('whatsapp-web.js');
const{MongoStore}=require('wwebjs-mongo');
const mongoose=require('mongoose');
const qrcode=require('qrcode');
const Session=require('../models/Session');

//client store
const clients=new Map();

//get clinet by id
const getClient=(id)=>{
    return clients.get(userId.toString()) || null;
};

// get status of client

const getStatus=(userId)=>{
    const entry=clients.get(userId.toString());
    if(!entry){
        return 'disconnected';
    }
    return entry.status;
};

//create client

const createClient=async(userId,onQR,onReady,onDisconnected)=>{
    const userIdStr=userId.toString(); // ensure it's a string

    const existing=clients.get(userIdStr);
    if(existing && existing.status==='connected'){
        console.log(`Client already connected for user: ${userIdStr}`);
        onReady(); // call onReady immediately
        return existing.client; 
    }


    // Create new client with MongoDB session store
    const store=new MongoStore({mongoose});
    const client=new Client({
        authStrategy:new RemoteAuth({
            clientId:userIdStr,
            store:store,
            backupSyncIntervalMs:300000 // 5 minutes
        }),
        puppeteer:{
            headless:true,
            args:[
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                'disable-gpu',
            ]
        }
    });

    //store client and status
    clients.set(userIdStr,{client,status:'pending'});

    //qr code event
    //fires when whatsapp needs QR scan
    client.on('qr',async(qr)=>{
        console.log(`QR Code received for user: ${userIdStr}`);
        try{
            const qrImage=await qrcode.toDataURL(qr);// convert QR code to image
            onQR(qrImage);// send image to frontend
        }catch(err){
            console.error(`QR code generation failed for user: ${userIdStr}`,err);
        }
    });
    

    //authianticated event
    //fires when qr scan successful
    // session saved automatically in MongoDB by MongoStore
    client.on('authenticated',()=>{
        console.log(`Client authenticated for user: ${userIdStr}`);
    });

    //remote session saved event
    client.on('remote_session_saved',()=>{
        console.log(`Remote session saved for user: ${userIdStr}`);
    });

    //ready event
    //fires when client is ready to send messages
    client.on('ready',async()=>{
        console.log(`Client ready for user: ${userIdStr}`);
        
        //update status
        const entry=clients.get(userIdStr);
        if(entry){
            entry.status='connected';
        }

        await Session.findOneAndUpdate(
            {userId},
            {isActive:true,lastSeen:new Date()},
            {upsert:true,new:true} // create if not exists
        );

        onReady(); // notify frontend
    });

    //auth failure or disconnected event
    client.on('auth_failure',async(msg)=>{
        console.error(`Authentication failure for user: ${userIdStr}`,msg);
        clients.delete(userIdStr); // remove client on auth failure

        await Session.findOneAndUpdate(
            {userId},
            {isActive:false},
            {upsert:true}
        );
    });

    //disconnected

    client.on('disconnected',async(reason)=>{
        console.log(`Client disconnected for user: ${userIdStr}. Reason: ${reason}`);
        clients.delete(userIdStr); // remove client on disconnect

        await Session.findOneAndUpdate(
            {userId},
            {isActive:false},
            {upsert:true}
        );
        onDisconnected(reason); // notify frontend
    });

    client.initialize(); // start the client

    return client;
};

//disconnect client
const disconnectClient=async(userId)=>{
    const userIdStr=userId.toString();
    const entry=clients.get(userIdStr);

    if(entry){
        try{
            await entry.client.logout(); // logout to clear session
            await entry.client.destroy(); // destroy puppeteer instance

        }catch(err){
            console.error(`Error disconnecting client for user: ${userIdStr}`,err);
        }
        clients.delete(userIdStr); // remove from map
    }

    await Session.findOneAndUpdate(
        {userId},
        {isActive:false},
        {upsert:true}
    );

    console.log(`Client disconnected for user: ${userIdStr}`);
};


module.exports={
    createClient,
    getClient,
    getStatus,
    disconnectClient
};