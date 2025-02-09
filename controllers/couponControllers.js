const coupons=require('../models/couponSchema')
const env=require('dotenv').config()

const STATUS_SERVER_ERROR=parseInt(process.env.STATUS_SERVER_ERROR)

const loadCoupons = async (req,res)=>{
    try {
        const allCoupons=await coupons.find()
        res.render('coupons', {
            msg:req.flash('msg'),
            allCoupons:allCoupons,
            errMsg:req.flash('errMsg')
        })
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('admin404')
        console.log(error.message);
    }
}

const loadCouponAddPage = async (req,res)=>{
    try {
        res.render('addCoupon')
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('admin404')
        console.log(error.message);
    }
}

const addCoupon = async (req,res)=>{
    try {
        const {code,minPrice,desc,offer,maxPrice}=req.body
        const foundCoupon=await coupons.findOne({code:{$regex:`^${code}`,$options:'i'}})
        if(foundCoupon){
            req.flash('errMsg', 'Coupon with such name already exists')
            return res.redirect('/admin/coupons')
        }
        const data={
            code:code,
            minPrice:minPrice,
            description:desc,
            offer:offer,
            maxPrice:maxPrice
        }
        await coupons.insertMany(data)
        req.flash('msg', 'Coupon Added Successfully')
        res.redirect('/admin/coupons')
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('admin404')
        console.log(error.message);
    }
}

const loadEditCouponPage = async (req,res)=>{
    try {
        const id=req.params.id
        const foundCoupon=await coupons.findOne({_id: id})
        res.render('editCoupon', {
            coupon:foundCoupon
        })
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('admin404')
        console.log(error.message);
    }
}

const editCoupon = async (req,res)=>{
    try {
        const id=req.params.id
        const {code,minPrice,desc,offer,maxPrice}=req.body
        const foundCoupon=await coupons.findOne({code:{$regex:`^${code}`,$options:'i'}, _id:{$ne:id}})
        if(foundCoupon){
            req.flash('errMsg', 'Coupon with such name already exists')
            return res.redirect('/admin/coupons')
        }
        const data={
            code:code,
            minPrice:minPrice,
            description:desc,
            offer:offer,
            maxPrice:maxPrice
        }
        await coupons.updateOne(
            {_id :id},
            {
                $set:data
            }
        )
        req.flash('msg', 'Coupon edited successfully')
        res.redirect('/admin/coupons')
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('admin404')
        console.log(error.message);
    }
}

const changeCouponStatus = async (req,res)=>{
    try {
        const id=req.params.id
        const coupon=await coupons.findOne({_id: id})
        if(coupon.status){
            await coupons.updateOne(
                {_id: id},
                {
                    $set:{
                        status:false
                    }
                }
            )
        }else{
            await coupons.updateOne(
                {_id: id},
                {
                    $set:{
                        status:true
                    }
                }
            )
        }
        req.flash('msg', 'Coupon status changed successfully')
        res.redirect('/admin/coupons')
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('admin404')
        console.log(error.message);
    }
}

const deleteCoupon = async (req,res)=>{
    try {
        const id=req.params.id
        await coupons.deleteOne(
            {_id: id}
        )
        req.flash('msg', 'Coupon deleted successfully')
        res.redirect('/admin/coupons')
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('admin404')
        console.log(error.message);
    }
}

const getCouponDetails = async (req,res)=>{
    try {
        const id=req.query.couponId        
        const code=req.query.couponCode
        if(id && id !== "undefined" && id !== "null"){            
            const foundCoupon=await coupons.findOne({_id: id})
            return res.json({success:true, coupon:foundCoupon})
        }
        const foundCoupon=await coupons.findOne({code:code})        
        if(foundCoupon){
            return res.json({success:true, coupon:foundCoupon})
        }
        res.json({success:false})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        console.log(error.message);
    }
}

module.exports={
    loadCoupons,
    loadCouponAddPage,
    addCoupon,
    loadEditCouponPage,
    editCoupon,
    changeCouponStatus,
    deleteCoupon,
    getCouponDetails
}