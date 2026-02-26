const mongoose=require('mongoose')
mongoose.set('strictPopulate', false)

const admins=require('../models/adminSchema')
const users=require('../models/userSchema')
const orders=require('../models/orderSchema')
const exceljs=require('exceljs')
const PDFDocument=require('pdfkit')
const fs=require('fs')

const STATUS_SERVER_ERROR=parseInt(process.env.STATUS_SERVER_ERROR)

const loadAdminPage = async (req,res)=>{
    try {
        res.render('login', ({messageInvalid:req.flash('invalidAdmin'), messageWrong:req.flash('invalidPassword')}))
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('admin404')
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
        res.status(STATUS_SERVER_ERROR).render('admin404')
    }
}

const showDashboard = async (req,res)=>{
    try {
        const allUsers=await users.find()
        const totalSales=await orders.aggregate([
            {
                $match:{
                    status:'Delivered'
                }
            },
            {
                $group:{
                    _id:null,
                    totalAmount:{
                        $sum:'$totalAmount'
                    },
                    totalOrders:{
                        $sum:1
                    },
                    totalDiscount:{
                        $sum:'$offerDiscount'
                    },
                    couponDiscount:{
                        $sum:'$couponDiscount'
                    }
                }
            }
        ])
        const pendingOrders=await orders.aggregate([
            {
                $match:{
                    status:{
                        $nin:['Delivered', 'Cancelled']
                    }
                }
            }
        ])
        const topProducts=await orders.aggregate([
            {
                $match:{
                    status:'Delivered'
                }
            },
            {
                $unwind:'$products'
            },
            {
                $lookup:{
                    from:'products',
                    localField:'products.productId',
                    foreignField:'_id',
                    as:'resultProducts'
                }
            },
            {
                $unwind:'$resultProducts'
            },
            {
                $group:{
                    _id:'$resultProducts.productName',
                    soldQuantity:{
                        $sum:'$products.quantity'
                    },
                    soldAmount:{
                        $sum:{
                            $multiply:['$products.productAmount', '$products.quantity']
                        }
                    }
                }
            },
            {
                $sort:{
                    soldAmount:-1
                }
            },
            {
                $limit:10
            }
        ])
        const topCategories=await orders.aggregate([
            {
                $match:{
                    status:'Delivered'
                }
            },
            {
                $unwind:'$products'
            },
            {
                $lookup:{
                    from:'products',
                    localField:'products.productId',
                    foreignField:'_id',
                    as:'resultProducts'
                }
            },
            {
                $unwind:'$resultProducts'
            },
            {
                $lookup:{
                    from:'categories',
                    localField:'resultProducts.category',
                    foreignField:'_id',
                    as:'resultCategories'
                }
            },
            {
                $unwind:'$resultCategories'
            },
            {
                $group:{
                    _id:'$resultCategories.name',
                    soldQuantity:{
                        $sum:'$products.quantity'
                    },
                    soldAmount:{
                        $sum:{
                            $multiply:['$products.productAmount', '$products.quantity']
                        }
                    }
                }
            },
            {
                $sort:{
                    soldAmount:-1
                }
            },
            {
                $limit:10
            }
        ])
        res.render('dashboard', {
            users:allUsers,
            totalSales:totalSales,
            pendingOrders:pendingOrders,
            topProducts:topProducts,
            topCategories:topCategories
        })
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('admin404')
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
        res.status(STATUS_SERVER_ERROR).render('admin404')
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
        res.status(STATUS_SERVER_ERROR).render('admin404')
    }
}

const adminLogout = async (req,res)=>{
    try {
        req.session.destroy(()=>{
            res.redirect('/admin');
        })
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('admin404')
    }
}

const getSalesReport = async (req,res)=>{
    try {
        const last7Days=new Date()
        last7Days.setDate(last7Days.getDate()-6)
        if(Object.keys(req.query).length>0){
            const startDate=new Date(req.query.startDate)
            
            const endDate=new Date(req.query.endDate)
            endDate.setHours(23,59,59,999)

            const topOrders=await orders.aggregate([
                {
                    $match:{
                        createdAt:{
                            $gte:startDate,
                            $lte:endDate
                        },
                        status:'Delivered'
                    }
                },
                {
                    $lookup:{
                        from:'users',
                        localField:'user',
                        foreignField:'_id',
                        as:'userDetails'
                    }
                },
                {
                    $unwind:'$userDetails'
                },
                {
                    $sort:{
                        totalAmount:-1
                    }
                },
                {
                    $limit:10
                }
            ])

            const saleQuantity=await orders.aggregate([
                {
                    $match:{
                        createdAt:{
                            $gte:startDate,
                            $lte:endDate
                        },
                        status:'Delivered'
                    }
                },
                {
                    $group:{
                        _id:null,
                        totalAmount:{
                            $sum:'$totalAmount'
                        },
                        totalOrders:{
                            $sum:1
                        },
                        totalDiscount:{
                            $sum:"$offerDiscount"
                        },
                        couponDiscount:{
                            $sum:"$couponDiscount"
                        },
                        totalGST:{
                            $sum:"$GST"
                        }
                    }
                },
                {
                    $project:{
                        _id: 0,
                        totalAmount: { $round: ["$totalAmount", 2] },
                        totalOrders: 1,
                        totalDiscount: { $round: ["$totalDiscount", 2] },
                        couponDiscount: { $round: ["$couponDiscount", 2] },
                        totalGST: { $round: ["$totalGST", 2] },
                        netRevenue: {
                            $round: [{
                                $subtract: [
                                    "$totalAmount","$totalGST"
                                ]
                            }, 2]
                        }
                    }
                }
            ])
            
            const salesData=await orders.aggregate([
                {
                    $match:{
                        createdAt:{
                            $gte:startDate,
                            $lte:endDate
                        },
                        status:'Delivered'
                    }
                },
                {
                    $group:{
                        _id:{
                            $dateToString:{
                                format:"%Y-%m-%d", date:"$createdAt"
                            }
                        },
                        totalSales:{
                            $sum:"$totalAmount"
                        }
                    }
                },
                {
                    $sort:{
                        _id:1
                    }
                }
                
            ])
            return res.json({salesData:salesData, saleQuantity:saleQuantity, topOrders:topOrders, dateRange:{startDate, endDate}})
        }
        
        const saleQuantity=await orders.aggregate([
            {
                $match:{
                    createdAt:{
                        $gte:last7Days
                    },
                    status:'Delivered'
                }
            },
            {
                $group:{
                    _id:null,
                    totalAmount:{
                        $sum:'$totalAmount'
                    },
                    totalOrders:{
                        $sum:1
                    },
                    totalDiscount:{
                        $sum:"$offerDiscount"
                    },
                    couponDiscount:{
                        $sum:"$couponDiscount"
                    },
                    totalGST:{
                        $sum:"$GST"
                    }
                }
            },
            {
                $project:{
                    _id: 0,
                    totalAmount: { $round: ["$totalAmount", 2] },
                    totalOrders: 1,
                    totalDiscount: { $round: ["$totalDiscount", 2] },
                    couponDiscount: { $round: ["$couponDiscount", 2] },
                    totalGST: { $round: ["$totalGST", 2] },
                    netRevenue: {
                        $round: [{
                            $subtract: [
                                "$totalAmount",
                                "$totalGST"
                            ]
                        }, 2]
                    }
                }
            }
        ])

        const topOrders=await orders.aggregate([
            {
                $match:{
                    createdAt:{
                        $gte:last7Days
                    },
                    status:'Delivered'
                }
            },
            {
                $lookup:{
                    from:'users',
                    localField:'user',
                    foreignField:'_id',
                    as:'userDetails'
                }
            },
            {
                $unwind:'$userDetails'
            },
            {
                $sort:{
                    totalAmount:-1
                }
            },
            {
                $limit:10
            }
        ])

        const salesData=await orders.aggregate([
            {
                $match:{
                    createdAt:{
                        $gte:last7Days
                    },
                    status:'Delivered'
                }
            },
            {
                $group:{
                    _id:{
                        $dateToString:{
                            format:"%Y-%m-%d", date:"$createdAt"
                        }
                    },
                    totalSales:{
                        $sum:"$totalAmount"
                    }
                }
            },
            {
                $sort:{
                    _id:1
                }
            }
            
        ])
        res.json({salesData:salesData, saleQuantity:saleQuantity, topOrders:topOrders, dateRange:{startDate:last7Days, endDate:new Date()}})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('admin404')
        console.log(error.message);
    }
}

const downloadSalesReport = async (req,res)=>{
    try {        
        const saleQuantity=JSON.parse(req.query.saleQuantity)
        const topOrders=JSON.parse(req.query.topOrders)
        const dateRange=JSON.parse(req.query.dateRange)

        const doc = new PDFDocument();

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", 'attachment; filename="DeJavu_Sales_Report.pdf"');

        doc.pipe(res);
        doc.fontSize(22).fillColor('#333').text('DeJavu Sales Report', { align: 'center', underline: true });
        doc.moveDown(0.5);

        // Date Range
        const startDate = new Date(dateRange.startDate).toLocaleDateString()
        const endDate = new Date(dateRange.endDate).toLocaleDateString()
        doc.fontSize(10).fillColor('#666').text(`Report Period: ${startDate} to ${endDate}`, { align: 'center' });
        doc.moveDown(1.5);

        // Summary Section
        if (saleQuantity.length > 0) {
            doc.fontSize(12).fillColor("#000").font('Helvetica-Bold').text('SUMMARY');
            doc.fontSize(9).font('Helvetica');
            doc.moveDown(0.3);
            
            const summaryData = [
                ['Total Orders', saleQuantity[0].totalOrders],
                ['Gross Sales', `₹${saleQuantity[0].totalAmount}`],
                ['Offer Discount', `₹${saleQuantity[0].totalDiscount}`],
                ['Coupon Discount', `₹${saleQuantity[0].couponDiscount}`],
                ['Tax (GST 5%)', `₹${saleQuantity[0].totalGST}`],
                ['Net Revenue', `₹${saleQuantity[0].netRevenue}`]
            ];
            
            summaryData.forEach(([label, value]) => {
                const y = doc.y;
                doc.text(`${label}: ${value}`, 50, y);
                doc.moveDown(0.35);
            });
            doc.moveDown(1);
        } else {
            doc.fontSize(12).fillColor("#222").text("No Sales Data Available", { align: "center" });
            doc.moveDown(2);
        }

        // Orders Table Header
        const headerY = doc.y;
        doc.rect(40, headerY, 520, 22).fill('#0072C6');
        doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold');
        doc.text('Order ID', 45, headerY + 6, { width: 90, align: 'left' });
        doc.text('Customer', 140, headerY + 6, { width: 80, align: 'left' });
        doc.text('Email', 225, headerY + 6, { width: 90, align: 'left' });
        doc.text('Payment', 320, headerY + 6, { width: 70, align: 'center' });
        doc.text('Amount', 395, headerY + 6, { width: 60, align: 'right' });
        doc.text('GST', 460, headerY + 6, { width: 40, align: 'right' });
        doc.text('Net', 505, headerY + 6, { width: 50, align: 'right' });

        doc.strokeColor('#000000').lineWidth(0.5).moveTo(40, headerY + 22).lineTo(560, headerY + 22).stroke();
        doc.moveDown(1.2);

        // Orders Data
        if (topOrders.length > 0) {
            topOrders.forEach((order, index) => {
                const rowY = doc.y;
                const bgColor = index % 2 === 0 ? '#f5f5f5' : '#ffffff';
                doc.rect(40, rowY, 520, 18).fill(bgColor);
                
                doc.fillColor('#000000').fontSize(8).font('Helvetica');
                const orderId = order._id.toString().substring(0, 12);
                doc.text(orderId, 45, rowY + 4, { width: 90, align: 'left' });
                
                const customerName = order.userDetails?.name || 'N/A';
                doc.text(customerName.substring(0, 15), 140, rowY + 4, { width: 80, align: 'left' });
                
                const email = order.userDetails?.email || 'N/A';
                doc.text(email.substring(0, 18), 225, rowY + 4, { width: 90, align: 'left' });
                
                const paymentMethod = order.paymentmethod || 'N/A';
                doc.text(paymentMethod.substring(0, 10), 320, rowY + 4, { width: 70, align: 'center' });
                
                doc.text(`₹${order.totalAmount}`, 395, rowY + 4, { width: 60, align: 'right' });
                doc.text(`₹${order.GST || 0}`, 460, rowY + 4, { width: 40, align: 'right' });
                
                const netAmount = (order.totalAmount - (order.GST || 0)).toFixed(2);
                doc.text(`₹${netAmount}`, 505, rowY + 4, { width: 50, align: 'right' });

                doc.strokeColor('#CCCCCC').lineWidth(0.5).moveTo(40, rowY + 18).lineTo(560, rowY + 18).stroke();
                doc.moveDown(1.1);
            });
        } else {
            doc.text("No Orders Available", { align: "center" });
            doc.moveDown(2);
        }

        doc.moveDown(1);
        doc.fontSize(8).fillColor('#008000').text('Generated by DeJavu Sales System', { align: 'center' });

        doc.end();
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('admin404')
    }
}

const downloadSalesExcelReport = async (req,res)=>{
    try {
        const saleQuantity=JSON.parse(req.query.saleQuantity)
        const topOrders=JSON.parse(req.query.topOrders)

        const workbook=new exceljs.Workbook()
        const sheet=workbook.addWorksheet('Sales Report')

        let rowNumber=1

        if(saleQuantity.length>0){
            sheet.addRow([])
            sheet.addRow(['Date', new Date().toLocaleDateString()])
            sheet.addRow(["Total Orders", saleQuantity[0].totalOrders]);
            sheet.addRow(["Total Sales", `₹${saleQuantity[0].totalAmount}`]);
            sheet.addRow(["Total Discount", `₹${saleQuantity[0].totalDiscount}`]);
            sheet.addRow(["Coupon Discount", `₹${saleQuantity[0].couponDiscount}`]);
            sheet.addRow([]); 
            rowNumber+=7
        }

        sheet.addRow(["Order ID", "Date", "Order Amount", "Discount", "Coupon"]);
        const headerRow = sheet.getRow(rowNumber);
        headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
        headerRow.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "0072C6" }
        };
        headerRow.alignment = { horizontal: "center" };

        rowNumber += 1;

        topOrders.forEach((order,index)=>{
            sheet.addRow([
                `#${order._id}`,
                new Date(order.createdAt).toLocaleDateString(),
                `₹${order.totalAmount}`,
                `₹${order.offerDiscount ?? 0}`,
                `₹${order.couponDiscount ?? 0}`
            ])
            const row = sheet.getRow(rowNumber);
            if (index % 2 === 0) {
                row.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "F2F2F2" }
                };
            }
            rowNumber += 1;
        })

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", 'attachment; filename="DeJavu_Sales_Report.xlsx"');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('admin404')
    }
}

module.exports={
    loadAdminPage,    
    adminAuthenticate,
    showDashboard,
    showUserManagement,
    manageUser,
    adminLogout,
    getSalesReport,
    downloadSalesReport,
    downloadSalesExcelReport
}