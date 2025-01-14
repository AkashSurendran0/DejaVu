const products=require('../models/productSchema')
const banners=require('../models/bannerSchema')
const users=require('../models/userSchema')
const env=require('dotenv').config()
const {ObjectId}=require('mongodb')
const offers = require('../models/offerSchema')
const categories = require('../models/categorySchema')
const cron = require('node-cron')
const sendMail=require('../helpers/mailHelper')

const STATUS_SERVER_ERROR=process.env.STATUS_SERVER_ERROR
const STATUS_NOT_FOUND=process.env.STATUS_NOT_FOUND

cron.schedule('*/1 * * * *',async (req,res)=>{
    const allOffers=await offers.find()
    for(let i=0;i<allOffers.length;i++){
        if(new Date() > new Date(allOffers[i].endDate)){
            await offers.deleteOne(
                {endDate: allOffers[i].endDate}
            )
        }else if(new Date() > new Date(allOffers[i].startDate)){
            if(!allOffers[i].isActive){
                await offers.updateMany(
                    {_id: allOffers[i].id},
                    {$set: {isActive:true}}

                )
            }
        }
    }
})

const loadHomePage = async (req,res)=>{
    try {
       res.render('home') 
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

const loadShopPage = async (req,res)=>{
    try {
        const banner=await banners.findOne({category: 'shirts'})
        const allCategories=await categories.find()
        const category=req.query.category || allCategories[0].name
        let productList=await products.aggregate([
            {$lookup:{
                from: 'categories',
                foreignField: '_id',
                localField: 'category',
                as: 'resultProducts'
            }},
            {
                $unwind: '$resultProducts'
            },
            {
                $match: {
                    'resultProducts.name':{$regex:`^${category}`, $options:'i'},
                    isDeleted:false
                }
            }
        ])

        if (!productList || productList.length === 0) {
            productList = false;
          }
        
          let categoryName = productList && productList[0]?.resultProducts?.name;
          if (!categoryName) {
            categoryName=false;
          }
        const allOffers=await offers.findOne({category: categoryName})
        let minPrice=false
        let maxPrice=false
        let offer=false
        if(allOffers && allOffers.isActive){
            minPrice=allOffers.minAmount
            maxPrice=allOffers.maxAmount
            offer=allOffers.offer
        }      
          
        res.render('shop', {
            product: productList, 
            banner:banner,
            minPrice: minPrice,
            maxPrice: maxPrice,
            offer: offer,
            allCategories: allCategories
        })
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

const loadProductDetailsPage = async (req,res)=>{
    try {
        const id=req.params.id
        const singleProduct=await products.findById(id)
        let avgRating
        if(singleProduct.review.length>0){
            avgRating=await products.aggregate([
                {$match:{_id: new ObjectId(id)}},
                {$unwind:'$review'},
                {$group:{_id:null, rating:{$avg:'$review.rating'}}}
            ])
        }

        const productCategory=await categories.findOne({_id: singleProduct.category})
        const offerPrices=await offers.aggregate([
            {$match: {
                $and:[
                    {category: productCategory.name},
                    {isActive: true}
                ]
            }},
            {$project:{_id:0, maxAmount:1, minAmount:1, offer:1}}
        ])        
        
        let productRating=0
        if(avgRating){
            productRating=Math.floor(avgRating[0].rating)
        }
        
        const similarProducts=await products.aggregate([
            {$lookup:{
                from: 'categories',
                foreignField: '_id',
                localField: 'category',
                as: 'resultProducts'
            }},
            {
                $unwind: '$resultProducts'
            },
            {
                $match: {
                    'resultProducts._id':singleProduct.category,
                    isDeleted:false
                }
            }
        ])

        const randomNumbers=new Set()
        while (randomNumbers.size<3){
            const randomNum=Math.floor(Math.random()*10)+1
            if(randomNum<=similarProducts.length){
                randomNumbers.add(randomNum)
            }
        }
        let simProducts=[]
        const randomNums=Array.from(randomNumbers)
        for(let i=0;i<randomNums.length;i++){
            simProducts[i]=similarProducts[randomNums[i]-1]
        }
        
        res.render('singleProduct', {
            product:singleProduct, 
            similarProducts: simProducts, 
            rating: productRating,
            offerPrices: offerPrices
        })
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

const addProductReview = async (req,res)=>{
    try {
        console.log(req.session);
        if(req.session.userEmail){
            const id=req.params.id
            const product=await products.findById(id)
            const user=await users.findOne({email:req.session.userEmail})
            console.log(user);
            let data={
                user:user.name,
                rating:req.body.rating,
                desc:req.body.comment
            }
            await products.updateOne(
                {_id: product.id},
                {$push:{review:data}}
            )
            res.redirect(`/user/shop/product-details/${id}`)
        }else{
            res.redirect('/user/login')
        }
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

const loadLoginPage = async (req,res)=>{
    try {
        res.render('userlogin', {loginErr: req.flash('invalidUser'), userLogin: req.flash('userLogin')})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

const loadEmailSignupPage = async (req,res)=>{
    try {
        res.render('userEmailLogin', {emailReq:req.flash('emailReq'), otpExp: req.flash('otpExpired')})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
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
            return res.redirect('/user/signUp-Email')
        }else if(!emailPattern.test(email)){
            req.flash('emailReq', 'Invalid Email Format!')
            return res.redirect('/user/signUp-Email')
        }
        const sameEmail=await users.findOne({email:email})
        if(sameEmail){
            req.flash('emailReq', 'User Exists')
            return res.redirect('/user/signUp-Email')
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
            console.log('Otp deleted');
        },60000)
        req.session.userEmail = email
        console.log(storeOTP[email]);
        res.render('verify-otp', {OTPerr: req.flash('OTPerr'), storedOTP: storeOTP[email]})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

const verifyOTP = async (req,res)=>{
    try {
        const {otp} = req.body
        const email = req.session.userEmail
        const storedOTP=storeOTP[email]
        
        if(parseInt(otp)==storedOTP.otp){
            delete storeOTP[email]
            req.session.authenticate=true
            res.json({success:true, redirectURL:'/user/signup-details'})
        }else{
            res.status(STATUS_NOT_FOUND).json({success:false})
        }
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

const loadSignupPage = async (req,res)=>{
    try {
        res.render('userSignup', {err:false})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
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
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
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
        await users.insertMany({
            email: email,
            name: name,
            password: password
        })
        req.session.userEmail=email
        req.session.isLogged=true
        res.redirect('/user')
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

const userLogout = async (req,res)=>{
    try {
        req.session.destroy(()=>{
            res.redirect('/user')
        })
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

const userLogin = async (req,res)=>{
    try {
        const {email,password}=req.body
        const user = await users.findOne({
            email: email,
            password: password
        })
        console.log(user);
        if(!user){
            req.flash('invalidUser', 'User Not Found')
            return res.redirect('/user/login')
        }else if(user.isBlocked==true){
            req.flash('invalidUser', 'Unauthorized User')
            return res.redirect('/user/login') 
        }
        req.session.userEmail=email
        req.session.isLogged = true
        res.redirect('/user')
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

const loadEmailVerificationPage = async (req,res)=>{
    try {
        res.render('verifyEmail', {emailErr: req.flash('noUser')})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

const sendVerifyOTP = async (req,res)=>{
    try {
        const email = req.body.email
        req.session.userEmail = email
        const existingUser = await users.findOne({email: email})
        if(!existingUser){
            req.flash('noUser', 'User Doesnt Exist')
            return res.redirect('/user/forgot-password/emailverification')
        }else if(existingUser.isBlocked==true){
            req.flash('invalidUser', 'Unauthorized User')
            return res.redirect('/user/login')
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
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

const verifyRecoverOTP = async (req,res)=>{
    try {
        console.log(req.body);
        const {otp} = req.body
        const email = req.session.userEmail
        const storedOTP=storeOTP[email]
        
        if(parseInt(otp)==storedOTP.otp){
            delete storeOTP[email]
            req.session.authenticate=true
            res.json({success:true, redirectURL:'/user/changePassword'})
        }else{
            res.status(STATUS_NOT_FOUND).json({success:false})
        }
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

const loadChangePassword = async (req,res)=>{
    try {
        res.render('recoverPassword', {err:false})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
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
        await users.updateOne(
            {email: email},
            {$set: {password:confirmPassword}}
        )
        req.flash('userLogin', 'Login using new Credentials')
        res.redirect('/user/login')
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

module.exports={
    loadHomePage,
    loadShopPage,
    loadProductDetailsPage,
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
    addProductReview,
    changePassword,
    loadChangePassword
}