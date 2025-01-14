const allowAuth = (req,res,next)=>{
    if(!req.session.isLogged){
        next()
    }else{
        res.redirect('/user')
    }
}

module.exports=allowAuth