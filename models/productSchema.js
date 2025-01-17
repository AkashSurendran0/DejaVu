const mongoose=require('mongoose')

const productSchema=new mongoose.Schema({
    images:[{
        type:String,
        required:true
    }],
    productName:{
        type:String,
        required:true
    },
    amount:{
        type:Number,
        required:true
    },
    stock:{
        type:Number,
        required:true
    },
    sizeAvailable:{
        S:{
            type:Number
        },
        M:{
            type:Number
        },
        L:{
            type:Number
        },
        XL:{
            type:Number
        },
        XXL:{
            type:Number
        }
    },
    description:[{
        type:String,
        required:true
    }],
    category:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'categories',
        required:true
    },
    colorsAvailable:[{
        type:String,
        required: false
    }],
    review:[{
        user:{
            type:mongoose.Schema.Types.String,
            ref:'users',
            required:true
        },
        rating:{
            type:Number,
            required:true
        },
        desc:{
            type:String,
            required:true
        }
    },{_id:false}],
    isDeleted:{
        type:Boolean,
        default:false
    },
},{timestamps:true})    

const products=mongoose.model('products', productSchema)

module.exports=products