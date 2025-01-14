const express=require('express')
const routes=express.Router()
const userRoutes=require('../controllers/userControllers')
const passport=require('passport')
const userAuth=require('../middlewares/userAuth')
const blockCheck=require('../middlewares/blockedCheck')

routes.get('/', userRoutes.loadHomePage)
routes.get('/shop', blockCheck, userRoutes.loadShopPage)
routes.get('/shop/product-details/:id', blockCheck, userRoutes.loadProductDetailsPage)
routes.post('/shop/product-details/add-review/:id', userRoutes.addProductReview)
routes.get('/login', blockCheck, userRoutes.loadLoginPage)
routes.get('/signup-Email', blockCheck, userRoutes.loadEmailSignupPage)
routes.post('/signup-SendOTP', userRoutes.sendOTP)
routes.post('/signup-VerifyOTP', userRoutes.verifyOTP)
routes.get('/changePassword', blockCheck, userAuth, userRoutes.loadChangePassword)
routes.post('/changePassword', userRoutes.changePassword)
routes.post('/resendOTP', userRoutes.resendOTP)
routes.get('/signup-details', blockCheck, userAuth, userRoutes.loadSignupPage)
routes.post('/signup-details', userRoutes.userSignup)
routes.get('/logout', userRoutes.userLogout)
routes.post('/login', userRoutes.userLogin)
routes.get('/forgot-password/emailverification', blockCheck, userRoutes.loadEmailVerificationPage)
routes.post('/signup-SendVerifyOTP', userRoutes.sendVerifyOTP)
routes.post('/recover-VerifyOTP', userRoutes.verifyRecoverOTP)
routes.get('/auth/google', passport.authenticate('google'))
routes.get('/auth/google/callback', passport.authenticate('google',{failureRedirect:'/user/login'}),(req,res)=>{
    req.session.userEmail=req.user.email
    req.session.isLogged = true
    res.redirect('/user')
})

module.exports=routes