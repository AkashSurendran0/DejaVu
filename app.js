const express=require('express')
const env=require('dotenv').config()
const adminRoutes=require('./routes/adminRoutes')
const userRoutes=require('./routes/userRoutes')
const db=require('./config/db')
const path=require('path')
const session=require('express-session')
const flash=require('connect-flash')
const nocache = require('nocache')
const passport=require('./config/passport')

const app=express()

app.use(session({
    secret: 'batman',
    resave: true,
    saveUninitialized: true,
    cookie:{
        maxAge: 86400000
    }
}))
app.use((req, res, next) => {
    res.locals.isLogged = req.session?.isLogged || false;
    next();
});
app.use(passport.initialize())
app.use(passport.session())
app.use(express.json())
app.use(nocache())
app.use(flash())
app.use(express.urlencoded({extended:true}))
app.set('view engine','ejs')
app.set('views', [path.join(__dirname,'views/user'),path.join(__dirname,'views/admin')])
app.use(express.static(path.join(__dirname, 'public/admin')));
app.use(express.static(path.join(__dirname, 'public/user')));
app.use(express.static(path.join(__dirname, 'public')));

db()

app.use('/admin', adminRoutes)
app.use('/user', userRoutes)

app.listen(process.env.PORT, ()=>{
    console.log('Server is running');
})