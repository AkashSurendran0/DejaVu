const mongoose=require('mongoose')
const wishlist=require('../models/wishlistSchema')
const users=require('../models/userSchema')
const env=require('dotenv').config()


const STATUS_SERVER_ERROR=parseInt(process.env.STATUS_SERVER_ERROR)
const STATUS_NOT_FOUND=parseInt(process.env.STATUS_NOT_FOUND)

const loadWishlistPage = async (req,res)=>{
    try {
        const user=await users.findOne({email:req.session.userEmail})
        const userWishlist=await wishlist.findOne({user:user._id}).populate('products.productId')

        res.render('wishlist',{
            wishlist:userWishlist
        })
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        
    }
}

const addToWishlist = async (req,res)=>{
    try {
        const productId=req.query.product                
        const size=req.query.size        
        const user=await users.findOne({email:req.session.userEmail})        
        const count=await wishlist.findOne({user:user._id})        
        let itemAlreadyExist

        if(count){
            itemAlreadyExist=await wishlist.aggregate([
                {
                    $match:{
                        user:new mongoose.Types.ObjectId(user._id)
                    }
                },
                {
                    $unwind:"$products"
                },
                {
                    $match:{
                        "products.productId":new mongoose.Types.ObjectId(productId),
                        "products.size":size
                    }
                }
            ])
        }

        if(itemAlreadyExist && itemAlreadyExist.length>0){
            return res.json({alreadyExist:true})
        }

        await wishlist.updateOne(
            {user:user._id},
            {
                $push:{
                    products:{
                        productId:productId,
                        size:size
                    }
                }
            },
            {upsert:true}
        )

        res.json({success:true})
        
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        
    }
}

const removeProduct = async (req,res)=>{
    try {
        const productId=req.query.productId
        const wishlistId=req.query.wishlist
        try {
            await wishlist.updateOne(
                {_id: wishlistId},
                {
                    $pull:{
                        products:{
                            _id:productId
                        }
                    }
                }
            )
            res.json({success:true})
        } catch (error) {
            res.json({success:false})
        }
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        
    }
}

module.exports={
    loadWishlistPage,
    addToWishlist,
    removeProduct
}