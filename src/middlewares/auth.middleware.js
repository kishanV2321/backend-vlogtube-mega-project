import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import jwt from "jsonwebtoken"

export const jwtVerify = asyncHandler( async (req, _, next) => {
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer", "")  
        //Authorization: Bearer <token>
    
        if(!token){
            throw new ApiError(401, "Unathorized request")
        }
    
        //encrypt into json or readable
        const decodeToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
    
        const user = await User.findById(decodeToken?._id).select(" -password -refresToken")
    
        if(!user){
            throw new ApiError(401, "Invalid Access Token")
        }
    
        req.user = user
        next()

    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid acces token")
    }
})