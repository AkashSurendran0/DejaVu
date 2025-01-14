const mongoose=require('mongoose')
mongoose.set('strictPopulate', false)

const admins=require('../models/adminSchema')
const categories=require('../models/categorySchema')
const products=require('../models/productSchema')
const users=require('../models/userSchema')
const offers=require('../models/offerSchema')
const env=require('dotenv').config()

const STATUS_SERVER_ERROR=process.env.STATUS_SERVER_ERROR

const loadAdminPage = async (req,res)=>{
    try {
        res.render('login', ({messageInvalid:req.flash('invalidAdmin'), messageWrong:req.flash('invalidPassword')}))
        console.log('At admin login page');
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
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
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

const showDashboard = async (req,res)=>{
    try {
        res.render('dashboard')
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
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
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
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
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

const showCategories = async (req,res)=>{
    try {
        const page=parseInt(req.query.page) || 1
        const limit=parseInt(req.query.limit) || 10
        const skip=(page-1)*limit

        const allCategory = await categories.find()
        .skip(skip)
        .limit(limit)

        const totalCategories=await categories.countDocuments()
        const totalPages=totalCategories/limit
        res.render('categories', {messageAdded: req.flash('categoryAdded'),
            categoryList: allCategory, 
            messageEdited: req.flash('categoryEdited'), 
            messageDeleted: req.flash('categoryDeleted'),
            currentPage: page,
            limit: limit,
            totalPages: totalPages,
            message: req.flash('categoryExistsMessage')
        })
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
    
}

const addCategoriesForm = async (req,res)=>{
    try {
        res.render('addCategories', {message: req.flash('categoryExistsMessage')})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
    
}

const addCategory = async (req,res)=>{
    try {
        const {category,description} = req.body
        const sameCategory = await categories.findOne({name:category})
        if(sameCategory){
            req.flash('categoryExistsMessage', 'Category already exists.')
            return res.redirect('/admin/categories/addCategoryForm')
        }
        const data={
            name: category,
            description: description
        }
        await categories.insertMany(data)
        req.flash('categoryAdded', 'Category added Successfully.')
        res.redirect('/admin/categories')
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
    
}

const editCategoryForm = async(req,res)=>{
    try {
        const id=req.params.id
        const category= await categories.findById(id)
        res.render('editCategory', {category: category})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
    
}

const editCategory = async(req,res)=>{
    try {
        const id=req.params.id
        const sameCategory = await categories.findOne({name:req.body.category})
        if(sameCategory){
            req.flash('categoryExistsMessage', 'Category already exists.')
            return res.redirect('/admin/categories')
        }
        const data={
            name: req.body.category,
            description: req.body.description
        }
        await categories.updateOne(
            {_id: id},
            {$set: data}
        )
        req.flash('categoryEdited', 'Category Edited Successfully.')
        res.redirect('/admin/categories')
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
    
}

const deleteCategory = async(req,res)=>{
    try {
        const id=req.params.id
        const category= await categories.findById(id)
        if(category.isDeleted == false){
            await categories.updateOne(
                {_id: id},
                {$set: {isDeleted:true}}
        )}else{
            await categories.updateOne(
                {_id: id},
                {$set: {isDeleted:false}}
        )}
        req.flash('categoryDeleted', 'Category Deleted Successfully.')
        res.redirect('/admin/categories')
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
    
}

const showProducts = async (req,res)=>{
    try {
        const page=parseInt(req.query.page) || 1
        const limit=parseInt(req.query.limit) || 10
        const skip=(page-1)*limit

        const productList = await products.find()
        .populate('category')
        .skip(skip)
        .limit(limit)

        const totalProduct=await products.countDocuments()
        const totalPages=Math.ceil(totalProduct/limit)

        res.render('products', {
            messageSuccess: req.flash('addedSuccess'), 
            products: productList, 
            messageEdited: req.flash('editSuccess'),
            messageInvalid: req.flash('invalidCategory'), 
            productAction: req.flash('productAction'),
            currentPage: page,
            totalPages: totalPages,
            limit: limit
        })
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
    
}

const addProductForm = async (req,res)=>{
    try {
        const category=await categories.find()
        res.render('addProducts',{category: category,
            messageInvalid: req.flash('authError')
        })
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
   
}

const addProduct = async (req,res)=>{
    try {
        const similarProduct=await products.findOne({productName: req.body.productName})
        if(similarProduct){
            req.flash('invalidCategory', 'Product Exists')
            return res.redirect('/admin/products')
        }
        const Category=req.body.productCategory
        const categoryDoc=await categories.findOne({name:Category})
        const colorsInput=req.body.productColors
        const colors=colorsInput.split(',').map(color=>color.trim())
        const description=req.body.productDesc
        const desc=description.split(',').map(desc=>desc.trim().charAt(0).toUpperCase() + desc.trim().slice(1).toLowerCase())
        const imagePaths=req.files.map(file=> `/uploads/${file.filename}`)
        const data={
            images: imagePaths,
            productName: req.body.productName,
            category: categoryDoc._id,
            amount: req.body.productAmount,
            stock: req.body.productCount,
            colorsAvailable: colors,
            sizeAvailable:{
                S: req.body.Scount || 0,
                M: req.body.Mcount || 0,
                L: req.body.Lcount || 0,
                XL: req.body.XLcount || 0,
                XXL: req.body.XXLcount || 0
            },
            description: desc,
        }
        await products.insertMany(data)
        req.flash('addedSuccess', 'Product Added Successfully')
        res.redirect('/admin/products')
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
    
}

const editProductForm = async (req,res)=>{
    try {
        const id=req.params.id
        const categoryList=await categories.find()
        const product= await products.findById(id).populate('category')
        console.log(product);
        res.render('editProduct', {product: product, category: categoryList})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }  
}

const editProduct = async(req,res)=>{
    try {
        const amountStockPattern=/^[0-9]*$/
        if(!amountStockPattern.test(req.body.productAmount) && !amountStockPattern.test(req.body.productCount) && !amountStockPattern.test(req.body.Scount) && !amountStockPattern.test(req.body.Mcount) && !amountStockPattern.test(req.body.Lcount) && !amountStockPattern.test(req.body.XLcount) && !amountStockPattern.test(req.body.XXLcount)){
            req.flash('authError', 'Input Error')
            return res.redirect('/admin/products/addProductForm')
        }
        const id=req.params.id
        const categoryName=req.body.productCategory
        const category=await categories.findOne({name: categoryName})
        const colorsInput=req.body.productColors
        const colors=colorsInput.split(',').map(color=>color.trim())
        const description=req.body.productDesc
        const desc=description.split(',').map(desc=>desc.trim().charAt(0).toUpperCase() + desc.trim().slice(1).toLowerCase())
        const {existingImages}=req.body
        const imagePaths=req.files.map(file=> `/uploads/${file.filename}`)
        const data={
            images: imagePaths.length>0? imagePaths:existingImages,
            productName: req.body.productName,
            category: category._id,
            amount: req.body.productAmount,
            stock: req.body.productCount,
            colorsAvailable: colors,
            sizeAvailable:{
                S: req.body.Scount || 0,
                M: req.body.Mcount || 0,
                L: req.body.Lcount || 0,
                XL: req.body.XLcount || 0,
                XXL: req.body.XXLcount || 0
            },
            description: desc,
        }
        await products.updateOne(
            {_id: id},
            {$set: data}
        )
        req.flash('editSuccess', 'Product Edited Successfully')
        res.redirect('/admin/products')
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
    
}

const deleteProduct = async (req,res)=>{
    try {
        const id=req.params.id
        const product=await products.findOne({_id: id})
        if(product.isDeleted){
            await products.updateOne(
                {_id: id},
                {$set:{isDeleted:false}}
            )  
            req.flash('productAction', 'Product activated Successfully')
        }else{
            await products.updateOne(
                {_id: id},
                {$set:{isDeleted:true}}
            )
            req.flash('productAction', 'Product deactivated Successfully')
        }
        res.redirect('/admin/products')
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

const loadOfferPage = async (req,res)=>{
    try {
        const category=await categories.find()
        const currentOffers=await offers.find()
        res.render('offers', {
            categories: category,
            msg:req.flash('offMsg'),
            offers: currentOffers,
            offErr: req.flash('offErr')
        })
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

const loadAddOfferPage = async(req,res)=>{
    try {
        const category=await categories.find()        
        res.render('addOffers', {categories: category})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

const addOffer = async (req,res)=>{
    try {
        const{offerCategory,minPrice,maxPrice,startDate,endDate,offer}=req.body
        const allOffers=await offers.find()
        let offerExists=false
        for(let i=0;i<allOffers.length;i++){
            if(allOffers[i].category===offerCategory){
                offerExists=true
            }
        }
        if(offerExists){
            req.flash('offErr', 'Offer Exists')
            return res.redirect('/admin/offers')
        }
        const data={
            category: offerCategory,
            minAmount: minPrice,
            maxAmount: maxPrice,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            offer: offer
        }

        await offers.insertMany(data)
        req.flash('offMsg', 'Offer added Successfully')
        res.redirect('/admin/offers')
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

const loadOfferEditPage = async (req,res)=>{
    try {
        const id=req.params.id
        const offer=await offers.findById(id)
        const allCategory=await categories.find()
        res.render('editOffers', {offer: offer, categories: allCategory})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

const editOffer = async (req,res)=>{
    try {
        const id=req.params.id
        const{offerCategory,minPrice,maxPrice,startDate,endDate,offer}=req.body
        const data={
            category: offerCategory,
            minAmount: minPrice,
            maxAmount: maxPrice,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            offer: offer
        }
        await offers.findByIdAndUpdate(
            id,
            {$set: data}
        )
        req.flash('offMsg', 'Offer edited successfully')
        res.redirect('/admin/offers')
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

const deleteOffer = async (req,res)=>{
    try {
        const id=req.params.id
        const offer=await offers.findById(id)
        if(offer.isActive){
            await offers.findByIdAndUpdate(
                id,
                {$set: {isActive:false}}
            )
            req.flash('offMsg', 'Offer Deactivated Successfully')
        }else{
            await offers.findByIdAndUpdate(
                id,
                {$set: {isActive:true}}
            )
            req.flash('offMsg', 'Offer Activated Successfully')
        }
        res.redirect('/admin/offers')
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).send('Server not responding')
        console.log(error.message);
    }
}

module.exports={
    loadAdminPage,    
    adminAuthenticate,
    showDashboard,
    showUserManagement,
    showCategories,
    addCategoriesForm,
    addCategory,
    editCategoryForm,
    editCategory,
    deleteCategory,
    showProducts,
    addProductForm,
    addProduct,
    editProductForm,
    editProduct,
    deleteProduct,
    manageUser,
    loadOfferPage,
    loadAddOfferPage,
    addOffer,
    loadOfferEditPage,
    editOffer,
    deleteOffer
}