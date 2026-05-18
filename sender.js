const fs=require('fs');
const csv=require('csv-parser');
const path=require('path');
const readline=require('readline');
const {generateMessage}=require('./ai');

const CONFIG={
    minDelay:5000,
    maxDelay:8000,
    batchLimit:50,
    csvFile:path.join(__dirname,'numbers.csv'),
    logFile:path.join(__dirname,'results.log')
};

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

//genarte message using ai
const getMessage = async () => {

    console.log('📝 How do you want to write your message?');
    console.log('   1. Write manually');
    console.log('   2. Generate with AI');

    const choice = await askQuestion('Enter choice (1 or 2): ');

    // OPTION 1 — Manual input
    if (choice === '1') {
        const message = await askQuestion('📝 Enter your message: ');
        if (!message) {
            console.error('❌ Message cannot be empty. Exiting.');
            process.exit(1);
        }
        return message;

    // OPTION 2 — AI generation via OpenRouter
    } else if (choice === '2') {
        const prompt = await askQuestion('🤖 Describe your message (e.g. "Diwali offer, casual friendly tone"): ');
        if (!prompt) {
            console.error('❌ Prompt cannot be empty. Exiting.');
            process.exit(1);
        }

        console.log('\n⏳ Generating message with AI...');

        try {
            // Call ai.js which hits OpenRouter API
            const generated = await generateMessage(prompt);

            console.log('\n🤖 AI Generated Message:');
            console.log(`\n"${generated}"\n`);

            // Let user confirm or manually edit
            const confirm = await askQuestion('Use this message? (yes/no): ');

            if (confirm === 'yes' || confirm === 'y') {
                return generated; // use AI message as is
            } else {
                // User wants to edit manually
                const edited = await askQuestion('📝 Enter your edited message: ');
                if (!edited) {
                    console.error('❌ Message cannot be empty. Exiting.');
                    process.exit(1);
                }
                return edited;
            }

        } catch (err) {
            // AI failed — fallback to manual input gracefully
            console.error(`❌ AI generation failed: ${err.message}`);
            console.log('↩️  Falling back to manual input.\n');
            const message = await askQuestion('📝 Enter your message: ');
            if (!message) {
                console.error('❌ Message cannot be empty. Exiting.');
                process.exit(1);
            }
            return message;
        }

    } else {
        console.error('❌ Invalid choice. Enter 1 or 2. Exiting.');
        process.exit(1);
    }
};

const sendMessages=async (client)=>{
    const message=await getMessage();
    console.log(`\n Final message to send: "${message}"`);


    const numbers=await readCSV();
    console.log(`\n total numbers to send: ${numbers.length}`);

    if(numbers.length>CONFIG.batchLimit){
        console.warn(`\n warning: you have ${numbers.length} numbers which exceeds the batch limit of ${CONFIG.batchLimit}. Only the first ${CONFIG.batchLimit} numbers will be processed.`);
        numbers.splice(CONFIG.batchLimit);
    }

    const results={sent:0,failed:0,skipped:0};

    for(let i=0;i<numbers.length;i++){
        const rawNumber=numbers[i];

        console.log(`\n[${i+1}/${numbers.length}] Processing number: ${rawNumber}`);
        try{
            const cleanNumber=rawNumber.replace(/\D/g,''); // remove non-digit characters

            if(cleanNumber.length<10){
                console.warn(`skipping ${rawNumber}: invalid number format`);
                results.skipped++;
                continue;
            }

            const whatsappId=`${cleanNumber}@c.us`;

            const isRegistered=await client.isRegisteredUser(whatsappId);

            if(!isRegistered){
                console.log(`Not on whatsapp, skipping ${rawNumber}`);
                results.skipped++;
                logResult(rawNumber,'NOT_ON_WHATSAPP');
                continue;
            }

            const uniqueMessage=message+'\u200B'.repeat(i+1);

            await client.sendMessage(whatsappId,uniqueMessage);
            console.log(`message sent to ${rawNumber}`);
            results.sent++;
            logResult(rawNumber,'SENT');
        } catch (error) {
            console.error(`Error sending message to ${rawNumber}:`, error);
            results.failed++;
            logResult(rawNumber, `FAILED:${error.message}`);
        }
        const delay=getRandomDelay(CONFIG.minDelay,CONFIG.maxDelay);
        console.log(`waiting for ${(delay/1000).toFixed(1)} ms before next message...`);
        await sleep(delay);
    }

    console.log('\nMessage sending completed!');
    console.log("send",results.sent);
    console.log("failed",results.failed);
    console.log("skipped",results.skipped);
    console.log("total",numbers.length);
};

const readCSV = () => {
  return new Promise((resolve, reject) => {
    const numbers = [];

    // Check if file exists before reading
    if (!fs.existsSync(CONFIG.csvFile)) {
      reject(new Error(`numbers.csv not found at: ${CONFIG.csvFile}`));
      return;
    }

    fs.createReadStream(CONFIG.csvFile) // open file as stream
      .pipe(csv())                       // parse each line as CSV row
      .on('data', (row) => {
        // Extract value from 'number' column — trim whitespace
        const num = row['number']?.trim();
        if (num) numbers.push(num);      // add to array if not empty
      })
      .on('end', () => resolve(numbers)) // return array when done
      .on('error', (err) => reject(err));// throw if file read fails
  });
};

// Appends each result to results.log with timestamp
const logResult = (number, status) => {
  const timestamp = new Date().toLocaleString("en-IN", {
  timeZone: "Asia/Kolkata",
});

const line = `${timestamp} | ${number} | ${status}\n`;
  fs.appendFileSync(CONFIG.logFile, line);    // append — never overwrites
};

const getRandomDelay = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// Export sendMessages so index.js can import and call it
module.exports = { sendMessages };
