import { Router } from "express";
import { 
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { jwtVerify } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser)

router.route("/login").post(loginUser)


//secure routes
router.route("/logout").post(jwtVerify, logoutUser)
router.route("/refresh-token").post(refreshAccessToken)
router.route("/change-password").post(jwtVerify, changeCurrentPassword)
router.route("/current-user").get(jwtVerify, getCurrentUser)
router.route("/update-account").patch(jwtVerify, updateAccountDetails)

router.route("/avatar").patch(jwtVerify, upload.single("avatar"), updateUserAvatar)
router.route("/cover-image").patch(jwtVerify, upload.single("coverImage"), updateUserCoverImage)

router.route("/channel/:username").get(jwtVerify, getUserChannelProfile)
router.route("/watch-history").get(jwtVerify, getWatchHistory)

export default router;