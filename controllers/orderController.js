const orders=require('../models/orderSchema')
const addresses=require('../models/addressSchema')
const users=require('../models/userSchema')
const carts=require('../models/cartSchema')
const products=require('../models/productSchema')
const env=require('dotenv').config()
const mongoose=require('mongoose')
const { isErrored } = require('nodemailer/lib/xoauth2')

const STATUS_SERVER_ERROR=parseInt(process.env.STATUS_SERVER_ERROR)
const STATUS_NOT_FOUND=parseInt(process.env.STATUS_NOT_FOUND)

const loadCheckoutPage = async (req,res)=>{
    try {
        const cart=req.params.cart
        const products=await carts.findOne({_id:cart}).populate('products.productId')     
        const user=await users.findOne({email:req.session.userEmail})           
        const allAddress=await addresses.findOne({user:user._id})        
        res.render('checkout',{
            allAddress: allAddress,
            msg:req.flash('msg'),
            cart: cart,
            products: products
        })
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

const placeOrder = async (req,res)=>{
    try {        
        const user=await users.findOne({email: req.session.userEmail})
        const address=req.query.address        
        const product=req.query.cart        
        const method=req.query.method
        const cart=await carts.findOne({_id: product}).populate('products.productId')
        const arrayProducts=[]
        cart.products.forEach(async product => {
            const data={
                productId:product.productId._id,
                productAmount:product.productId.amount,
                size:product.size,
                quantity:product.quantity
            }
            arrayProducts.push(data)
            const size=product.size
            await products.updateOne(
                {_id: product.productId._id},
                {$inc:{
                    [`sizeAvailable.${size}`]: -product.quantity,
                    stock:-product.quantity
                }}
            )
        });        

        const data={
            user: user._id,
            products: arrayProducts,
            quantity: cart.totalQuantity,
            paymentmethod: method,
            totalAmount: cart.totalAmount,
            address: address
        }

        await carts.deleteOne({_id: product})

        await orders.insertMany(data)
        return res.json({success:true})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

const loadMyOrderPage = async (req,res)=>{
    try {
        const user=await users.findOne({email:req.session.userEmail})
        const userOrder=await orders.find({user:user._id})     
        const addressIds = userOrder.map(order => new mongoose.Types.ObjectId(order.address));   
        const allOrders=await orders.aggregate([
            {
                $match:{
                    user: user._id
                }
            },
            {
                $lookup:{
                    from:'addresses',
                    localField:'address',
                    foreignField:'address._id',
                    as:'resultAddress'
                }
            },
            {
                $unwind:'$resultAddress'
            },
            {
                $match:{
                    'resultAddress.address._id':{ $in: addressIds }
                }
            },  
            {
                $lookup:{
                    from:'products',
                    localField:'products.productId',
                    foreignField:'_id',
                    as:'resultProducts'
                }
            }
        ])
        
        res.render('myOrders',{
            allOrders: allOrders
        })
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

const loadOrderSummary = async (req,res)=>{
    try {
        const orderId=req.params.order    
        const order=await orders.findOne({_id:orderId})            
        const orderFound=await orders.aggregate([
            {
                $match:{
                    _id: new mongoose.Types.ObjectId(orderId)
                }
            },
            {
                $lookup:{
                    from:'users',
                    localField:'user',
                    foreignField:'_id',
                    as:'userFound'
                }
            },
            {
                $lookup:{
                    from:'addresses',
                    localField:'address',
                    foreignField:'address._id',
                    as:'resultAddress'
                }
            },
            {
                $unwind:'$resultAddress'
            },
            {
                $unwind:'$resultAddress.address'
            },
            {
                $match:{
                    'resultAddress.address._id':new mongoose.Types.ObjectId(order.address)
                }
            },
            {
                $lookup:{
                    from:'products',
                    localField:'products.productId',
                    foreignField:'_id',
                    as:'resultProducts'
                }
            }
        ])
        console.log(orderFound);
        
        res.render('orderSummary',{
            order:orderFound
        })
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

const loadOrderManagement = async (req,res)=>{
    try {
        const allOrders=await orders.aggregate([
            {
                $lookup:{
                    from:'users',
                    localField:'user',
                    foreignField:'_id',
                    as:'resultUsers'
                }
            },
            {
                $lookup:{
                    from:'addresses',
                    localField:'address',
                    foreignField:'address._id',
                    as:'resultAddress'
                }
            },
            {
                $unwind:'$resultAddress'
            }, 
            {
                $unwind:'$resultAddress.address'
            },
            {
                $match:{
                    $expr:{
                        $eq:['$resultAddress.address._id', '$address']
                    }
                }
            },
            {
                $lookup:{
                    from:'products',
                    localField:'products.productId',
                    foreignField:'_id',
                    as:'resultProducts'
                }
            },
            {
                $sort:{
                    createdAt:-1
                }
            }
        ])
        
        res.render('orderManagement',{
            allOrders: allOrders
        })
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

const loadOrderDetails = async (req,res)=>{
    try {
        const orderId=req.params.order
        const foundOrder=await orders.aggregate([
            {
                $match:{
                    _id:new mongoose.Types.ObjectId(orderId)
                }
            },
            {
                $lookup:{
                    from:'users',
                    localField:'user',
                    foreignField:'_id',
                    as:'resultUsers'
                }
            },
            {
                $lookup:{
                    from:'addresses',
                    localField:'address',
                    foreignField:'address._id',
                    as:'resultAddress'
                }
            },
            {
                $unwind:'$resultAddress'
            }, 
            {
                $unwind:'$resultAddress.address'
            },
            {
                $match:{
                    $expr:{
                        $eq:['$resultAddress.address._id', '$address']
                    }
                }
            },
            {
                $lookup:{
                    from:'products',
                    localField:'products.productId',
                    foreignField:'_id',
                    as:'resultProducts'
                }
            }
        ])
        
        res.render('orderDetails',{
            order:foundOrder
        })
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

const updateStatus = async (req,res)=>{
    try {
        const status=req.params.status
        const orderId=req.params.order
        await orders.updateOne(
            {_id: orderId},
            {$set:{status:status}}
        )
        res.json({success:true})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

const cancelOrder = async (req,res)=>{
    try {
        const orderId=req.params.order
        const reason=req.params.reason
        await orders.updateOne(
            {_id: orderId},
            {
                $set:{
                    status:'Cancelled',
                    cancelReason:reason
                }                
            }
        )
        const orderFound=await orders.findOne({_id: orderId})
        orderFound.products.forEach(async product=>{
            const size=product.size
            await products.updateOne(
                {_id: product.productId},
                {
                    $inc:{
                        [`sizeAvailable.${size}`]:product.quantity,
                        stock:product.quantity
                    }
                }
            )
        })
        res.json({success:true})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

module.exports={
    loadCheckoutPage,
    placeOrder,
    loadMyOrderPage,
    loadOrderSummary,
    loadOrderManagement,
    loadOrderDetails,
    updateStatus,
    cancelOrder
}