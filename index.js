const {Client,LocalAuth}=require('whatsapp-web.js'); // Importing the Client and LocalAuth classes from the whatsapp-web.js library
const qrcode=require('qrcode-terminal');// Importing the qrcode-terminal library to generate QR codes in the terminal
const {sendMessages}=require('./sender'); // Importing the sendMessages function from the sender.js file
const readline=require('readline');
const fs=require('fs');
const PUPPETEER_ARGS = ['--no-sandbox', '--disable-setuid-sandbox'];


const client=new Client({
    authStrategy:new LocalAuth(),
    //headles browser configuration
    puppeteer:{
        headless:true, // run browswer invisible
        args:PUPPETEER_ARGS
    }
});

let sessionSaved=false; // flag to check if session is saved

const askQuestion=(question)=>{
    return new Promise((resolve)=>{
        const rl=readline.createInterface({
            input:process.stdin,
            output:process.stdout
        });
        rl.question(question,(answer)=>{
            rl.close();
            resolve(answer.trim());
        });
    });

};

const handleSessionCheck=async()=>{
  const sessionExists=fs.existsSync('.wwebjs_auth');
  if(sessionExists){
    console.log('saved session found');
    const answer=await askQuestion(' Do you want to logout?(yes/no):');
    if(answer=='yes' || answer=='y'){
        if (fs.existsSync('.wwebjs_auth')) {
            fs.rmSync('.wwebjs_auth', { recursive: true, force: true });
            console.log('🗑️  .wwebjs_auth cleared.');
        }

        if (fs.existsSync('.wwebjs_cache')) {
            fs.rmSync('.wwebjs_cache', { recursive: true, force: true });
            console.log('🗑️  .wwebjs_cache cleared.');
        }
    }
    else{
        console.log('using saved session. no qr needed!');
    }
  }  else{
    console.log('no saved session found. Please scan the QR code to login!');
  }
};

const start=async()=>{
    console.log('starting whatsapp client...');
    await handleSessionCheck();
    client.initialize();
};

// Event listener for when the client is ready
//'qr' event gives us the raw qr string 
client.on('qr',(qr)=>{
    console.log('\n scan this QR with whatsapp to login:');

    //converting the raw qr string into a qr code in the terminal
    qrcode.generate(qr,{small:true});

});

// Event listener for when the session is succefully stored in the disk and the client is authenticated
client.on('authenticated',()=>{
    if(!sessionSaved){
        sessionSaved=true;
        const isReturning=require('fs').existsSync('.wwebjs_auth');
        if(isReturning){
            console.log('auto login succesfully! No QR needed.');
        }else{
            console.log('session saved .  no qr needed next time!');
        }
    }
});

// event : when login fails
// solution ; delete the .wwebjs_auth folder and re-scan the qr code

client.on('auth-failure',(msg)=>{
    console.error('authentication failed:',msg);
    console.error('authentication failed, please delete the .wwebjs_auth folder and try again!');
    process.exit(1); // exit the process with an error code
});

//disconnected - whatsapp logout from the phone or session expired
client.on('disconnected',(reason)=>{
    console.error('whatsapp disconnected:',reason);
    process.exit(1); // exit the process with an error code
});

client.on('ready',async ()=>{
    console.log('whatsapp connected successfully!');

    try{
        await sendMessages(client);

    }catch(error){
        console.error('error occurred while sending messages:',error.message);
        process.exit(1); // exit the process with an error code
    }

    console.log('\n disconnecting whatsapp client');
    await client.destroy(); // gracefully close the client and the browser

    console.log('process completed successfully!');
    process.exit(0);
});
// Start the client — this launches the hidden Chromium browser
// Opens web.whatsapp.com inside it
// Then fires the 'qr' event so you can scan
start(); 