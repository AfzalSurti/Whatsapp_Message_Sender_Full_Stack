const jwt=require('jsonwebtoken');
const {validationResult}=require('express-validator');
const User=require('../models/User');

// generate JWT token
const generateToken=(id)=>{
    return jwt.sign(
        {id},
        process.env.JWT_SECRET,
        {expiresIn:process.env.JWT_EXPIRES_IN}
    );
};

//     User Signup

const signup=async(req,res)=>{
    try{
        const errors=validationResult(req);
        if(!errors.isEmpty()){
            return res.status(400).json({errors:errors.array()});
        }
        const {name,emnail,password}=req.body;
        const existingUser=await User.findOne({email});
        if(existingUser){
            return res.status(400).json({error:'User already exists with this email'});
        }
        const user=await User.create({name,email,password});

        const token=generateToken(user._id);
        res.status(201).json({token,user});

    }catch(err){
        res.status(500).json({error:err.message});
    }
};

//     User Login

const login=async(req,res)=>{
    try{
        const errors=validationResult(req);
        if(!errors.isEmpty()){
            return res.status(400).json({errors:errors.array()});
        }
        const {email,password}=req.body;
        const user=await User.findOne({email}).select('+password'); // include password for comparison
        if(!user){
            return res.status(400).json({error:'Invalid email or password'});
        }
        if(user.authProvider==='google'){
            return res.status(400).json({
                error:'This email is registered via Google. Please use Google login.'
            });
        }

        const isMatch=await user.comparePassword(password);
        if(!isMatch){
            return res.status(401).json({error:'Invalid email or password'});
        }
        const token=generateToken(user._id);

        res.json({token,user});
    }catch(err){
        res.status(500).json({error:err.message});
    }
};

//     Get Current User

const getMe=async(req,res)=>{
    res.json({user:req.user});
};

//     Google OAuth Callback
const googleCallback=async(req,res)=>{
    const token=generateToken(req.user._id);
    res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}`);
};

module.exports={signup,login,getMe,googleCallback};