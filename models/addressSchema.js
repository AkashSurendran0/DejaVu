const mongoose=require('mongoose')

const addressSchema = new mongoose.Schema({
    user:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'users',
        required:true
    },
    address:[{
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
    }]
},{timestamps:true})

const address=new mongoose.model('addresses', addressSchema)

module.exports=address