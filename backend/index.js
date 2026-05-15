const express=require('express');
const cors=require('cors'); 
const morgan=require('morgan'); 
const rateLimit=require('express-rate-limit');
require('dotenv').config();
const connectDB=require('./config/db');
const passport=require('./config/passport'); // Passport configuration
const authRoutes=require('./routes/auth');
const whatsappRoutes=require('./routes/whatsapp');
const app=express();

const PORT=process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Rate Limiting
const limiter=rateLimit({
    windowMs:15*60*1000,
    max:100,
    message:{error:'Too many requests. Please try again later.'}
});


// Middleware
app.use(cors({
    origin:process.env.CLIENT_URL,  // Replace with your frontend URL
    credentials:true
}));

app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({extended:true}));// For parsing application/x-www-form-urlencoded
app.use(morgan('dev')); // Logging HTTP requests
app.use('/api',limiter); // Apply rate limiting to API routes
app.use(passport.initialize()); // Initialize Passport
//health check route

app.get('/health',(req,res)=>{
    res.json({
        status:'ok',
        message:'Whatsapp Message Sender API is running',
        timestamp:new Date().toLocaleString("en-IN",{
            timeZone:"Asia/Kolkata"
        })
    });
});

// Routes
app.use('/api/auth',authRoutes); // Authentication routes
app.use('/api/whatsapp',whatsappRoutes); // WhatsApp routes

//global error handler
//catches any error
app.use((err,req,res,next)=>{
    console.error('Error:',err.message);
    res.status(err.status||500).json({
        error:err.message||'Internal Server Error'
    });
});

//404 handler
app.use((req,res)=>{
    res.status(404).json({
        error:'Route not found'
    });
});

//start server

app.listen(PORT,()=>{
    console.log(`Server Running On http://localhost:${PORT}`);
});


