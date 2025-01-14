const mongoose=require('mongoose')

const offerSchema=new mongoose.Schema({
    startDate:{
        type:String,
        required:true
    },
    endDate:{
        type:String,
        required:true
    },
    minAmount:{
        type:Number,
        required:true
    },
    maxAmount:{
        type:Number,
        required:true
    },
    category:{
        type:mongoose.Schema.Types.String,
        ref:'categories',
        required:true
    },
    offer:{
        type:Number,
        required:true
    },
    isActive:{
        type:Boolean,
        default:false
    }
},{timestamps:true})

const offers=mongoose.model('offers', offerSchema)

module.exports=offers