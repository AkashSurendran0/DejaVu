const adminAuth = (req,res,next)=>{
    if(req.session.adminLogged){
        next()
    }else{
        res.redirect('/admin')
    }
}

module.exports=adminAuth