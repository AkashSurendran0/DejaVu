const express=require('express')
const routes=express.Router()
const adminRoutes=require('../controllers/adminControllers')
const upload=require('../middlewares/upload')
const adminAuth=require('../middlewares/adminAuth')
const admin = require('../models/adminSchema')

routes.get('/', adminRoutes.loadAdminPage)
routes.post('/login', adminRoutes.adminAuthenticate)
routes.get('/dashboard', adminAuth, adminRoutes.showDashboard)
routes.get('/usersManagement', adminAuth, adminRoutes.showUserManagement)
routes.get('/userManagement/manageUser/:id', adminAuth, adminRoutes.manageUser)
routes.get('/categories', adminAuth, adminRoutes.showCategories)
routes.get('/categories/addCategoryForm', adminAuth, adminRoutes.addCategoriesForm)
routes.post('/categories/addCategory', adminAuth, adminRoutes.addCategory)
routes.get('/categories/editCategory/:id', adminAuth, adminRoutes.editCategoryForm)
routes.post('/categories/editCategory/submit/:id', adminAuth, adminRoutes.editCategory)
routes.get('/categories/deleteCategory/:id', adminAuth, adminRoutes.deleteCategory)
routes.get('/products', adminAuth, adminRoutes.showProducts)
routes.get('/products/addProductForm', adminAuth, adminRoutes.addProductForm)
routes.post('/products/addProduct', adminAuth, upload.array('productImages'), adminRoutes.addProduct)
routes.get('/products/editProductForm/:id', adminAuth, adminRoutes.editProductForm)
routes.post('/products/editProduct/:id', adminAuth, upload.array('productImages'), adminRoutes.editProduct)
routes.get('/products/deleteProduct/:id', adminAuth, adminRoutes.deleteProduct)
routes.get('/offers', adminAuth, adminRoutes.loadOfferPage)
routes.get('/offers/addOffer', adminAuth, adminRoutes.loadAddOfferPage)
routes.post('/offers/addOffer', adminAuth, adminRoutes.addOffer)
routes.get('/offers/editOffer/:id', adminAuth, adminRoutes.loadOfferEditPage)
routes.post('/offers/editOffer/:id', adminAuth, adminRoutes.editOffer)
routes.get('/offers/deleteOffer/:id', adminAuth, adminRoutes.deleteOffer)
routes.post('/logout', adminRoutes.adminLogout)

module.exports=routes;