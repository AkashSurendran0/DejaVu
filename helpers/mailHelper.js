const nodemailer=require('nodemailer')
const env=require('dotenv').config()

const transporter=nodemailer.createTransport({
    service: 'gmail',
    port: 587,
    secure: false,
    requireTLS: true,
    auth:{
        user: process.env.USER_EMAIL,
        pass: process.env.USER_PASS
    },
    tls:{
        rejectUnauthorized: false
    }
})

const sendMail = async({from,to,subject,text})=>{
    try {
        const mailOptions={
            from: from || `DejaVu Ecommerce, ${process.env.USER_EMAIL}` ,
            to,
            subject,
            text
        }

        const result=await transporter.sendMail(mailOptions)
        return result   
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
}

module.exports=sendMail