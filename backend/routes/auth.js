const express=require('express');
const router=express.Router();
const {body}=require('express-validator');
const passport=require('passport'); // for Google OAuth
const {
    signup,
    login,
    getMe,
    googleCallback
}=require('../controllers/authController');

const {protect}=require('../middleware/auth');


//validation rules for signup

const signupValidation=[
    body('name').trim().notEmpty().withMessage('Name is Required'),
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password').isLength({min:6}).withMessage('Password must be at least 6 characters')
];

//validation rules for login
const loginValidation=[
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password').notEmpty().withMessage('Password is required')
];

//Local Auth Routes
router.post('/signup',signupValidation, signup);// POST /api/signup
router.post('/login'.loginValidation,login);// POST /api/login
router.get('/me',protect,getMe);// GET /api/me

//Google OAuth Routes
//step 1: initiate Google OAuth flow
router.get('/google',
    passport.authenticate('google',{scope:['profile','email']})
);

//step 2: handle callback from Google
router.get('/google/callback',
    passport.authenticate('google',{
        failureRedirect:`${process.env.CLIENT_URL}/login?error=oauth_failed`,
        session:false // we are using JWTs, no sessions
    }),
    googleCallback // controller to generate JWT and send response
);

module.exports=router;