const mongoose = require('mongoose')

const bannerSchema=new mongoose.Schema({
    category:{
        type: String
    },
    image:{
        type: String
    }
})

const banner=new mongoose.model('banners', bannerSchema)

module.exports=banner