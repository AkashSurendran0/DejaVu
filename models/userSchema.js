const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
    name:{
        type: String,
        required: true
    },
    image:{
        type: String,
        required: false
    },
    phone:{
        type: Number,
        required: false
    },
    email:{
        type: String,
        required: true
    },
    dob:{
        type: String,
        required:false
    },
    gender:{
        type: String,
        required: false
    },
    password:{
        type: String,
        required: false
    },
    googleId:{
        type: String,
        required: false
    },
    isBlocked:{
        type: Boolean,
        default: false
    }
},{timestamps: true})

const users = new mongoose.model('users', userSchema)

module.exports=users