const bcrypt=require('bcrypt')
const env=require('dotenv').config()

const STATUS_SERVER_ERROR=process.env.STATUS_SERVER_ERROR

const hashPassword=async(password)=>{
    try {
        const hashedPass=await bcrypt.hash(password,10)
        return hashedPass
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

const check=async(password,dbPassword)=>{
    try {
        return await bcrypt.compare(password,dbPassword)
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

module.exports={
    hashPassword,
    check
}