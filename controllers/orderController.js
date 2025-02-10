const orders=require('../models/orderSchema')
const addresses=require('../models/addressSchema')
const users=require('../models/userSchema')
const carts=require('../models/cartSchema')
const coupons=require('../models/couponSchema')
const products=require('../models/productSchema')
const wallets=require('../models/walletSchema')
const env=require('dotenv').config()
const mongoose=require('mongoose')
const { isErrored } = require('nodemailer/lib/xoauth2')
const Razorpay=require('razorpay')
const crypto=require('crypto')
const PDFDocument=require('pdfkit')
const fs=require('fs')

const STATUS_SERVER_ERROR=parseInt(process.env.STATUS_SERVER_ERROR)
const STATUS_NOT_FOUND=parseInt(process.env.STATUS_NOT_FOUND)

const razorpayInstance=new Razorpay({
    key_id:'rzp_test_8RKWZFiJMDAIeS',
    key_secret:'ljyU5ZIohEiwxZvhtRqyGFy0'
})

const checkProductQuantity = async (req,res)=>{
    try {        
        const cart=req.params.cart
        const products=await carts.findOne({_id:cart}).populate('products.productId')     

        for (const product of products.products) {
            let size = product.size;
            if (product.productId.sizeAvailable[size] < 1) {
                return res.json({ success: false, name: product.productId.productName });
            }
        }      
        
        res.json({success:true})

    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        console.log(error.message);
    }
}

const loadCheckoutPage = async (req,res)=>{
    try {
        const cart=req.params.cart
        const products=await carts.findOne({_id:cart}).populate('products.productId')     
        const user=await users.findOne({email:req.session.userEmail})       

        let totalAmount=0
        products.products.forEach(product=>{
          if(product.productId.regularPrice){
            totalAmount+=(product.productId.regularPrice*product.quantity)
          }else{
            totalAmount+=(product.productId.amount*product.quantity)
          }
        })
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
            coupons:allCoupons,
            totalAmount:totalAmount
        })
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        console.log(error.message);
    }
}

const placeOrder = async (req,res)=>{
    try {   
        const userEmail=req.session.userEmail 
        const loggedUser=await users.findOne({email:userEmail})    
        const code=req.query.coupon
        const user=await users.findOne({email: req.session.userEmail})
        const address=req.query.address        
        const product=req.query.cart        
        const method=req.query.method
        const cart=await carts.findOne({_id: product}).populate('products.productId')

        let couponDiscount=0        
        let cartAmount
        if(code){
            const coupon=await coupons.findOne({code:code})
            const reducedAmount=((cart.totalAmount*coupon.offer)/100).toFixed(2)
            if(reducedAmount < coupon.maxPrice){                
                couponDiscount=reducedAmount
                cartAmount=(cart.totalAmount-reducedAmount).toFixed(2)
            }else{                
                couponDiscount=coupon.maxPrice
                cartAmount=(cart.totalAmount-coupon.maxPrice).toFixed(2)
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
        if(method=='Wallet Payment'){
            const userWallet=await wallets.findOne({user:loggedUser._id})
            if(!userWallet){
                return res.json({walletNotExists:true})
            }
            const amount=cartAmount?? cart.totalAmount
            if(userWallet.walletAmount<amount){
                return res.json({noAmount:true})
            }
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
            couponDiscount: couponDiscount,
            offerDiscount: cart.offerDiscount?? 0,
            paymentmethod: method,
            totalAmount: cartAmount?? cart.totalAmount,
            address: address
        }

        await carts.deleteOne({_id: product})

        const newOrder=await orders.insertMany(data)

        if(method=='Wallet Payment'){
            const amount=cartAmount?? cart.totalAmount
            const data={
                orderId:newOrder[0]._id,
                debitDate:new Date().toLocaleDateString()
            }
            await wallets.updateOne(
                {
                    user:loggedUser._id
                },
                {
                    $inc:{
                        walletAmount:-amount
                    },
                    $push:{
                        debitHistory:data
                    }
                },
                {
                    upsert:true
                }
            )
        }

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
        res.status(STATUS_SERVER_ERROR).render('admin404')
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
        res.status(STATUS_SERVER_ERROR).render('admin404')
        console.log(error.message);
    }
}

const updateStatus = async (req,res)=>{
    try {
        const status=req.params.status
        const orderId=req.params.order
        const foundOrder=await orders.findOne({_id: orderId})
        await orders.updateOne(
            {_id: orderId},
            {$set:{status:status}}
        )
        if(status=='Delivered'){
            await orders.updateOne(
                {_id: orderId},
                {
                    $set:{
                        "products.$[element].status":'Delivered',
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
            if(foundOrder.status=='Payment Failed'){
                await orders.updateOne(
                    {
                        _id:orderId
                    },
                    {
                        $set:{
                            paymentmethod:'Cash On Delivery'
                        }
                    }
                )
            }
        }
        res.json({success:true})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('admin404')
        console.log(error.message);
    }
}

const cancelOrder = async (req,res)=>{
    try {
        const userEmail=req.session.userEmail
        const loggedUser=await users.findOne({email:userEmail})
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
        const couponOrder=await orders.findOne(
            {
                _id:orderId,
                couponDiscount:{
                    $gt:0
                }
            }
        )
        
        const productAmount=await orders.aggregate([
            {
                $match:{
                    _id:new mongoose.Types.ObjectId(orderId),
                    paymentmethod:'Online Payment'
                }
            },
            {
                $unwind:'$products'
            },
            {
                $match:{
                    'products._id':new mongoose.Types.ObjectId(orderProductId)
                }
            }
        ])
        let couponDiscount=0
        let creditAmount=0
        if(productAmount.length>0){
            creditAmount=(productAmount[0].products.productAmount*productAmount[0].products.quantity).toFixed(2)
        }
        if(couponOrder){
            couponDiscount=couponOrder.couponDiscount/couponOrder.products.length
            creditAmount=((productAmount[0].products.productAmount-productAmount[0].couponDiscount)*productAmount[0].products.quantity).toFixed(2)
        }
        if(productAmount.length>0){
            const data={
                orderId:orderId,
                productId:productAmount[0].products.productId,
                quantity:productAmount[0].products.quantity,
                creditAmount:creditAmount,
                creditDate:new Date().toLocaleDateString()
            }
            await wallets.updateOne(
                {
                    user:loggedUser._id
                },
                {
                    $inc:{
                        walletAmount:creditAmount
                    },
                    $push:{
                        creditHistory:data
                    }
                },
                {
                    upsert:true
                }
            )
        }
        const orderFound=await orders.findOne({_id: orderId})
        const productFound = orderFound.products.find(p => p._id.toString() === orderProductId);
        const amountToDeduct = creditAmount ?? productFound.productAmount;
        await orders.updateOne(
            {
                _id:orderId,
                'products._id':orderProductId
            },
            {
                $inc:{
                    totalAmount:-amountToDeduct
                }
            }
        )
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

        const orderSize=await orders.aggregate([
            {
                $match:{
                    _id:new mongoose.Types.ObjectId(orderId)
                }
            },
            {
                $unwind:'$products'
            },
            {
                $match:{
                    'products._id':new mongoose.Types.ObjectId(orderProductId)
                }
            }
        ])
        await products.updateOne(
            {
                _id:orderSize[0].products.productId
            },
            {
                $inc:{
                    [`sizeAvailable.${orderSize[0].products.size}`]:orderSize[0].products.quantity,
                    stock:orderSize[0].products.quantity
                }
            }
        )
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
                        'products.$.cancelReason':reason
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
        const userEmail=req.session.userEmail
        const order=req.query.order
        const orderProductId=req.query.orderProductId        
        const confirm=parseInt(req.query.confirm)        

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
            const couponOrder=await orders.findOne(
                {
                    _id:order,
                    couponDiscount:{
                        $gt:0
                    }
                }
            )
            const productAmount=await orders.aggregate([
                {
                    $match:{
                        _id:new mongoose.Types.ObjectId(order),
                    }
                },
                {
                    $unwind:'$products'
                },
                {
                    $match:{
                        'products._id':new mongoose.Types.ObjectId(orderProductId)
                    }
                }
            ])
            let couponDiscount=0
            let creditAmount
            if(productAmount.length>0){
                creditAmount=(productAmount[0].products.productAmount*productAmount[0].products.quantity).toFixed(2)
            }
            if(couponOrder){
                couponDiscount=couponOrder.couponDiscount/couponOrder.products.length
                creditAmount=((productAmount[0].products.productAmount-productAmount[0].couponDiscount)*productAmount[0].products.quantity).toFixed(2)
            }
            if(productAmount.length>0){
                const data={
                    orderId:order,
                    productId:productAmount[0].products.productId,
                    quantity:productAmount[0].products.quantity,
                    creditAmount:creditAmount,
                    creditDate:new Date().toLocaleDateString()
                }
                await wallets.updateOne(
                    {
                        user:loggedUser._id
                    },
                    {
                        $inc:{
                            walletAmount:creditAmount
                        },
                        $push:{
                            creditHistory:data
                        }
                    },
                    {
                        upsert:true
                    }
                )
            }
            await orders.updateOne(
                {
                    _id:order
                },
                {
                    $inc:{
                        totalAmount:-creditAmount
                    }
                }
            )
            await products.updateOne(
                {
                    _id:productAmount[0].products.productId
                },
                {
                    $inc:{
                        [`sizeAvailable.${productAmount[0].products.size}`]:productAmount[0].products.quantity,
                        stock:productAmount[0].products.quantity
                    }
                }
            )
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
                    },
                    $unset:{
                        'products.$.cancelReason':''
                    }
                }
            )            
            res.json({decline:true})
        }
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('admin404')
        console.log(error.message);
    }
}

const loadRazorPayment = async (req,res)=>{
    try {
        console.log(req.query);
        const id=req.query.cart?? req.query.order
        const item=await carts.findOne({_id:id})?? await orders.findOne({_id:id})
        
        const amount=item.totalAmount

        const order=await razorpayInstance.orders.create({
            amount:amount*100,
            currency:'INR',
            receipt:`receipt_${Date.now()}`
        })

        res.json({success:true, orders:order})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        console.log(error.message);
    }
}   

const verifyRazorPayment = async (req,res)=>{
    try {        
        const {payment_id,order_id,signature}=req.body
        const secret='ljyU5ZIohEiwxZvhtRqyGFy0'        
        const generated_signature=crypto
            .createHmac('sha256', secret)
            .update(order_id+'|'+payment_id)
            .digest('hex')
        if(generated_signature===signature){
            res.json({success:true})
        }else{
            res.json({success:false})
        }
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        console.log(error.message);
    }
}

const downloadInvoice = async (req,res) =>{
    try {
        const orderId=req.query.order
        const order=await orders.aggregate([
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
                $unwind:'$resultUsers'
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
            },
            {
                $unwind:'$resultProducts'
            }
        ])     
        console.log(order)

        const doc=new PDFDocument()

        res.setHeader("Content-Type", "application/pdf")
        res.setHeader("Content-Disposition", 'attachment; filename="Product_Invoice_Report.pdf"')

        doc.pipe(res)
        doc.fontSize(22).fillColor('#333').text('Product Invoice-DejaVu Mens Store', {align:'center', underline:true})
        doc.moveDown(1)

        doc.fontSize(14).fillColor("#222")
        doc.text(`Customer Name: ${order[0].resultUsers.name}`);
        doc.text(`Email: ${order[0].resultUsers.email}`);
        doc.moveDown(0.5);

        doc.fontSize(14).fillColor("#222");
        doc.text(`Date: ${new Date().toLocaleDateString()}`);
        doc.moveDown(0.5);
        doc.text(`Delivery Address:`);
        doc.moveDown(0.2)
        doc.fontSize(12).text(`${order[0].resultAddress.address.name}`);
        doc.moveDown(0.2)
        doc.fontSize(12).text(`${order[0].resultAddress.address.state}`);
        doc.moveDown(0.2)
        doc.fontSize(12).text(`${order[0].resultAddress.address.streetAddress},${order[0].resultAddress.address.city}`);
        doc.moveDown(0.2)
        doc.fontSize(12).text(`${order[0].resultAddress.address.postcode},${order[0].resultAddress.address.phone}`);
        doc.moveDown(0.5)
        doc.text(`Delivery Date: ${new Date(order[0].createdAt).toLocaleDateString()}`);
        doc.moveDown(2);

        const headerY = doc.y; 
        doc.rect(50, headerY, 500, 25).fill('#5CBDFE'); 
        doc.fillColor('#000').fontSize(12).text('Product', 55, headerY + 5, { width: 100, align: 'left' });
        doc.text('Quantity', 260, headerY + 5, { width: 100, align: 'left' });
        doc.text('Size', 320, headerY + 5, { width: 100, align: 'left' });
        doc.text('Amount', 430, headerY + 5, { width: 100, align: 'left' });

        doc.strokeColor('#0000FF').lineWidth(1).moveTo(50, headerY + 25).lineTo(550, headerY + 25).stroke();
        doc.moveDown(1);

        order.forEach((item) => {
            const rowY = doc.y;
            doc.fillColor('#000');
            doc.text(`${item.resultProducts.productName}`, 55, rowY + 5, { width: 300, align: 'left' });
            doc.text(`${item.products.size}`, 260, rowY + 5, { width: 50, align: 'left' });
            doc.text(`${item.products.quantity}`, 320, rowY + 5, { width: 100, align: 'left' });
            doc.text(`₹${item.products.productAmount}`, 430, rowY + 5, { width: 100, align: 'left' });
            doc.moveDown(1);
        });

        doc.moveDown(1);
        doc.text(`Offer Discount: ₹${order[0].offerDiscount?? 0}`, { align: 'right' });
        doc.moveDown(0.5);
        doc.text(`Coupon Discount: ₹${order[0].couponDiscount?? 0}`, { align: 'right' });
        doc.moveDown(0.5);
        doc.fontSize(12).text(`Total Payable: ₹${order[0].totalAmount}`, { align: 'right', underline: true });
        doc.moveDown(2);

        doc.text(`Payment Status: ${order[0].paymentmethod}`, { align: 'center' });
        doc.moveDown(1);

        doc.end()
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        console.log(error.message);
    }
}

const completePayment = async (req,res)=>{
    try {
        console.log('hi');
        const order=req.query.order
        try {
            await orders.updateOne(
                {
                    _id:order
                },
                {
                    $set:{
                        paymentmethod:'Online Payment'
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

module.exports={
    checkProductQuantity,
    loadCheckoutPage,
    placeOrder,
    loadMyOrderPage,
    loadOrderSummary,
    loadOrderManagement,
    loadOrderDetails,
    updateStatus,
    cancelOrder,
    requestReturn,
    confirmReturn,
    loadRazorPayment,
    verifyRazorPayment,
    downloadInvoice,
    completePayment
}