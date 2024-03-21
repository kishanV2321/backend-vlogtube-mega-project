// require('dotenv').config({path: './env'})
import dotenv from "dotenv";
import connectDB from './db/index.js';  //error -> ./db = ./db/index.js

dotenv.config(
    {
        path: "./env"
    }
)

connectDB()