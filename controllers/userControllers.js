const mongoose=require('mongoose')

const users=require('../models/userSchema')
const env=require('dotenv').config()
const sendMail=require('../helpers/mailHelper')
const bcrypt=require('../helpers/bcrypt')
const address = require('../models/addressSchema')
const orders = require('../models/orderSchema')
const products=require('../models/productSchema')
const categories = require('../models/categorySchema')
const wallets = require('../models/walletSchema')

const STATUS_SERVER_ERROR=parseInt(process.env.STATUS_SERVER_ERROR)
const STATUS_NOT_FOUND=parseInt(process.env.STATUS_NOT_FOUND)

const loadHomePage = async (req,res)=>{
    try {
        const topRatedProducts=await products.aggregate([
            {
                $lookup:{
                    from:'categories',
                    localField:'category',
                    foreignField:'_id',
                    as:'resultCategories'
                }
            },
            {
                $unwind:'$resultCategories'
            },
            {
                $match:{
                    isDeleted:false
                }
            },
            {
                $addFields:{
                    avgRating:{
                        $avg:'$review.rating'
                    }
                }
            },
            {
                $sort:{
                    avgRating:-1
                }
            },
            {
                $limit:8
            }
        ])
        const productsOnOffer=await products.find(
            {
                regularPrice:{
                    $gt:0
                }
            }
        )
        const kidsCategory=await categories.findOne({name:{$regex:'^kid', $options:'i'}})
        const kidsDress = await products.find({
            category: kidsCategory._id 
        }).limit(4);
        res.render('home', {
            topRatedProducts:topRatedProducts,
            productsOnOffer:productsOnOffer,
            kidsDress:kidsDress
        }) 
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        
    }
}

const loadLoginPage = async (req,res)=>{
    try {
        res.render('userlogin', {loginErr: req.flash('invalidUser'), userLogin: req.flash('userLogin')})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        
    }
}

const loadEmailSignupPage = async (req,res)=>{
    try {
        res.render('userEmailLogin', {emailReq:req.flash('emailReq'), otpExp: req.flash('otpExpired')})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        
    }
}

let storeOTP = {}

const generateOTP=()=>Math.floor(100000 + Math.random() * 900000)

const sendOTP = async (req,res)=>{
    try {
        const {email} = req.body
        const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
        if(!email){
            req.flash('emailReq', 'Email is required!')
            return res.redirect('/signUp-Email')
        }else if(!emailPattern.test(email)){
            req.flash('emailReq', 'Invalid Email Format!')
            return res.redirect('/signUp-Email')
        }
        const sameEmail=await users.findOne({email:email})
        if(sameEmail){
            req.flash('emailReq', 'User Exists')
            return res.redirect('/signUp-Email')
        }
        const otp=generateOTP()
        storeOTP[email]={otp, expires:Date.now() + 1*60*1000 }

        await sendMail({
            from: `DejaVu Ecommerce Website`,
            to: email,
            subject: 'Verification OTP',
            text: `Your otp is ${otp}. It is valid for 1 minute.`
        })

        setTimeout(()=>{
            delete storeOTP[email]
        },60000)
        req.session.userEmail = email
        res.render('verify-otp', {OTPerr: req.flash('OTPerr'), storedOTP: storeOTP[email]})
    } catch (error) {
        console.log(error);
        
        res.status(STATUS_SERVER_ERROR).render('404page')
        
    }
}

const verifyOTP = async (req,res)=>{
    try {
        const otp = req.query.otp
        const email = req.session.userEmail
        const storedOTP=storeOTP[email]
        
        if(parseInt(otp)==storedOTP.otp){
            delete storeOTP[email]
            req.session.authenticate=true
            res.json({success:true})
        }else{
            res.status(STATUS_NOT_FOUND).json({success:false})
        }
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        
    }
}

const loadSignupPage = async (req,res)=>{
    try {
        res.render('userSignup', {err:false})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        
    }
}

const resendOTP = async (req,res)=>{
    try {
        const email = req.session.userEmail
        const otp=generateOTP()
        storeOTP[email]={otp, expires:Date.now() + 1*60*1000 }

        await sendMail({
            from: `DejaVu Ecommerce Website`,
            to: email,
            subject: 'Verification OTP',
            text: `Your otp is ${otp}. It is valid for 1 minute.`
        })

        setTimeout(()=>{
            delete storeOTP[email]
        },60000)
        res.render('verify-otp', {OTPerr: req.flash('OTPerr')})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        
    }
}

const userSignup = async (req,res)=>{
    try {
        const email=req.session.userEmail
        const {name,password,confirmPassword}=req.body
        const passwordPattern=/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])[A-Za-z0-9!@#$%^&*]{8,}$/
        if(!passwordPattern.test(password)){
            req.flash('signupErr', 'Password doesnt match the criteria')
            return res.render('userSignup', {err: req.flash('signupErr')})
        }else if(password !== confirmPassword){
            req.flash('signupErr', 'Password Mismatch')
            return res.render('userSignup', {err: req.flash('signupErr')})
        }

        const hashedPass= await bcrypt.hashPassword(password)
        await users.insertMany({
            email: email,
            name: name,
            password: hashedPass
        })
        req.session.userEmail=email
        req.session.isLogged=true
        res.redirect('/')
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        
    }
}

const userLogout = async (req,res)=>{
    try {
        req.session.destroy(()=>{
            res.redirect('/')
        })
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        
    }
}

const userLogin = async (req,res)=>{
    try {
        const {email,password}=req.body
        const user = await users.findOne({
            email: email
        })
        if(!user){
            req.flash('invalidUser', 'User Not Found')
            return res.redirect('/login')
        }else if(user.isBlocked==true){
            req.flash('invalidUser', 'Unauthorized User')
            return res.redirect('/login') 
        }
        const check=await bcrypt.check(password,user.password)
        if(!check){
            req.flash('invalidUser', 'Password Incorrect')
            return res.redirect('/login')
        }
        req.session.userEmail=email
        req.session.isLogged = true
        res.redirect('/')
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        
    }
}

const loadEmailVerificationPage = async (req,res)=>{
    try {
        res.render('verifyEmail', {emailErr: req.flash('noUser')})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        
    }
}

const sendVerifyOTP = async (req,res)=>{
    try {
        const email = req.body.email
        req.session.userEmail = email
        const existingUser = await users.findOne({email: email})
        if(!existingUser){
            req.flash('noUser', 'User Doesnt Exist')
            return res.redirect('/forgot-password/emailverification')
        }else if(existingUser.isBlocked==true){
            req.flash('invalidUser', 'Unauthorized User')
            return res.redirect('/login')
        }
        const otp=generateOTP()
        storeOTP[email]={otp, expires:Date.now() + 1*60*1000 }

        await sendMail({
            from: `DejaVu Ecommerce Website`,
            to: email,
            subject: 'Verification OTP',
            text: `Your otp is ${otp}. It is valid for 1 minute.`
        })

        setTimeout(()=>{
            delete storeOTP[email]
        },60000)
        res.render('recoverPasswordOTP', {OTPerr: req.flash('OTPerr')})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        
    }
}

const verifyRecoverOTP = async (req,res)=>{
    try {
        (req.body);
        const {otp} = req.body
        const email = req.session.userEmail
        const storedOTP=storeOTP[email]
        
        if(parseInt(otp)==storedOTP.otp){
            delete storeOTP[email]
            req.session.authenticate=true
            res.json({success:true, redirectURL:'/changePassword'})
        }else{
            res.status(STATUS_NOT_FOUND).json({success:false})
        }
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        
    }
}

const loadChangePassword = async (req,res)=>{
    try {
        res.render('recoverPassword', {err:false})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        
    }
}

const changePassword = async (req,res)=>{
    try {
        const email=req.session.userEmail
        const {password,confirmPassword}=req.body
        const passwordPattern=/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])[A-Za-z0-9!@#$%^&*]{8,}$/
        if(!passwordPattern.test(password)){
            req.flash('signupErr', 'Password doesnt match the criteria')
            return res.render('recoverPassword', {err: req.flash('signupErr')})
        }else if(password !== confirmPassword){
            req.flash('signupErr', 'Password Mismatch')
            return res.render('recoverPassword', {err: req.flash('signupErr')})
        }
        const hashedPass=await bcrypt.hashPassword(password)
        await users.updateOne(
            {email: email},
            {$set: {password:hashedPass}}
        )
        req.flash('userLogin', 'Login using new Credentials')
        res.redirect('/login')
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        
    }
}

const loadBasicInfoPage = async (req,res)=>{
    try {
        const user=await users.findOne({email: req.session.userEmail})
        res.render('userInfo', {
            user: user, 
            msg:req.flash('msg'), 
            msg2:req.flash('msg2'),
            msg3:req.flash('msg3')
        })
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        
    }
}

const updateUser = async (req,res)=>{
    try {
        const id=req.params.id
        const imagePath=req.file ? `/uploads/${req.file.filename}` : null;
        const date=new Date(req.body.dob)
        const data={
            image: imagePath?? req.body.userExistingImage,
            phone: req.body.phone,
            name: req.body.name,
            gender: req.body.gender,
            dob: date.toLocaleDateString("en-US")
        }
        
        await users.updateOne(
            {_id: id},
            {$set: data}
        )
        req.flash('msg', 'User Updated Successfully')
        res.redirect('/settings/basicInfo')
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        
    }
}

const changePasswordFromSettings = async (req,res)=>{
    try {
        const id=req.params.id
        const user=await users.findById(id)
        const {oldPass,newPass,confirmNewPass}=req.body
        const check=await bcrypt.check(oldPass,user.password)
        const passwordPattern=/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])[A-Za-z0-9!@#$%^&*]{8,}$/
        if(!check){
            req.flash('msg2', 'Incorrect Password')
            return res.redirect('/settings/basicInfo')
        }
        if(newPass != confirmNewPass){
            req.flash('msg2', 'Password doesnt match')
            return res.redirect('/settings/basicInfo')
        }
        if(!passwordPattern.test(newPass)){
            req.flash('msg2', 'Password doesnt meet the criteria')
            return res.redirect('/settings/basicInfo')
        }
        const hashedPass=await bcrypt.hashPassword(newPass)
        await users.updateOne(
            {_id: id},
            {$set: {password:hashedPass}}
        )
        req.flash('msg3', 'Password updated successfully')
        res.redirect('/settings/basicInfo')
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        
    }
}

const deleteAccount = async (req,res)=>{
    try {
        const id=req.params.id
        await users.deleteOne(
            {_id: id}
        )
        await address.deleteMany(
            {user: id}
        )
        req.session.destroy(()=>{
            res.redirect('/')
        })
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        
    }
}

const validatePassword = async (req,res)=>{
    try {
        const {userId,password}=req.body
        
        const user=await users.findById(userId)
        const isMatch=await bcrypt.check(password,user.password)
        if(!isMatch){
            return res.status(400).json({success:false})
        }
        res.json({success:true})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        
    }
}

const loadWalletPage = async (req,res)=>{
    try {
        const userEmail=req.session.userEmail
        const user=await users.findOne({email:userEmail})
        const refundOrders=await wallets.findOne({user:user._id}).populate('creditHistory.productId')
        const debitOrders=await wallets.aggregate([
            {
                $match:{
                    user:new mongoose.Types.ObjectId(user._id)
                }
            },
            {
                $unwind:'$debitHistory'
            },
            {
                $lookup:{
                    from:'orders',
                    localField:'debitHistory.orderId',
                    foreignField:'_id',
                    as:'resultOrders'
                }
            },
            {
                $unwind:'$resultOrders'
            },
            {
                $lookup:{
                    from:'products',
                    localField:'resultOrders.products.productId',
                    foreignField:'_id',
                    as:'resultProducts'
                }
            },
            {
                $project: {
                    _id: 1,
                    user: 1,
                    "debitHistory.orderId": 1,
                    "debitHistory.debitDate": 1,
                    "resultOrders._id": 1,
                    "resultOrders.status": 1,
                    "resultOrders.paymentmethod": 1,
                    "resultOrders.quantity":1,
                    "resultOrders.totalAmount": 1,
                    "resultOrders.createdAt": 1,
                    "resultProducts": 1
                  }
            }
        ])        
        res.render('wallet', {
            refundOrders:refundOrders,
            debitOrders:debitOrders
        })
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        
    }
}

const loadAboutUsPage = async (req,res)=>{
    try {
        res.render('aboutUs')
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        
    }
}

const loadContactUsPage = async (req,res)=>{
    try {
        res.render('contactUs')
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        
    }
}

const sendContactMail = async (req,res)=>{
    try {
        const {name,email,subject,message}=req.body
        try {
            await sendMail({
                from: email,
                to: 'akashsurendran1001@gmail.com',
                subject: subject,
                text: `This message is from ${name}. Message: ${message}`
            })
            res.json({success:true})
        } catch (error) {
            res.json({success:false})
        }
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        
    }
}

module.exports={
    loadHomePage,
    loadLoginPage,
    loadEmailSignupPage,
    sendOTP,
    verifyOTP,
    resendOTP,
    userSignup,
    userLogout,
    userLogin,
    loadEmailVerificationPage,
    sendVerifyOTP,
    verifyRecoverOTP,
    loadSignupPage,
    changePassword,
    loadChangePassword,
    loadBasicInfoPage,
    updateUser,
    changePasswordFromSettings,
    deleteAccount,
    validatePassword,
    loadWalletPage,
    loadAboutUsPage,
    loadContactUsPage,
    sendContactMail
}