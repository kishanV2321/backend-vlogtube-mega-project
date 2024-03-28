import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

//app.use -> used for confiquration and middlewares 
app.use(cors( {
    origin: process.env.CORS_ORIGIN,
    credentials: true
}
))

app.use(express({limit: "16kb"}))
app.use(express.urlencoded({extended: true, limit: "16kb"}))
app.use(express.static("public"))
app.use(cookieParser())
export default app;