const mongoose=require('mongoose')

const couponSchema=new mongoose.Schema({
    code:{
        type:String,
        required:true
    },
    minPrice:{
        type:Number,
        required:true
    },
    description:{
        type:String,
        required:true
    },
    offer:{
        type:Number,
        required:true
    },
    maxPrice:{
        type:Number,
        required:true
    },
    status:{
        type:Boolean,
        required:true,
        default:true
    },
    redeemedBy:[{
        type:mongoose.Types.ObjectId,
        ref:'users',
        required:true
    }]
},{timestamps:true})

const coupons=new mongoose.model('coupons', couponSchema)

module.exports=coupons