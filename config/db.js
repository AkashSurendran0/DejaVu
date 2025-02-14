const mongoose=require('mongoose')
const env=require('dotenv').config()

const dbconnect = async ()=>{
    try {
        mongoose.connect(process.env.CONNECTDB)
    } catch (error) {
        console.log('Database connection failed');
    }
}

module.exports=dbconnect;