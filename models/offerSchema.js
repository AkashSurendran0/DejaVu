const mongoose=require('mongoose')

const offerSchema=new mongoose.Schema({
    minAmount:{
        type:Number,
        required:true
    },
    maxAmount:{
        type:Number,
        required:true
    },
    category:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'categories',
        required:true
    },
    offer:{
        type:Number,
        required:true
    }
},{timestamps:true})

const offers=mongoose.model('offers', offerSchema)

module.exports=offers