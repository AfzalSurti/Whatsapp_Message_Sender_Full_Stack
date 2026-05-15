const passport=require('passport');
const GoogleStrategy=require('passport-google-oauth20').Strategy;
const User=require('../models/User'); 

passport.use(
    new GoogleStrategy(
        {
            clientID:process.env.CLIENT_ID,
            clientSEcret:process.env.CLIENT_SECRET,
            callbackURL:'/api/auth/google/callback'
        },
        async (accessToken, refreshToken, profile, done) => {
            try{
                // Check if user with Google ID already exists
                let user=await User.findOne({googleId:profile.id});
                if(user){
                    return done(null,user);
                }
                // If user with same email exists, link Google account
                user=await User.findOne({email:profile.emails[0].value});
                if(user){
                    user.googleId=profile.id;
                    user.authProvider='google';
                    user.avatar=profile.photos[0].value;
                    await user.save();
                    return done(null,user);
                }
                // If no user, create new one
                user=await User.create({
                    name:profile.displayName,
                    email:profile.emails[0].value,
                    googleId:profile.id,
                    avatar:profile.photos[0].value,
                    authProvider:'google',
                    isVerified:true

                });

                return done(null,user);
            }catch(err){
                return done(err,null);
            }

        }
    )
);

module.exports=passport;