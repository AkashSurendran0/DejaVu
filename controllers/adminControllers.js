const mongoose=require('mongoose')
mongoose.set('strictPopulate', false)

const admins=require('../models/adminSchema')
const users=require('../models/userSchema')

const STATUS_SERVER_ERROR=parseInt(process.env.STATUS_SERVER_ERROR)

const loadAdminPage = async (req,res)=>{
    try {
        res.render('login', ({messageInvalid:req.flash('invalidAdmin'), messageWrong:req.flash('invalidPassword')}))
        console.log('At admin login page');
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        console.log(error.message);
    }
}

const adminAuthenticate = async (req,res)=>{
    try {
        const {email,password}=req.body
        const admin=await admins.findOne({email})
        if(!admin){
            req.flash('invalidAdmin', 'Admin not Found')
            return res.redirect('/admin')
        }
        const passwordCheck = password === admin.password
        if(!passwordCheck){
            req.flash('invalidPassword', 'Invalid Password')
            return res.redirect('/admin')
        }
        req.session.adminLogged=true
        res.redirect('/admin/dashboard')
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        console.log(error.message);
    }
}

const showDashboard = async (req,res)=>{
    try {
        res.render('dashboard')
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        console.log(error.message);
    }
    
}

const showUserManagement = async (req,res)=>{
    try {
        const page=parseInt(req.query.page) || 1
        const limit=parseInt(req.query.limit) || 10
        const skip=(page-1)*limit

        const userList = await users.find()
        .skip(skip)
        .limit(limit)

        const totalUsers=await users.countDocuments()
        const totalPages=Math.ceil(totalUsers/limit)
        res.render('userManagement', {users : userList, 
            userBlocked:req.flash('userBlocked'), 
            userUnblocked: req.flash('userUnblocked'),
            currentPage: page,
            totalPages: totalPages,
            limit: limit
        }) 
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        console.log(error.message);
    }
} 

const manageUser = async (req,res)=>{
    try {
        const id=req.params.id
        const user = await users.findById(id)
        if(user.isBlocked == false){
            req.flash('userBlocked', 'User Blocked Successfully.')
            await users.updateOne(
                {_id: id},
                {$set: {isBlocked:true}}
        )}else{
            req.flash('userUnblocked', 'User Unblocked Successfully.')
            await users.updateOne(
                {_id: id},
                {$set: {isBlocked:false}}
        )}
        res.redirect('/admin/usersManagement')
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        console.log(error.message);
    }
}

const adminLogout = async (req,res)=>{
    try {
        req.session.destroy(()=>{
            res.redirect('/admin');
        })
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        console.log(error.message);
    }
}

module.exports={
    loadAdminPage,    
    adminAuthenticate,
    showDashboard,
    showUserManagement,
    manageUser,
    adminLogout
}