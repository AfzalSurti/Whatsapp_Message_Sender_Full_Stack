const jwt=require('jsonwebtoken');
const User=require('../models/User');

// Middleware to protect routes
const protect=async(req,res,next)=>{
    try{
        let token;

        if(
            req.headers.authorization &&
            req.headers.authorization.startsWith('Bearer')
        ){
            token=req.headers.authorization.split(' ')[1]; // Get token from header
        }

        if(!token){
            return res.status(401).json({error:'Not authorized, no token'});
        }

        const decoded=jwt.verify(token.process.env.JWT_SECRET);

        req.user=await User.findById(decoded.id);

        if(!req.user){
            return res.status(401).json({error:'Not authorized, user not found'});
        }

        next();

    }catch(err){
        console.error('Auth middleware error:',err.message);
        res.status(401).json({error:'Not authorized, token failed'});
    }
};

module.exports={protect};