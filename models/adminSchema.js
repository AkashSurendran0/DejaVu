const mongoose=require('mongoose')

const adminSchema = new mongoose.Schema({
    image:{
        type: String,
        required: false
    },
    name:{
        type: String,
        required: true
    },
    username:{
        type: String,
        required: true
    },
    email:{
        type: String,
        required: true
    },
    password:{
        type: String,
        required: true
    },
    dob:{
        type: Date,
        required: true
    }
},{timestamps:true})

const admin=new mongoose.model('admins', adminSchema)

module.exports=admin;