import dotenv from 'dotenv'
import connectDB from "./db/index.js";
import express from 'express'
const app = express()
dotenv.config()

connectDB()
.then(() =>{
    app.listen(process.env.PORT || 8000, () => {
        console.log(`db started at port ${process.env.PORT}`)
    })
})
.catch((error) => {
    console.log("mongo connsection failed ",error)
})





/*
//using IIFE
import express from 'express';
const app = express()
;(async () => {
    try{
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("error", (error)=> {
            console.log("ERRR: ", error)
        })

        app.listen(process.env.PORT,() =>{
            console.log(`listening on the port ${process.env.PORT}`)
        })
    } catch(error) {
        console.error("Error:", error)
        throw err
    }
})() */