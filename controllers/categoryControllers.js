const mongoose=require('mongoose')
mongoose.set('strictPopulate', false)

const categories=require('../models/categorySchema')
const env=require('dotenv').config()

const STATUS_SERVER_ERROR=parseInt(process.env.STATUS_SERVER_ERROR)

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
        res.status(STATUS_SERVER_ERROR).render('admin404')
        
    }
}

const addCategoriesForm = async (req,res)=>{
    try {
        res.render('addCategories', {message: req.flash('categoryExistsMessage')})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('admin404')
        
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
        res.status(STATUS_SERVER_ERROR).render('admin404')
        
    }
}

const editCategoryForm = async(req,res)=>{
    try {
        const id=req.params.id
        const category= await categories.findById(id)
        res.render('editCategory', {category: category})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('admin404')
        
    }
}

const editCategory = async(req,res)=>{
    try {
        const id=req.params.id
        const sameCategory = await categories.findOne({name:{$regex:`^${req.body.category}`, $options:'i'}, _id:{$ne:id}})
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
        res.status(STATUS_SERVER_ERROR).render('admin404')
        
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
        res.status(STATUS_SERVER_ERROR).render('admin404')
        
    }
    
}

module.exports={
    showCategories,
    addCategoriesForm,
    addCategory,
    editCategoryForm,
    editCategory,
    deleteCategory
}