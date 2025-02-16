const userAuth = (req,res,next)=>{
    if(req.session.authenticate){
        next()
    }else{
        res.redirect('/login')
    }
}

module.exports=userAuth