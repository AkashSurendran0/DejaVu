const mongoose=require('mongoose')

const cartSchema=new mongoose.Schema({
    user:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'users',
        required:true
    },
    products:[{
        productId:{
            type:mongoose.Schema.Types.ObjectId,
            ref:'products',
            required:true
        },
        size:{
            type:String,
            required:true
        },
        quantity:{
            type:Number,
            required:true
        }
    }],
    totalQuantity:{
        type:Number,
        default:0,
    },
    totalAmount:{
        type:Number,
        default:0,
    }
},{timestamps:true})

const carts=new mongoose.model('carts', cartSchema)

module.exports=carts