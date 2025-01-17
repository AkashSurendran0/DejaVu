const express=require('express')
const routes=express.Router()
const userRoutes=require('../controllers/userControllers')
const passport=require('passport')
const userAuth=require('../middlewares/userAuth')
const blockCheck=require('../middlewares/blockedCheck')
const allowAuth=require('../middlewares/loginPageAuth')

routes.get('/', userRoutes.loadHomePage)
routes.get('/shop', blockCheck, userRoutes.loadShopPage)
routes.get('/shop/product-details/:id', blockCheck, userRoutes.loadProductDetailsPage)
routes.post('/shop/product-details/add-review/:id', userRoutes.addProductReview)
routes.get('/login', allowAuth, blockCheck, userRoutes.loadLoginPage)
routes.get('/signup-Email', allowAuth, blockCheck, userRoutes.loadEmailSignupPage)
routes.post('/signup-SendOTP', userRoutes.sendOTP)
routes.post('/signup-VerifyOTP', userRoutes.verifyOTP)
routes.get('/changePassword', allowAuth, blockCheck, userAuth, userRoutes.loadChangePassword)
routes.post('/changePassword', userRoutes.changePassword)
routes.post('/resendOTP', userRoutes.resendOTP)
routes.get('/signup-details', allowAuth, blockCheck, userAuth, userRoutes.loadSignupPage)
routes.post('/signup-details', userRoutes.userSignup)
routes.post('/logout', userRoutes.userLogout)
routes.post('/login', userRoutes.userLogin)
routes.get('/forgot-password/emailverification', allowAuth, blockCheck, userRoutes.loadEmailVerificationPage)
routes.post('/signup-SendVerifyOTP', userRoutes.sendVerifyOTP)
routes.post('/recover-VerifyOTP', userRoutes.verifyRecoverOTP)
routes.get('/auth/google', allowAuth, passport.authenticate('google'))
routes.get('/auth/google/callback', allowAuth, passport.authenticate('google',{failureRedirect:'/user/login'}),(req,res)=>{
    req.session.userEmail=req.user.email
    req.session.isLogged = true
    res.redirect('/user')
})

module.exports=routes