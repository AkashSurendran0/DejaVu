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
        res.status(STATUS_SERVER_ERROR).render('404page')
        console.log(error.message);
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
        console.log(itemAlreadyExist);
        
        if(itemAlreadyExist && itemAlreadyExist.length>0){
            if(fromWishlist){                
                return res.json({exists:true})
            }else if((itemAlreadyExist[0].quantity)+quantity > foundProduct.sizeAvailable[size]){
                return res.json({quantityLimit:true})
            }else if((itemAlreadyExist[0].quantity)+quantity > 5 ){
                return res.json({quantityFive:true})
            }else{
                await carts.updateOne(
                    {
                        user: user._id,
                        'products.productId': product
                    },
                    {
                        $inc:{
                            'products.$.quantity':quantity,
                            totalQuantity:quantity,
                            totalAmount:foundProduct.amount*quantity
                        }
                    }
                )
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
            }            
            return res.json({success:true})
        }  
        console.log('oombbbb');
        
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
        res.status(STATUS_SERVER_ERROR).render('404page')
        console.log(error.message);
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
        console.log(action);
        console.log(currentQuantity);
        console.log(stockAvailable);
        
        if(action==='increase'){
            if(currentQuantity < stockAvailable[0].sizeAvailable[size[0].products.size] && currentQuantity<5){
                console.log('increased');
                
                await carts.updateOne(
                    {
                        _id: cart, 'products._id':cartProductId
                    },
                    {
                        $inc:{
                            'products.$.quantity':1,
                            totalQuantity:1,
                            totalAmount:product.amount
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
                console.log('decreased');
                
                await carts.updateOne(
                    {
                        _id: cart, 'products._id':cartProductId
                    },
                    {
                        $inc:{
                            'products.$.quantity':-1,
                            totalQuantity:-1,
                            totalAmount:-product.amount
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
        console.log(error.message);
    }
}

module.exports={
    loadCartPage,
    addToCart,
    removeProduct,
    changeQuantity
}