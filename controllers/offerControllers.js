const mongoose=require('mongoose')

const categories=require('../models/categorySchema')
const carts=require('../models/cartSchema')
const products=require('../models/productSchema')
const offers=require('../models/offerSchema')
const users=require('../models/userSchema')
const cron = require('node-cron')

const STATUS_SERVER_ERROR=parseInt(process.env.STATUS_SERVER_ERROR)

cron.schedule('*/1 * * * *',async (req,res)=>{
    const allOffers=await offers.find()
    
    if(allOffers.length>0){
        for(let i=0;i<allOffers.length;i++){
            const currentDate=new Date()
            const startDate=new Date(allOffers[i].startDate)
            const endDate=new Date(allOffers[i].endDate)
    
            const normalizeDate = (date) =>{
                return new Date(
                    date.getFullYear(),
                    date.getMonth(),
                    date.getDate(),
                    date.getHours(),
                    date.getMinutes()
                )
            }
    
            const normalizeCurrentDate=normalizeDate(currentDate).getTime()            
            const normalizeStartDate=normalizeDate(startDate).getTime()
            const normalizeEndDate=normalizeDate(endDate).getTime()
            
            const allCarts=await carts.find().populate('products.productId')
            
            if(normalizeCurrentDate >= normalizeEndDate){
                if(allCarts.length>0){
                    allCarts.forEach(userCart=>{
                        if(userCart.products.length>0){
                            userCart.products.forEach(async product=>{
                                if(product.productId.regularPrice){
                                    await carts.updateOne(
                                        {
                                            _id: userCart._id
                                        },
                                        [
                                            {
                                                $set: {
                                                    totalAmount: {
                                                        $add: [
                                                            { $subtract: ["$totalAmount", {
                                                                $multiply:[product.productId.amount,product.quantity]
                                                            }] },
                                                            {
                                                                $multiply:[product.productId.regularPrice,product.quantity]
                                                            }
                                                        ]
                                                    }
                                                }
                                            }
                                        ]
                                    )
                                }
                            })
                        }
                    })
                } 
                
                if(allOffers[i].isActive){
                    try {
                        await products.updateMany(
                            {
                                regularPrice: {$exists:true}
                            },
                            [
                                {
                                    $set:{
                                        amount: "$regularPrice"
                                    },
                                },
                                {
                                    $unset:["regularPrice"]
                                }
                            ]
                        )
                        
                        await offers.deleteOne(
                            {endDate: allOffers[i].endDate}
                        ) 
                        
                    } catch (error) {
                        console.log('Error during updation', error)
                    }
                    
                }  
            }else if(normalizeCurrentDate >= normalizeStartDate){
                if(!allOffers[i].isActive){
                    try {
                    
                        await products.updateMany(
                            {
                                regularPrice:{$exists:false},
                                category: allOffers[i].category,
                                amount:{
                                        $gte: allOffers[i].minAmount,
                                        $lte: allOffers[i].maxAmount
                                }
                            },
                            [
                                {
                                    $set:{
                                        regularPrice:"$amount",
                                        amount:{
                                            $round:[
                                                {
                                                    $subtract:[
                                                        "$amount",
                                                        {
                                                            $multiply:["$amount", {$divide:[allOffers[i].offer, 100]}]
                                                        }
                                                    ]
                                                },
                                                2
                                            ]
                                        }
                                    }
                                }
                            ]
                        )
                        
                        await offers.updateOne(
                            {_id: allOffers[i]._id},
                            {$set: {isActive:true}}
                        )
                    } catch (error) {
                        console.log('Error during updation', error)
                    } 
                }
            }
        }
    }
})

const loadOfferPage = async (req,res)=>{
    try {
        const category=await categories.find()
        const currentOffers=await offers.find().populate('category')
        res.render('offers', {
            categories: category,
            msg:req.flash('offMsg'),
            offers: currentOffers,
            offErr: req.flash('offErr')
        })
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        console.log(error.message);
    }
}

const loadAddOfferPage = async(req,res)=>{
    try {
        const category=await categories.find()        
        res.render('addOffers', {categories: category})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        console.log(error.message);
    }
}

const addOffer = async (req,res)=>{
    try {
        const{offerCategory,minPrice,maxPrice,startDate,endDate,offer}=req.body
        const allOffers=await offers.find()
        let offerExists=false
        for(let i=0;i<allOffers.length;i++){
            if(allOffers[i].category===offerCategory){
                offerExists=true
            }
        }
        if(offerExists){
            req.flash('offErr', 'Offer Exists')
            return res.redirect('/admin/offers')
        }
        const category=await categories.findOne({name:offerCategory})
        const data={
            category: category._id,
            minAmount: minPrice,
            maxAmount: maxPrice,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            offer: offer
        }

        await offers.insertMany(data)
        req.flash('offMsg', 'Offer added Successfully')
        res.redirect('/admin/offers')
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        console.log(error.message);
    }
}

const loadOfferEditPage = async (req,res)=>{
    try {
        const id=req.params.id
        const offer=await offers.findById(id)
        const allCategory=await categories.find()
        res.render('editOffers', {offer: offer, categories: allCategory})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        console.log(error.message);
    }
}

const editOffer = async (req,res)=>{
    try {
        const id=req.params.id
        const{offerCategory,minPrice,maxPrice,startDate,endDate,offer}=req.body
        const data={
            category: offerCategory,
            minAmount: minPrice,
            maxAmount: maxPrice,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            offer: offer
        }
        await offers.findByIdAndUpdate(
            id,
            {$set: data}
        )
        req.flash('offMsg', 'Offer edited successfully')
        res.redirect('/admin/offers')
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        console.log(error.message);
    }
}

const deleteOffer = async (req,res)=>{
    try {
        const id=req.params.id
        const offer=await offers.findById(id)
        if(offer.isActive){
            await offers.findByIdAndUpdate(
                id,
                {$set: {isActive:false}}
            )
            req.flash('offMsg', 'Offer Deactivated Successfully')
        }else{
            await offers.findByIdAndUpdate(
                id,
                {$set: {isActive:true}}
            )
            req.flash('offMsg', 'Offer Activated Successfully')
        }
        res.redirect('/admin/offers')
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        console.log(error.message);
    }
}

module.exports={
    loadOfferPage,
    loadAddOfferPage,
    addOffer,
    loadOfferEditPage,
    editOffer,
    deleteOffer
}