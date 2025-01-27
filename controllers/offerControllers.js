const mongoose=require('mongoose')

const categories=require('../models/categorySchema')
const offers=require('../models/offerSchema')
const cron = require('node-cron')

const STATUS_SERVER_ERROR=parseInt(process.env.STATUS_SERVER_ERROR)

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

const loadOfferPage = async (req,res)=>{
    try {
        const category=await categories.find()
        const currentOffers=await offers.find()
        res.render('offers', {
            categories: category,
            msg:req.flash('offMsg'),
            offers: currentOffers,
            offErr: req.flash('offErr')
        })
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

const loadAddOfferPage = async(req,res)=>{
    try {
        const category=await categories.find()        
        res.render('addOffers', {categories: category})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
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
        const data={
            category: offerCategory,
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
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
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
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
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
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
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
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
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