const mongoose=require('mongoose')

const walletSchema=new mongoose.Schema({
    user:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'users',
        required:true
    },
    walletAmount:{
        type:Number,
        required:true
    },
    creditHistory:[{
        orderId:{
            type:mongoose.Schema.Types.ObjectId,
            ref:'orders',
        },
        productId:{
            type:mongoose.Schema.Types.ObjectId,
            ref:'products',
        },
        quantity:{
            type:Number,
        },
        creditAmount:{
            type:Number,
        },
        creditDate:{
            type:Date,
        }
    }],
    debitHistory:[{
        orderId:{
            type:mongoose.Schema.Types.ObjectId,
            ref:'orders',
        },
        debitDate:{
            type:Date,
        }
    }]
},{timestamps:true})

const wallets=new mongoose.model('wallets', walletSchema)

module.exports=wallets