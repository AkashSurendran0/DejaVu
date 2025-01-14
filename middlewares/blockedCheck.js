const users=require('../models/userSchema')

const blockCheck = async (req,res,next)=>{
    try {
        if(!req.session.isLogged){
            return next()
        }
        const user=await users.findOne({email: req.session.userEmail})
        if (user && user.isBlocked) {
            return res.status(403).send('Your account is blocked.');
        }
        next()
    } catch (error) {
        console.error('Error in blockCheck middleware:', error.message);
        res.status(500).send('An error occurred while processing your request.');
    }
}

module.exports=blockCheck