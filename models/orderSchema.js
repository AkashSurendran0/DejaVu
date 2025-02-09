const mongoose=require('mongoose')

const orderSchema=new mongoose.Schema({
    user:{
        type: mongoose.Schema.Types.ObjectId,
        ref:'users',
        required:true
    },
    products:[{
            productId:{
                type:mongoose.Schema.Types.ObjectId,
                ref:'products',
                required:true
            },
            productAmount:{
                type:Number,
                required:true
            },
            size:{
                type:String,
                required:true
            },
            quantity:{
                type:Number,
                required:true
            },
            status:{
                type:String,
                enum:['Pending','Delivered','Cancelled','Return requested', 'Returned', 'Return Cancelled'],
                default: 'Pending',
                required: true
            },
            cancelReason:{
                type:String,
                required:false
            }
        }],
    status:{
        type:String,
        enum:['Pending','Delivered','Shipped','Cancelled','Out for Delivery'],
        default: 'Pending',
        required: true
    },
    offerDiscount:{
        type:Number,
        required:false
    },
    couponDiscount:{
        type:Number,
        required:false
    },
    quantity:{
        type:Number,
        required:true
    },
    paymentmethod:{
        type:String,
        required:true,
        enum:['Cash On Delivery','Online Payment','Payment Failed']
    },
    totalAmount:{
        type:Number,
        required:true
    },
    address:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'addresses',
        required:true
    }
},{timestamps:true})

const orders=new mongoose.model('orders', orderSchema)

module.exports=orders