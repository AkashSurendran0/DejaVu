const env=require('dotenv').config()
const users=require('../models/userSchema')
const address = require('../models/addressSchema')
const mongoose=require('mongoose')

const STATUS_SERVER_ERROR=parseInt(process.env.STATUS_SERVER_ERROR)
const STATUS_NOT_FOUND=parseInt(process.env.STATUS_NOT_FOUND)

const manageAddress = async (req,res)=>{
    try {
        const user=await users.findOne({email: req.session.userEmail})        
        const foundAddress=await address.findOne({user: user._id})
        res.render('manageAddress', {msg:req.flash('msg'), foundAddress: foundAddress})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

const getAddAddressForm = async (req,res)=>{
    try {
        res.render('addAddress')
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

const addAddress = async (req,res)=>{
    try {
        const user=await users.findOne({email: req.session.userEmail})
        const data={
                name:req.body.name,
                state:req.body.state,
                streetAddress:req.body.street,
                apartment:req.body.apartment,
                city:req.body.city,
                postcode:req.body.postcode,
                phone:req.body.phone,
                altPhone:req.body.altPhone
        }
        await address.updateOne(
            {user: user._id},
            {$push:{address:data}},
            {upsert:true}
        )
        req.flash('msg', 'Address added Successfully')
        res.redirect('/user/settings/manageAddress')
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

const deleteAddress = async (req,res)=>{
    try {
        const id=req.params.id
        await address.updateOne(
            {'address._id': id},
            {$pull:{address:{_id: id}}}
        )
        req.flash('msg', 'Address deleted successfully')
        res.redirect('/user/settings/manageAddress')
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

const getEditAddressForm = async (req,res)=>{
    try {
        const id=req.params.id 
        const foundAddress=await address.aggregate([
            {
                $unwind:'$address'
                
            },
            {
                $match:{
                    'address._id': new mongoose.Types.ObjectId(id)
                }
            }       
        ])
        res.render('editAddress', {address:foundAddress})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message); 
    }
}

const editAddress = async (req,res)=>{
    try {
        const Currentaddress=req.params.id
        const data={
                name:req.body.name,
                state:req.body.state,
                streetAddress:req.body.street,
                apartment:req.body.apartment,
                city:req.body.city,
                postcode:req.body.postcode,
                phone:req.body.phone,
                altPhone:req.body.altPhone
        }
        await address.updateOne(
            {'address._id':Currentaddress},
            {$set:{"address.$":data}},
        )
        req.flash('msg', 'Address Updated Succesfully')
        res.redirect('/user/settings/manageAddress')
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

const addAddressFromCheckout = async (req,res)=>{
    try {
        const addressId=req.query.address
        const cart=req.params.cart
        const user=await users.findOne({email: req.session.userEmail})
        const data={
            name:req.body.name,
            state:req.body.state,
            streetAddress:req.body.street,
            apartment:req.body.apartment,
            city:req.body.city,
            postcode:req.body.postcode,
            phone:req.body.phone,
            altPhone:req.body.altPhone
        }

        if(addressId){
            await address.updateOne(
                {'address._id':addressId},
                {$set:{"address.$":data}}
            )
            req.flash('msg', 'Address edited successfully')
            return res.redirect(`/user/checkout/${cart}`)
        }

        await address.updateOne(
            {user: user._id},
            {$push:{address:data}},
            {upsert:true}
        )

        req.flash('msg', 'Address added successfully')
        res.redirect(`/user/checkout/${cart}`)
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

module.exports={
    manageAddress,
    getAddAddressForm,
    addAddress,
    deleteAddress,
    getEditAddressForm,
    editAddress,
    addAddressFromCheckout
}