const fetchAllow=(req,res,next)=>{
    if(req.session.userEmail){
        next()
    }else{
        res.json({needLogin:true})
    }
}

module.exports=fetchAllow