const allow=(req,res,next)=>{
    if(req.session.userEmail){
        next()
    }else{
        res.redirect('/user/login')
    }
}

module.exports=allow