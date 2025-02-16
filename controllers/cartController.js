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
        let totalAmount=0 
        if(productDetails!=null){
            productDetails.products.forEach(product=>{
                if(product.productId.regularPrice){
                  totalAmount+=(product.productId.regularPrice*product.quantity)
                }else{
                  totalAmount+=(product.productId.amount*product.quantity)
                }
              })  
        }       
                  
        res.render('cart', {
            cart:productDetails,
            totalAmount:totalAmount
        })
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        
    }
}

const addToCart = async (req,res)=>{
    try {
        const fromWishlist=req.query.fromWishlist || false
        const product=req.query.product        
        const foundProduct=await products.findById(product)
        const size=req.query.size        
        const quantity=parseInt(req.query.quantity) || 1        
        const user=await users.findOne({email: req.session.userEmail})
        const count=await carts.findOne({user:user._id})

        const sizeAvailable = await products.find(
            {
                _id:product,
                [`sizeAvailable.${size}`]:{
                    $gt:0
                }
            }
        )
        if(sizeAvailable.length==0){
            return res.json({noStock:true})
        }
        
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
        
        if(itemAlreadyExist && itemAlreadyExist.length>0){
            if(fromWishlist){                
                return res.json({exists:true})
            }else if((itemAlreadyExist[0].quantity)+quantity > foundProduct.sizeAvailable[size]){
                return res.json({quantityLimit:true})
            }else if((itemAlreadyExist[0].quantity)+quantity > 5 ){
                return res.json({quantityFive:true})
            }else{
                const gstAmount=Math.floor(((foundProduct.amount*quantity)/100)*5)
                await carts.updateOne(
                    {
                        user: user._id,
                        'products.productId': product
                    },
                    {
                        $inc:{
                            'products.$.quantity':quantity,
                            totalQuantity:quantity,
                            totalAmount:(foundProduct.amount*quantity)+gstAmount,
                            GST:gstAmount
                        }
                    }
                )
                const offerAmount=((foundProduct.regularPrice-foundProduct.amount)*quantity).toFixed(2)
                if(foundProduct.hasOffer){
                    await carts.updateOne(
                        {
                            user:user._id
                        },
                        {
                            $inc:{
                                offerDiscount:offerAmount
                            }
                        }
                    )
                }
                await carts.updateOne(
                    {
                        user:user._id
                    },
                    [
                        {
                            $set:{
                                totalAmount:{
                                    $round:['$totalAmount',2]
                                },
                                GST:{
                                    $round:['$GST', 2]
                                }
                            }
                        }
                    ]
                )
            }            
            return res.json({success:true})
        }  
        
        const gstAmount=Math.floor(((foundProduct.amount*quantity)/100)*5)
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
                    totalAmount:((foundProduct.amount)*quantity)+gstAmount,
                    GST:gstAmount
                }
            },
            {upsert:true}
        )
        if(foundProduct.regularPrice){
            const offerAmount=((foundProduct.regularPrice-foundProduct.amount)*quantity).toFixed(2)
            
            if(foundProduct.hasOffer){
                await carts.updateOne(
                    {
                        user:user._id
                    },
                    {
                        $inc:{
                            offerDiscount:offerAmount
                        }
                    }
                )
            }
        }
        await carts.updateOne(
            {
                user:user._id
            },
            [
                {
                    $set:{
                        totalAmount:{
                            $round:['$totalAmount',2]
                        }
                    }
                }
            ]
        )
        res.json({success:true})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).json({success:false})
        
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
        if(foundProduct.hasOffer){
            const offerAmount=((foundProduct.regularPrice-foundProduct.amount)*productInCart[0].products.quantity).toFixed(2)
            await carts.updateOne(
                {
                    _id: cartId
                },
                {
                    $inc:{
                        offerDiscount:-offerAmount
                    }
                }
            )
        }
        const gstAmount=((foundProduct.amount*productInCart[0].products.quantity)/100)*5
        await carts.updateOne(
            {_id: cartId},
            {
                $inc:{
                    totalQuantity: -productInCart[0].products.quantity,
                    totalAmount: -((foundProduct.amount)*(productInCart[0].products.quantity))-gstAmount,
                    GST:-gstAmount
                },
                $pull:{
                    products:{
                        _id:productId
                    }
                }
            }
        )
        await carts.updateOne(
            {_id:cartId},
            [
                {
                    $set:{
                        totalAmount:{
                            $round:['$totalAmount', 2]
                        },
                        GST:{
                            $round:['$GST', 2]
                        }
                    }
                }
            ]
        )
        res.redirect('/cart')
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        
    }
}

const changeQuantity = async (req,res)=>{
    try {      
        const currentQuantity=parseInt(req.query.quantity)
        const cartProductId=req.query.cartProductId
        const cart=req.query.cart     
        const cartProduct=req.query.cartProduct 
        const action=req.query.action
        const product=await products.findOne({_id: cartProduct})
        let discountPrice=0
        if(product.regularPrice){
            discountPrice=product.regularPrice-product.amount
        }
        const size=await carts.aggregate([
            {
                $match:{
                    _id:new mongoose.Types.ObjectId(cart)
                }
            },
            {
                $unwind:'$products'
            },
            {
                $match:{
                        'products._id': new mongoose.Types.ObjectId(cartProductId)
                    }
            },
            {
                $project:{
                    _id:0, 'products.size':1
                }
            }
        ])
        
        const stockAvailable=await products.aggregate([
            {
                $match:{
                    _id: new mongoose.Types.ObjectId(cartProduct)
                }
            },
            {
                $project:{
                    _id:0, [`sizeAvailable.${size[0].products.size}`]:1
                }
            }
        ])
        
        if(action==='increase'){
            if(currentQuantity < stockAvailable[0].sizeAvailable[size[0].products.size] && currentQuantity<5){
                const gstAmount=(product.amount/100)*5
                const productAmount=product.amount+gstAmount
                await carts.updateOne(
                    {
                        _id: cart, 'products._id':cartProductId
                    },
                    {
                        $inc:{
                            'products.$.quantity':1,
                            totalQuantity:1,
                            totalAmount:productAmount,
                            GST:gstAmount,
                            offerDiscount:discountPrice
                        }
                    }
                )
                await carts.updateOne(
                    {
                        _id: cart
                    },
                    [
                        {
                            $set:{
                                totalAmount:{
                                    $round:['$totalAmount', 2]
                                },
                                offerDiscount:{
                                    $round:['$offerDiscount', 2]
                                },
                                GST:{
                                    $round:['$GST', 2]
                                }
                            }
                        }
                    ]
                )

                const updatedCart=await carts.findOne({_id:cart}).populate('products.productId')
                return res.json({
                    increase:true,
                    updatedCart:updatedCart
                })
            }
        }else if(action==='decrease'){
            if(currentQuantity > 1){
                const gstAmount=(product.amount/100)*5
                const productAmount=product.amount+gstAmount
                await carts.updateOne(
                    {
                        _id: cart, 'products._id':cartProductId
                    },
                    {
                        $inc:{
                            'products.$.quantity':-1,
                            totalQuantity:-1,
                            totalAmount:-productAmount,
                            GST:-gstAmount,
                            offerDiscount:-discountPrice
                        }
                    }
                )
                await carts.updateOne(
                    {
                        _id: cart
                    },
                    [
                        {
                            $set:{
                                totalAmount:{
                                    $round:['$totalAmount', 2]
                                },
                                offerDiscount:{
                                    $round:['$offerDiscount', 2]
                                },
                                GST:{
                                    $round:['$GST', 2]
                                }
                            }
                        }
                    ]
                )

                const updatedCart=await carts.findOne({_id:cart}).populate('products.productId')
                return res.json({
                    decrease:true,
                    updatedCart:updatedCart
                })
            }     
        }
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        
    }
}

module.exports={
    loadCartPage,
    addToCart,
    removeProduct,
    changeQuantity
}