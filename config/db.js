const mongoose=require('mongoose')
const env=require('dotenv').config()

const dbconnect = async ()=>{
    try {
        mongoose.connect(process.env.CONNECTDB)
        console.log('Database connected');
    } catch (error) {
        console.log('Database connection failed');
    }
}

module.exports=dbconnect; 