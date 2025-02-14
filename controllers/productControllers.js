const mongoose=require('mongoose')
mongoose.set('strictPopulate', false)

const categories=require('../models/categorySchema')
const users=require('../models/userSchema')
const products=require('../models/productSchema')
const banners=require('../models/bannerSchema')
const {ObjectId}=require('mongodb')
const offers=require('../models/offerSchema')

const STATUS_SERVER_ERROR=parseInt(process.env.STATUS_SERVER_ERROR)
const STATUS_NOT_FOUND=parseInt(process.env.STATUS_NOT_FOUND)

const showProducts = async (req,res)=>{
    try {
        const page=parseInt(req.query.page) || 1
        const limit=parseInt(req.query.limit) || 10
        const skip=(page-1)*limit

        const productList = await products.find()
        .populate('category')
        .skip(skip)
        .limit(limit)
        .sort({createdAt : -1})

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
        res.status(STATUS_SERVER_ERROR).render('admin404')
        
    }
}

const addProductForm = async (req,res)=>{
    try {
        const category=await categories.find()
        res.render('addProducts',{category: category,
            messageInvalid: req.flash('authError')
        })
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('admin404')
        
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
        res.status(STATUS_SERVER_ERROR).render('admin404')
        
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
        res.status(STATUS_SERVER_ERROR).render('admin404')
        
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
        res.status(STATUS_SERVER_ERROR).render('admin404')
        
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
        res.status(STATUS_SERVER_ERROR).render('admin404')
        
    }
}

const loadShopPage = async (req,res)=>{
    try {
        const highestPrice=parseInt(req.query.highestAmount) || 10000
        const leastPrice=parseInt(req.query.leastAmount) || 0     
        const page=parseInt(req.query.page) || 1
        const limit=parseInt(req.query.limit) || 6
        const skip=(page-1)*limit
        const banner=await banners.findOne({category: 'shirts'})
        const allCategories=await categories.find({isDeleted:false})

        let type=parseInt(req.query.sort) || 1
        let sort=req.query.sort || null
        let field
        if(sort=='atoz' || sort=='ztoa'){
            field='productName'
            type= sort=='atoz'? 1 : -1
        }else if(sort=='priceHightoLow' || sort=='priceLowtoHigh'){
            field='amount'
            type= sort=='priceLowtoHigh'? 1 : -1
        }else if(sort=='popHightoLow' || sort=='popLowtoHigh'){
            field='avgRating'
            type= sort=='popHightoLow'? -1 : 1
        }else if(sort=='newArrival'){
            field='createdAt'
            type=1
        }

        let category=false
        if(allCategories.length>0){
            category=req.query.category || false
        }
        let allProducts
        let productList

        if(category){
            allProducts=await products.aggregate([
                {$lookup:{
                    from: 'categories',
                    foreignField: '_id',
                    localField: 'category',
                    as: 'resultProducts'
                }},
                {
                    $unwind: '$resultProducts'
                },
                {
                    $match: {
                        'resultProducts.name':{$regex:`^${category}`, $options:'i'},
                        isDeleted:false
                    }
                }
            ])
    
            productList=await products.aggregate([
                {$lookup:{
                    from: 'categories',
                    foreignField: '_id',
                    localField: 'category',
                    as: 'resultProducts'
                }},
                {
                    $unwind: '$resultProducts'
                },
                {
                    $match: {
                        'resultProducts.name':{$regex:`^${category}`, $options:'i'},
                        isDeleted:false
                    }
                },
                {
                    $addFields:{
                        avgRating:{
                            $avg:'$review.rating'
                        }
                    }
                },
                {
                    $skip: skip
                },
                {
                    $limit: limit
                },
                {
                    $match:{
                        $and:[
                            {
                                amount:{
                                    $gte:leastPrice
                                }
                            },
                            {
                                amount:{
                                    $lte:highestPrice
                                }
                            }
                        ]
                    }   
                },
                {
                    $sort:{
                        [field]:type
                    }
                }
            ])
        }else{
            allProducts=await products.find({isDeleted:false})

            productList=await products.aggregate([
                {$lookup:{
                    from: 'categories',
                    foreignField: '_id',
                    localField: 'category',
                    as: 'resultProducts'
                }},
                {
                    $unwind: '$resultProducts'
                },
                {
                    $match: {
                        isDeleted:false
                    }
                },
                {
                    $addFields:{
                        avgRating:{
                            $avg:'$review.rating'
                        }
                    }
                },
                {
                    $skip: skip
                },
                {
                    $limit: limit
                },
                {
                    $match:{
                        $and:[
                            {
                                amount:{
                                    $gte:leastPrice
                                }
                            },
                            {
                                amount:{
                                    $lte:highestPrice
                                }
                            }
                        ]
                    }   
                },
                {
                    $sort:{
                        [field]:type
                    }
                }
            ])
        }
                        
        let totalCount=0
        let totalPages=0
        if(allProducts){
            totalCount=allProducts.length
            totalPages=Math.ceil(totalCount/limit)
        }
        
        if (!productList || productList.length === 0) {
            productList = false;
          }
        
          let categoryId = productList && productList[0]?.resultProducts?._id;
          if (!categoryId) {
            categoryId=false;
          }      
          
        res.render('shop', {
            product: productList, 
            banner:banner,
            category: category,
            allCategories: allCategories,
            currentPage: page,
            totalPages: totalPages,
            limit: limit
        })
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        
    }
}

const loadProductDetailsPage = async (req,res)=>{
    try {
        const id=req.params.id
        const singleProduct=await products.findById(id)
        let avgRating
        if(singleProduct.review.length>0){
            avgRating=await products.aggregate([
                {$match:{_id: new ObjectId(id)}},
                {$unwind:'$review'},
                {$group:{_id:null, rating:{$avg:'$review.rating'}}}
            ])
        }       
        
        let productRating=0
        if(avgRating){
            productRating=Math.floor(avgRating[0].rating)
        }
        
        const similarProducts=await products.aggregate([
            {$lookup:{
                from: 'categories',
                foreignField: '_id',
                localField: 'category',
                as: 'resultProducts'
            }},
            {
                $unwind: '$resultProducts'
            },
            {
                $match: {
                    'resultProducts._id':singleProduct.category,
                    isDeleted:false
                }
            }
        ])

        const randomNumbers=new Set()
        while (randomNumbers.size<3){
            const randomNum=Math.floor(Math.random()*10)+1
            if(randomNum<=similarProducts.length){
                randomNumbers.add(randomNum)
            }
        }
        let simProducts=[]
        const randomNums=Array.from(randomNumbers)
        for(let i=0;i<randomNums.length;i++){
            simProducts[i]=similarProducts[randomNums[i]-1]
        }
        
        res.render('singleProduct', {
            product:singleProduct, 
            similarProducts: simProducts, 
            rating: productRating,
            quantityErr: req.flash('quantityErr')
        })
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        
    }
}

const addProductReview = async (req,res)=>{
    try {
        const id=req.params.id
        const product=await products.findById(id)
        const user=await users.findOne({email:req.session.userEmail})
        let data={
            user:user.name,
            rating:req.body.rating,
            desc:req.body.comment
        }
        await products.updateOne(
            {_id: product.id},
            {$push:{review:data}}
        )
        res.redirect(`/user/shop/product-details/${id}`)
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        
    }
}

const findProducts = async (req,res)=>{
    try {
        const name=req.query.name
        const category=req.query.category?.trim()     

        if(category && category !== "null" && category !== ""){
            const foundCategory=await categories.findOne(
                {
                    name:{
                        $regex: new RegExp(`^${category}`, 'i')
                    }
                }
            )
            
            const foundProducts=await products.find(
                {
                    productName:{
                        $regex: new RegExp(`^${name}`, 'i')
                    },
                    category:foundCategory._id
                }
            ).limit(9)
            return res.json({products:foundProducts})
        }
        
        const foundProducts=await products.find(
            {
                productName:{
                    $regex: new RegExp(`^${name}`, 'i')
                },
            }
        ).limit(9)
        
        res.json({products:foundProducts})

    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('404page')
        
    }
}

module.exports={
    showProducts,
    addProductForm,
    addProduct,
    editProductForm,
    editProduct,
    deleteProduct,
    loadProductDetailsPage,
    addProductReview,
    loadShopPage,
    findProducts
}