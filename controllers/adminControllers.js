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
        console.log('At admin login page');
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('admin404')
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
        res.status(STATUS_SERVER_ERROR).render('admin404')
        console.log(error.message);
    }
}

const showDashboard = async (req,res)=>{
    try {
        const allUsers=await users.find()
        const totalSales=await orders.aggregate([
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
        console.log(topCategories)
        res.render('dashboard', {
            users:allUsers,
            totalSales:totalSales,
            pendingOrders:pendingOrders,
            topProducts:topProducts,
            topCategories:topCategories
        })
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('admin404')
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
        res.status(STATUS_SERVER_ERROR).render('admin404')
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
        res.status(STATUS_SERVER_ERROR).render('admin404')
        console.log(error.message);
    }
}

const adminLogout = async (req,res)=>{
    try {
        req.session.destroy(()=>{
            res.redirect('/admin');
        })
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('admin404')
        console.log(error.message);
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
                        }
                    }
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
                        }
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
                        }
                    }
                },
                {
                    $project:{
                        _id: 0,
                        totalAmount: { $round: ["$totalAmount", 2] },
                        totalOrders: 1,
                        totalDiscount: { $round: ["$totalDiscount", 2] },
                        couponDiscount: { $round: ["$couponDiscount", 2] }
                    }
                }
            ])
            
            const salesData=await orders.aggregate([
                {
                    $match:{
                        createdAt:{
                            $gte:startDate,
                            $lte:endDate
                        }
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
            return res.json({salesData:salesData, saleQuantity:saleQuantity, topOrders:topOrders})
        }
        
        const saleQuantity=await orders.aggregate([
            {
                $match:{
                    createdAt:{
                        $gte:last7Days
                    }
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
                    }
                }
            },
            {
                $project:{
                    _id: 0,
                    totalAmount: { $round: ["$totalAmount", 2] },
                    totalOrders: 1,
                    totalDiscount: { $round: ["$totalDiscount", 2] },
                    couponDiscount: { $round: ["$couponDiscount", 2] }
                }
            }
        ])

        const topOrders=await orders.aggregate([
            {
                $match:{
                    createdAt:{
                        $gte:last7Days
                    }
                }
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
                    }
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
        res.json({salesData:salesData, saleQuantity:saleQuantity, topOrders:topOrders})
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('admin404')
        console.log(error.message);
    }
}

const downloadSalesReport = async (req,res)=>{
    try {        
        const saleQuantity=JSON.parse(req.query.saleQuantity)
        const topOrders=JSON.parse(req.query.topOrders)        

        const doc = new PDFDocument();

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", 'attachment; filename="DeJavu_Sales_Report.pdf"');

        doc.pipe(res);
        doc.fontSize(22).fillColor('#333').text('DeJavu Sales Reoprt', { align: 'center', underline: true });
        doc.moveDown(1);

        if (saleQuantity.length > 0) {
            doc.fontSize(14).fillColor("#222");
            doc.text(`Date: ${new Date().toLocaleDateString()}`);
            doc.moveDown(0.5);
            doc.text(`Total Orders: ${saleQuantity[0].totalOrders}`);
            doc.moveDown(0.5);
            doc.text(`Total Sales: ${saleQuantity[0].totalAmount}`);
            doc.moveDown(0.5);
            doc.text(`Total Discount: ${saleQuantity[0].totalDiscount}`);
            doc.moveDown(0.5);
            doc.text(`Coupon Discount: ${saleQuantity[0].couponDiscount}`);
            doc.moveDown(2);
        } else {
            doc.fontSize(14).fillColor("#222").text("No Sales Data Available", { align: "center" });
            doc.moveDown(2);
        }

        const headerY = doc.y; 
        doc.rect(50, headerY, 500, 25).fill('#5CBDFE'); 
        doc.fillColor('#000').fontSize(12).text('Order ID', 55, headerY + 5, { width: 100, align: 'left' });
        doc.text('Date', 160, headerY + 5, { width: 100, align: 'left' });
        doc.text('Order Amount', 260, headerY + 5, { width: 100, align: 'left' });
        doc.text('Discount', 360, headerY + 5, { width: 100, align: 'left' });
        doc.text('Coupon', 460, headerY + 5, { width: 100, align: 'left' });

        doc.strokeColor('#0000FF').lineWidth(1).moveTo(50, headerY + 25).lineTo(550, headerY + 25).stroke();
        doc.moveDown(1);

        if (topOrders.length > 0) {
            topOrders.forEach((order, index) => {
                const rowY = doc.y;
                const bgColor = index % 2 === 0 ? '#f9f9f9' : '#ffffff';
                doc.rect(50, rowY, 500, 20).fill(bgColor);  
                doc.fillColor('#000');
                doc.text(`#${order._id.substring(0, 10)}...`, 55, rowY + 5, { width: 100, align: 'left' });
                doc.text(new Date(order.createdAt).toLocaleDateString(), 160, rowY + 5, { width: 100, align: 'left' });
                doc.text(`${order.totalAmount}`, 260, rowY + 5, { width: 100, align: 'left' });
                doc.text(`${order.offerDiscount ?? 0}`, 360, rowY + 5, { width: 100, align: 'left' });
                doc.text(`${order.couponDiscount ?? 0}`, 460, rowY + 5, { width: 100, align: 'left' });

                doc.moveDown(1); 
            });
        } else {
            doc.text("No Orders Available", { align: "center" });
            doc.moveDown(2);
        }

        doc.moveDown(2);
        doc.fontSize(10).fillColor('#008000').text('Generated by DeJavu Sales System', { align: 'center' });

        doc.end();
    } catch (error) {
        res.status(STATUS_SERVER_ERROR).render('admin404')
        console.log(error.message);
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
        console.log(error.message);
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