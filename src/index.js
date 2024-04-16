// require('dotenv').config({path: './env'})
import dotenv from "dotenv";
import connectDB from './db/index.js';  //error -> ./db = ./db/index.js
import app from "./app.js";

dotenv.config(
    {
        path: "./.env"
    }
)

connectDB()
.then( () => {

    //event error
    // app.on("error", (error) => {
    //     console.log("Error : ", error);
    //     throw error
    // })

    app.listen(process.env.PORT || 8000, () => {
        console.log(`Server is running at  : ${process.env.PORT}`)
    })
})
.catch( (error) => {
    console.log("MONGODB connection failed !!! ", error);
})