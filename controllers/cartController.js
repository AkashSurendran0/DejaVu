const env=require('dotenv').config()
const carts=require('../models/cartSchema')
const users=require('../models/userSchema')
const products=require('../models/productSchema')
const mongoose=require('mongoose')

const STATUS_SERVER_ERROR=parseInt(process.env.STATUS_SERVER_ERROR)
const STATUS_NOT_FOUND=parseInt(process.env.STATUS_NOT_FOUND)

const loadCartPage = async (req,res)=>{
    try {
        const user=await users.findOne({email:req.session.userEmail})       
        const productDetails=await carts.findOne({user:user._id}).populate('products.productId')       
        res.render('cart', {cart:productDetails})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

const addToCart = async (req,res)=>{
    try {
        const product=req.query.product
        const foundProduct=await products.findById(product)
        const size=req.query.size
        const quantity=parseInt(req.query.quantity)
        const user=await users.findOne({email: req.session.userEmail})
        const count=await carts.findOne({user:user._id})
        
        let itemAlreadyExist
        if(count){
            itemAlreadyExist = await carts.aggregate([
                {
                    $match:{
                        user:user._id
                    }
                },
                {
                    $unwind:'$products'
                },
                {
                    $match:{
                        'products.productId':new mongoose.Types.ObjectId(product),
                        'products.size':size
                    }
                },
                {
                    $group:{
                        _id:null, quantity:{$sum:'$products.quantity'}
                    }
                }
            ])
        }

        if(count && count.products.length>4){
            return res.json({cartLimit:true})
        } 
        
        if(itemAlreadyExist && itemAlreadyExist.length>0){
            if((itemAlreadyExist[0].quantity)+quantity > foundProduct.sizeAvailable[size]){
                return res.json({quantityLimit:true})
            }else{
                await carts.updateOne(
                    {
                        $and:[
                            {user: user._id},
                            {'products.productId': product}
                        ]
                    },   
                    {
                        $inc:{
                            'products.$.quantity':quantity,
                            totalQuantity:quantity,
                            totalAmount:(foundProduct.amount)*quantity
                        }
                    }
                )
            }
            return res.json({success:true})
        }  

        await carts.updateOne(
            {user: user._id},   
            {
                $push:{
                    products:{
                        productId:product,
                        size:size,
                        quantity:quantity
                    }
                },
                $inc:{
                    totalQuantity:quantity,
                    totalAmount:(foundProduct.amount)*quantity
                }
            },
            {upsert:true}
        )
        res.json({success:true})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).json({success:false})
        console.log(error.message);
    }
}

const removeProduct = async (req,res)=>{
    try {
        const cartId=req.query.cart
        const productId=req.query.product
        const productInCart=await carts.aggregate([
            {
                $match:{
                    _id:new mongoose.Types.ObjectId(cartId)
                }
            },
            {
                $unwind:'$products'
            },
            {
                $match:{
                    'products._id':new mongoose.Types.ObjectId(productId)
                }
            }
        ])
        const foundProduct=await products.findOne({_id: productInCart[0].products.productId})
        
        await carts.updateOne(
            {_id: cartId},
            {
                $inc:{
                    totalQuantity: -productInCart[0].products.quantity,
                    totalAmount: -((foundProduct.amount)*(productInCart[0].products.quantity))
                },
                $pull:{
                    products:{
                        _id:productId
                    }
                }
            }
        )
        res.redirect('/user/cart')
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

module.exports={
    loadCartPage,
    addToCart,
    removeProduct
}