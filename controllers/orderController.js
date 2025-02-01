const orders=require('../models/orderSchema')
const addresses=require('../models/addressSchema')
const users=require('../models/userSchema')
const carts=require('../models/cartSchema')
const coupons=require('../models/couponSchema')
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
        const allCoupons=await coupons.find(
            {
                redeemedBy:{
                    $nin:[user._id]
                },
                status:true,
                minPrice:{$lte:products.totalAmount}
            }   
        )                   
        const allAddress=await addresses.findOne({user:user._id})        
        res.render('checkout',{
            allAddress: allAddress,
            msg:req.flash('msg'),
            cart: cart,
            products: products,
            coupons:allCoupons
        })
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        console.log(error.message);
    }
}

const placeOrder = async (req,res)=>{
    try {        
        const code=req.query.coupon
        const user=await users.findOne({email: req.session.userEmail})
        const address=req.query.address        
        const product=req.query.cart        
        const method=req.query.method
        const cart=await carts.findOne({_id: product}).populate('products.productId')

        let cartAmount
        if(code){
            const coupon=await coupons.findOne({code:code})
            const reducedAmount=(cart.totalAmount*coupon.offer)/100
            if(reducedAmount < coupon.maxPrice){
                cartAmount=cart.totalAmount-reducedAmount
            }else{
                cartAmount=cart.totalAmount-coupon.maxPrice
            }
            await coupons.updateOne(
                {_id: coupon._id},
                {
                    $push:{
                        redeemedBy:user._id
                    }
                }
            )
        }

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
            totalAmount: cartAmount?? cart.totalAmount,
            address: address
        }

        await carts.deleteOne({_id: product})

        await orders.insertMany(data)
        return res.json({success:true})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        console.log(error.message);
    }
}

const loadMyOrderPage = async (req,res)=>{
    try {
        const user=await users.findOne({email:req.session.userEmail})
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
                $unwind:"$resultAddress"
            },
            {
                $unwind:"$resultAddress.address"
            },
            {
                $match:{
                    $expr:{
                        $eq:
                            ["$resultAddress.address._id","$address"]
                        
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
        
        res.render('myOrders',{
            allOrders: allOrders
        })
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
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
                $unwind:'$products'
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
        
        res.render('orderSummary',{
            order:orderFound
        })
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
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
        res.status(STATUS_SERVER_ERROR).render('404page')
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
                $unwind:'$products'
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
        res.status(STATUS_SERVER_ERROR).render('404page')
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
        if(status=='Delivered'){
            await orders.updateOne(
                {_id: orderId},
                {
                    $set:{
                        "products.$[element].status":'Delivered'
                    }
                },
                {
                    arrayFilters:[
                        {
                            "element.status":{
                                $ne:'Cancelled'
                            }
                        }
                    ]
                }
            )
        }
        res.json({success:true})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        console.log(error.message);
    }
}

const cancelOrder = async (req,res)=>{
    try {
        const orderId=req.query.order
        const orderProductId=req.query.orderProductId
        const reason=req.query.reason
        await orders.updateOne(
            {
                _id: orderId,
                'products._id':orderProductId
            },
            {
                $set:{
                    'products.$.status':'Cancelled',
                    'products.$.cancelReason':reason
                }                
            }
        )
        const orderFound=await orders.findOne({_id: orderId})
        let allCancelled=true
        orderFound.products.forEach(products=>{
            if(products.status != 'Cancelled'){
                allCancelled=false
                return
            }
        })
        if(allCancelled){
            await orders.updateOne(
                {_id: orderId},
                {
                    $set:{
                        status:'Cancelled'
                    }
                }
            )
        }
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
        res.status(STATUS_SERVER_ERROR).render('404page')
        console.log(error.message);
    }
}

const requestReturn = async (req,res)=>{
    try {
        const orderId=req.query.order
        const orderProductId=req.query.orderProductId
        const reason=req.query.reason
        try {
            await orders.updateOne(
                {
                    _id: orderId,
                    'products._id':orderProductId
                },
                {
                    $set:{
                        'products.$.status':'Return requested',
                        cancelReason:reason
                    }
                }
            )
            res.json({success:true})
        } catch (error) {
            res.json({success:false})
        }
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        console.log(error.message);
    }
}

const confirmReturn = async (req,res)=>{
    try {
        const order=req.query.order
        console.log(order);
        
        const orderProductId=req.query.orderProductId
        console.log(orderProductId);
        
        const confirm=parseInt(req.query.confirm)
        console.log(confirm);
        

        if(confirm){
            await orders.updateOne(
                {
                    _id:order,
                    'products._id':orderProductId
                },
                {
                    $set:{
                        'products.$.status':'Returned',
                    }
                }
            )
            const orderFound=await orders.findOne({_id: order})
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
            res.json({confirm:true})
        }else{                        
            await orders.updateOne(
                {
                    _id: order,
                    'products._id':orderProductId
                },
                {
                    $set:{
                        'products.$.status':'Return Cancelled'
                    }
                }
            )            
            res.json({decline:true})
        }
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
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
    cancelOrder,
    requestReturn,
    confirmReturn
}