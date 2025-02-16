const allow=(req,res,next)=>{
    if(req.session.userEmail){
        next()
    }else{
        res.redirect('/login')
    }
}

module.exports=allow