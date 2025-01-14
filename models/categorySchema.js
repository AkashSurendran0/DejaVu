const mongoose=require('mongoose')

const categorySchema=new mongoose.Schema({
    name:{
        type: String,
        required: true
    },
    description:{
        type: String,
        required: true
    },
    isDeleted:{
        type: Boolean,
        default: false
    }
},{timestamps:true})

const categories=mongoose.model('categories', categorySchema)

module.exports=categories;