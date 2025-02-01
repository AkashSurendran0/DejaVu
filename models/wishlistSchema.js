const mongoose=require('mongoose')

const wishListSchema=new mongoose.Schema({
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
    }],
},{timestamps:true})

const wishlist=new mongoose.model('wishlists', wishListSchema)

module.exports=wishlist