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

            const shippingAddress=await addresses.aggregate([
                {
                    $match:{
                        user:loggedUser._id,
                    }
                },
                {
                    $unwind:'$address'
                },
                {
                    $match:{
                        'address._id':new mongoose.Types.ObjectId(address)
                    }
                }
            ])

            let couponDiscount=0        
            let cartAmount=0
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
            }


            if(method=='Wallet Payment'){
                const userWallet=await wallets.findOne({user:loggedUser._id})
                if(!userWallet){
                    return res.json({walletNotExists:true})
                }
                const amount=cartAmount? cartAmount:cart.totalAmount
                if(userWallet.walletAmount<amount){
                    return res.json({noAmount:true})
                }
            }

            if(code){
                const coupon=await coupons.findOne({code:code})
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

            const userAddress={
                name:shippingAddress[0].address.name,
                state:shippingAddress[0].address.state,
                streetAddress:shippingAddress[0].address.streetAddress,
                apartment:shippingAddress[0].address.apartment,
                city:shippingAddress[0].address.city,
                postcode:shippingAddress[0].address.postcode,
                phone:shippingAddress[0].address.phone,
                altPhone:shippingAddress[0].address.altPhone
            }

            const data={
                user: user._id,
                products: arrayProducts,
                quantity: cart.totalQuantity,
                couponDiscount: couponDiscount,
                offerDiscount: cart.offerDiscount?? 0,
                paymentmethod: method,
                totalAmount: cartAmount? cartAmount:cart.totalAmount,
                GST:cart.GST,
                address: userAddress
            }

            await carts.deleteOne({_id: product})

            const newOrder=await orders.insertMany(data)

            if(method=='Wallet Payment'){
                const amount=cartAmount? cartAmount:cart.totalAmount
                const data={
                    orderId:newOrder[0]._id,
                    debitDate:new Date()
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
        }
    }

    const loadMyOrderPage = async (req,res)=>{
        try {
            const user=await users.findOne({email:req.session.userEmail})
            const allOrders=await orders.find({user:user._id}).populate('products.productId').sort({createdAt:-1})
            
            res.render('myOrders',{
                allOrders: allOrders
            })
        } catch (error) {
            res.status(STATUS_SERVER_ERROR).render('404page')
            
        }
    }

    const loadOrderSummary = async (req,res)=>{
        try {
            const orderId=req.params.order    
            const orderFound=await orders.findOne({_id:orderId}).populate('user').populate('products.productId')
            
            res.render('orderSummary',{
                order:orderFound
            })
        } catch (error) {
            res.status(STATUS_SERVER_ERROR).render('404page')
            
        }
    }

    const loadOrderManagement = async (req,res)=>{
        try {
            const allOrders=await orders.find().populate('products.productId').sort({createdAt:-1})
            
            res.render('orderManagement',{
                allOrders: allOrders
            })
        } catch (error) {
            res.status(STATUS_SERVER_ERROR).render('admin404')
            
        }
    }

    const loadOrderDetails = async (req,res)=>{
        try {
            const orderId=req.params.order
            const foundOrder=await orders.findOne({_id:orderId}).populate('user').populate('products.productId')     
            
            res.render('orderDetails',{
                order:foundOrder
            })
        } catch (error) {
            res.status(STATUS_SERVER_ERROR).render('admin404')
            
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
                if(foundOrder.paymentmethod=='Payment Failed'){
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
            
        }
    }

    const cancelOrder = async (req,res)=>{
        try {
            const userEmail=req.session.userEmail
            const loggedUser=await users.findOne({email:userEmail})
            const orderId=req.query.order
            const orderProductId=req.query.orderProductId
            const reason=req.query.reason
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
            const orderFound=await orders.findOne({_id: orderId})
            let couponDeduct=0
            let gstDeduct=0
            let offerDeduct=0
            const refundProducts = orderFound.products.filter(p => p.status !== 'Cancelled');

            if(orderFound.couponDiscount){
                couponDeduct=(orderFound.couponDiscount/refundProducts.length).toFixed(2)
            }
            if(orderFound.GST){
                gstDeduct=(orderFound.GST/refundProducts.length).toFixed(2)
            }
            if(orderFound.offerDiscount){
                offerDeduct=(orderFound.offerDiscount/refundProducts.length).toFixed(2)
            }

            const productFound = orderFound.products.find(p => p._id.toString() === orderProductId);
            let couponDiscount=0
            let creditAmount=parseInt(productFound.productAmount*productFound.quantity)+parseInt(gstDeduct)
            if(couponOrder){
                creditAmount=(creditAmount-couponDeduct).toFixed(2)
            }
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
            if(productAmount.length>0){
                const data={
                    orderId:new mongoose.Types.ObjectId(orderId),
                    productId:new mongoose.Types.ObjectId(productAmount[0].products.productId),
                    quantity:productAmount[0].products.quantity,
                    creditAmount:parseFloat(creditAmount),
                    creditDate:new Date()
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
                    _id:orderId,
                    'products._id':orderProductId
                },
                {
                    $inc:{
                        totalAmount:-Math.floor(creditAmount),
                        offerDiscount:-Math.floor(offerDeduct),
                        couponDiscount:-Math.floor(couponDeduct),
                        GST:-Math.floor(gstDeduct),
                    }
                }
            )
            await orders.updateOne(
                {
                    _id:orderId,
                    'products._id':orderProductId
                },
                [
                    {
                        $set:{
                            totalAmount:{$floor:'$totalAmount'},
                            offerDiscount: { $floor: '$offerDiscount' },
                            couponDiscount: { $floor: '$couponDiscount' },
                            GST: { $floor: '$GST' } 
                        }
                    }
                ]
            )
            let allCancelled=true
            const updatedOrder=await orders.findOne({_id: orderId})
            updatedOrder.products.forEach(products=>{
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
            
        }
    }

    const confirmReturn = async (req,res)=>{
        try {
            const order=req.query.order
            const userOrder=await orders.findOne({_id:order})
            const orderProductId=req.query.orderProductId        
            const confirm=parseInt(req.query.confirm)        

            if(confirm){
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
                const orderFound=await orders.findOne({_id: order})
                let couponDeduct=0
                let gstDeduct=0
                let offerDeduct=0
                const refundProducts = orderFound.products.filter(p => p.status !== 'Cancelled' && p.status !== 'Returned');
    
                if(orderFound.couponDiscount){
                    couponDeduct=(orderFound.couponDiscount/refundProducts.length).toFixed(2)
                }
                if(orderFound.GST){
                    gstDeduct=(orderFound.GST/refundProducts.length).toFixed(2)
                }
                if(orderFound.offerDiscount){
                    offerDeduct=(orderFound.offerDiscount/refundProducts.length).toFixed(2)
                }
                const productFound = orderFound.products.find(p => p._id.toString() === orderProductId);
                let couponDiscount=0
                let creditAmount=parseInt(productFound.productAmount*productFound.quantity)+parseInt(gstDeduct)
                if(couponOrder){
                    creditAmount=(creditAmount-couponDeduct).toFixed(2)
                }
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
                if(productAmount.length>0){
                    const data={
                        orderId:new mongoose.Types.ObjectId(order),
                        productId:productAmount[0].products.productId,
                        quantity:productAmount[0].products.quantity,
                        creditAmount:parseFloat(creditAmount),
                        creditDate:new Date()
                    }
                    await wallets.updateOne(
                        {
                            user:userOrder.user
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
                            totalAmount:-Math.floor(creditAmount),
                            offerDiscount:-Math.floor(offerDeduct),
                            couponDiscount:-Math.floor(couponDeduct),
                            GST:-Math.floor(gstDeduct)
                        }
                    }
                )
                await orders.updateOne(
                    {
                        _id:order,
                        'products._id':orderProductId
                    },
                    [
                        {
                            $set:{
                                totalAmount:{$floor:'$totalAmount'},
                                offerDiscount: { $floor: '$offerDiscount' },
                                couponDiscount: { $floor: '$couponDiscount' },
                                GST: { $floor: '$GST' } 
                            }
                        }
                    ]
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
            
        }
    }

    const loadRazorPayment = async (req,res)=>{
        try {            
            const id=req.query.cart?? req.query.order
            const coupon=req.query.code               
            const item=await carts.findOne({_id:id})?? await orders.findOne({_id:id})
            let amount=item.totalAmount
            if(coupon && coupon!='undefined'){                                
                const couponFound=await coupons.findOne({code:coupon})
                const reducedAmount=((item.totalAmount*couponFound.offer)/100).toFixed(2)
                if(reducedAmount < couponFound.maxPrice){                
                    amount=(item.totalAmount-reducedAmount).toFixed(2)
                }else{                
                    amount=(item.totalAmount-couponFound.maxPrice).toFixed(2)
                }
            }            
            const order=await razorpayInstance.orders.create({
                amount:Math.round(amount*100),
                currency:'INR',
                receipt:`receipt_${Date.now()}`
            })
            
            res.json({success:true, orders:order})
        } catch (error) {
            res.status(STATUS_SERVER_ERROR).render('404page')
            
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
            
        }
    }

    const downloadInvoice = async (req,res) =>{
        try {
            const orderId=req.query.order
            const order=await orders.findOne({_id:orderId}).populate('user').populate('products.productId')

            const doc=new PDFDocument()

            res.setHeader("Content-Type", "application/pdf")
            res.setHeader("Content-Disposition", 'attachment; filename="Product_Invoice_Report.pdf"')

            doc.pipe(res)
            doc.fontSize(22).fillColor('#333').text('Product Invoice-DejaVu Mens Store', {align:'center', underline:true})
            doc.moveDown(1)

            doc.fontSize(14).fillColor("#222")
            doc.text(`Customer Name: ${order.user.name}`);
            doc.text(`Email: ${order.user.email}`);
            doc.moveDown(0.5);

            doc.fontSize(14).fillColor("#222");
            doc.text(`Date: ${new Date().toLocaleDateString()}`);
            doc.moveDown(0.5);
            doc.text(`Delivery Address:`);
            doc.moveDown(0.2)
            doc.fontSize(12).text(`${order.address.name}`);
            doc.moveDown(0.2)
            doc.fontSize(12).text(`${order.address.state}`);
            doc.moveDown(0.2)
            doc.fontSize(12).text(`${order.address.streetAddress},${order.address.city}`);
            doc.moveDown(0.2)
            doc.fontSize(12).text(`${order.address.postcode},${order.address.phone}`);
            doc.moveDown(0.5)
            doc.text(`Delivery Date: ${new Date(order.createdAt).toLocaleDateString()}`);
            doc.moveDown(2);

            const headerY = doc.y; 
            doc.rect(50, headerY, 500, 25).fill('#5CBDFE'); 
            doc.fillColor('#000').fontSize(12).text('Product', 55, headerY + 5, { width: 100, align: 'left' });
            doc.text('Status', 230, headerY + 5, { width: 100, align: 'left' });
            doc.text('Quantity', 300, headerY + 5, { width: 100, align: 'left' });
            doc.text('Size', 370, headerY + 5, { width: 100, align: 'left' });
            doc.text('Amount', 450, headerY + 5, { width: 100, align: 'left' });

            doc.strokeColor('#0000FF').lineWidth(1).moveTo(50, headerY + 25).lineTo(550, headerY + 25).stroke();
            doc.moveDown(1);

            order.products.forEach((item) => {
                const rowY = doc.y;
                doc.fillColor('#000');
                doc.text(`${item.productId.productName}`, 55, rowY + 5, { width: 300, align: 'left' });
                doc.text(`${item.status}`, 230, rowY + 5, { width: 300, align: 'left' });
                doc.text(`${item.size}`, 300, rowY + 5, { width: 50, align: 'left' });
                doc.text(`${item.quantity}`, 370, rowY + 5, { width: 100, align: 'left' });
                doc.text(`₹${item.productAmount}`, 450, rowY + 5, { width: 100, align: 'left' });
                doc.moveDown(1);
            });

            const leftMargin=50
            const rightMargin=50

            const currentY=doc.y

            doc.moveDown(1);
            doc.text(`Total Amount: ₹${Math.floor(order.totalAmount-order.GST+order.couponDiscount+order.offerDiscount)?? order.totalAmount}`, leftMargin, currentY+40, { align: 'left' });
            doc.moveDown(0.5);
            doc.text(`GST applied @ 5%: ₹${order.GST?? 0}`, leftMargin, currentY+70, { align: 'left' });
            doc.moveDown(0.5);
            doc.text(`Offer Discount: ₹${order.offerDiscount?? 0}`, leftMargin, currentY+100, { align: 'left' });
            doc.moveDown(0.5);
            doc.text(`Coupon Discount: ₹${order.couponDiscount?? 0}`, leftMargin, currentY+130, { align: 'left' });
            doc.moveDown(0.5);
            doc.fontSize(12).text(`Total Payable: ₹${order.totalAmount}`, leftMargin, currentY+160, { align: 'left', underline: true });
            doc.moveDown(2);

            doc.text(`Payment Status: ${order.paymentmethod}`, leftMargin, currentY+190, { align: 'left' });
            doc.moveDown(1);

            doc.moveDown(1)
            doc.text(`Thanks for Shopping!`, rightMargin, currentY+40, { align: 'right' });
            doc.moveDown(0.5);
            doc.text(`DejaVu Mens Store`, rightMargin, currentY+70, { align: 'right' });
            doc.moveDown(0.5);
            doc.text(`Address:`, rightMargin, currentY+100, { align: 'right' });
            doc.moveDown(0.2)
            doc.fontSize(12).text(`1527 Fashion Ave`, rightMargin, currentY+120, { align: 'right' });
            doc.moveDown(0.2)
            doc.fontSize(12).text(`Los Angeles`, rightMargin, currentY+140, { align: 'right' });
            doc.moveDown(0.2)
            doc.fontSize(12).text(`CA 90015`, rightMargin, currentY+160, { align: 'right' });
            doc.moveDown(0.2)
            doc.fontSize(12).text(`USA`, rightMargin, currentY+180, { align: 'right' });
            doc.moveDown(0.5)
            doc.text(`dejavubusiness@gmail.com`, rightMargin, currentY+210, { align: 'right' });
            doc.moveDown(0.5);
            doc.fontSize(12).text(`+1 (213) 555-7890`, rightMargin, currentY+240, { align: 'right'});
            doc.moveDown(2);

            doc.end()
        } catch (error) {
            res.status(STATUS_SERVER_ERROR).render('404page')
            
        }
    }

    const completePayment = async (req,res)=>{
        try {
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
