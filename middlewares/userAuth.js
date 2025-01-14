const userAuth = (req,res,next)=>{
    if(req.session.authenticate){
        next()
    }else{
        res.redirect('/user/login')
    }
}

module.exports=userAuth