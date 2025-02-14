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
        enum:['Cash On Delivery','Online Payment','Payment Failed', 'Wallet Payment']
    },
    totalAmount:{
        type:Number,
        required:true
    },
    GST:{
        type:Number,
        required:true
    },
    address:{
        name:{
            type: String,
            required:true
        },
        state:{
            type:String,
            required: true
        },
        streetAddress:{
            type:String,
            required:true
        },
        apartment:{
            type:String,
            required:false,
            default:'none'
        },
        city:{
            type:String,
            required:true
        },
        postcode:{
            type:Number,
            required:true
        },
        phone:{
            type:Number,
            required:true
        },
        altPhone:{
            type:Number,
            required:false
        }
    }
},{timestamps:true})

const orders=new mongoose.model('orders', orderSchema)

module.exports=orders