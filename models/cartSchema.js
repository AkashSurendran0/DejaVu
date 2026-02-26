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
        },
        amount:{
            type:Number,
            required:true,
            description:'Discounted price of product at time of adding to cart'
        },
        regularPrice:{
            type:Number,
            required:false,
            description:'Original price of product at time of adding to cart'
        }
    }],
    totalQuantity:{
        type:Number,
        default:0,
    },
    totalAmount:{
        type:Number,
        default:0,
    },
    GST:{
        type:Number,
        default:0
    },
    offerDiscount:{
        type:Number,
        required:false,
        default:0
    }
},{timestamps:true})

const carts=new mongoose.model('carts', cartSchema)

module.exports=carts