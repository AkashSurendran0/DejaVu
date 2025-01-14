const passport=require('passport')
const googleStrategy=require('passport-google-oauth20').Strategy
const users=require('../models/userSchema')
const env=require('dotenv').config()

passport.use(new googleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/user/auth/google/callback',
    passReqToCallback:true,
    scope: ['profile','email']
},

async (req,accessToken,refreshToken,profile,done)=>{
    try {
        let user=await users.findOne({googleId:profile.id})
        if(user){
            if(user.isBlocked){
                return done(null,false,{message: 'Your account has been blocked'})
            }
            return done(null,user)
        }else{
            user=new users({
                name:profile.displayName,
                email:profile.emails[0].value,
                googleId:profile.id
            })
            await users.insertMany(user)
            return done(null,user)
        }
    } catch (error) {
        return done(error,null)
    }
}
))

passport.serializeUser((user,done)=>{
    done(null,user.id)
})

passport.deserializeUser((id,done)=>{
    users.findById(id)
    .then(user=>{
        done(null,user)
    })
    .catch(err=>{
        done(err,null)
    })
})


module.exports = passport