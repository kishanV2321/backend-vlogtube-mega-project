import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary, deleteOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = await user.generateAccesToken();
        const refreshToken = await user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(
            500,
            "Somenting went wrong while generation refresh and access token",
        );
    }
};

const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend
    const { fullname, email, username, password } = req.body;
    //console.log("req.body: ", req.body);

    // validation - not empty
    if (
        [fullname, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required");
    }

    // check if user already exists: username, email
    const existedUser = await User.findOne({
        $or: [{ username }, { email }],
    });

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists");
    }

    // check for images, check for avatar
    const avatarLocalPath = req.files?.avatar[0]?.path;
    //const coverImageLocalPath = req.files?.coverImage[0]?.path; -> show error

    //bug resolve
    let coverImageLocalPath;
    if (
        req.files &&
        Array.isArray(req.files.coverImage) &&
        req.files.coverImage.length > 0
    ) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    //console.log("req.files: ", req.files);

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }

    // upload them to clodinary, avatar
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required");
    }

    // create user object - create entry in db
    const user = await User.create({
        fullname,
        avatar: {
            public_id: avatar.public_id,
            url: avatar.url,
        },
        coverImage: {
            public_id: coverImage?.public_id || "",
            url: coverImage?.url || "",
        },
        email,
        username: username.toLowerCase(),
        password,
    });

    // remove password and refresh token field from response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken",
    );

    // check for user creation
    if (!createdUser) {
        throw new ApiError(500, "Something went wromg while registering the user");
    }
    // return response
    return res
        .status(201)
        .json(new ApiResponse(201, createdUser, "User registered succesfully"));
});

const loginUser = asyncHandler(async (req, res) => {
    // req.body -> data
    const { email, username, password } = req.body;
    //console.log(req.body)

    // check username or email -> validation - not empty
    // if(!(username || email)){
    //     throw new ApiError(400, "username or email is required")
    // }

    if (!username && !email) {
        throw new ApiError(400, "username or email is required");
    }

    // find the user
    const user = await User.findOne({
        $or: [{ username }, { email }],
    });

    if (!user) {
        throw new ApiError(404, "User does not exist");
    }

    // password check
    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(401, "Inavalid user credentials");
    }

    // access and refresh token
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
        user._id,
    );

    // send cookie
    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken",
    );

    const options = {
        httpOnly: true,
        secure: true,
    };

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                201,
                {
                    user: loggedInUser,
                    refreshToken,
                    accessToken,
                },
                "User Logged In Succesfully",
            ),
        );
});

const logoutUser = asyncHandler(async (req, res) => {
    //find user by middleware
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined, //remove fields from document
            },
            /* or
                  $unset: {
                      refreshToken: 1
                  }
                  */
        },
        {
            new: true,
        },
    );

    // remove cookies
    // remove refreshToken from Database

    const options = {
        httpOnly: true,
        secure: true,
    };

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User logged Out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken =
        req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauhtorized request");
    }

    //token ko encrypted se raw form mai kiya hai
    const decodedToken = jwt.verify(
        incomingRefreshToken,
        process.env.REFRESH_TOKEN_SECRET,
    );

    //user ko find kr rhe hai
    const user = await User.findById(decodedToken?._id);

    if (!user) {
        throw new ApiError(401, "Invalid refresh token");
    }

    //jo token mile hai woh expire toh nhi hogya isliye db ke refreshToken se check kregye
    if (incomingRefreshToken !== user?.refreshToken) {
        throw new ApiError(401, "Refresh token is expired or used");
    }

    //ab use accessToken dege sab check kr liya hmne
    const { accessToken, newRefreshToken } = generateAccessAndRefreshToken(
        user._id,
    );

    const options = {
        httpOnly: true,
        secure: true,
    };

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                201,
                { accessToken, refreshToken: newRefreshToken },
                "Access token refreshed",
            ),
        );
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword, confPassword } = req.body;

    if (!(newPassword === confPassword)) {
        throw new ApiError(
            404,
            "Your new password and confirm password are not same",
        );
    }

    const user = await User.findById(req.user._id);

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old password");
    }

    user.password = password;
    await user.save({ validateBeforeSave: flase });

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password successfully updated"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new ApiResponse(200, req.user, "current user fetched succesfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullname, email } = req.body;

    if (!(fullname || email)) {
        throw new ApiError(400, "All field are required");
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                fullname,
                email,
            },
        },
        {
            new: true,
        },
    ).select("-password");

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Account details update succesfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath); //avatar -> object

    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading");
    }

    // delete file on clodinary using public_id
    const oldUser = await User.findById(req.user?._id).select("avatar");
    const publicID = oldUser.avatar.public_id;

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: {
                    public_id: avatar.public_id,
                    url: avatar.url,
                }, //avatar has many filed in object so we select avatar.url
            },
        },
        { new: true },
    ).select("-password");

    // Todo: delete old coverImage
    if (publicID && user.avatar.public_id) {
        await deleteOnCloudinary(publicID);
    }

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Avatar updated succesfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path;

    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover Image file is missing");
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath); //avatar -> object

    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading");
    }

    // delete file on clodinary using public_id
    const oldUser = await User.findById(req.user?._id).select("coverImage");
    const publicID = oldUser.coverImage.public_id;

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: {
                    public_id: coverImage.public_id,
                    url: coverImage.url,
                }, //avatar has many filed in object so we select avatar.url
            },
        },
        { new: true },
    ).select("-password");

    // Todo: delete old coverImage
    if (publicID && user.coverImage.public_id) {
        await deleteOnCloudinary(publicID);
    }

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Cover Image update succesfully"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
    //link jo hmm bhejegye usme user ka username hoga
    const { username } = req.params;

    if (!username?.trim()) {
        throw new ApiError(400, "username is missing");
    }

    //aggregation pipeling -> User,aggregate([ {}, {}, {} ])
    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase(),
            },
        },
        {
            //total no. of documents jha dusre user ne mare channel ko subcribe kiya hai toh unke channel mai unke subscribtion mai mera channel ki id(user) hoga
            $lookup: {
                form: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers",
            },
        },
        {
            //total no. of document jha maine jo channel subscribe kiye hai meri user id unke pass gyi hogi as a subsriber
            $lookup: {
                form: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo",
            },
        },
        {
            $addFields: {
                //calculate total no. of subscriber
                subscribersCount: {
                    $size: "$subscribers", //working as a field if we use `$`
                },
                //calculate total no. of channel which we subcribed
                channelsSubscribedToCount: {
                    $size: "$subscribedTo",
                },
                // user subsribed hai ki nhi woh button show krega true or false
                isSubscribed: {
                    // chack for condition
                    $cond: {
                        //$in -> selects the documents where the value of a field equals
                        if: { $in: [req.user?._id, "subscriber"] },
                        then: true,
                        else: false,
                    },
                },
            },
        },
        {
            //jo field hmm bhejna chate hai
            $project: {
                username: 1,
                fullname: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1,
            },
        },
    ]);

    if (!channel?.length) {
        throw new ApiError(404, "channel does not exist");
    }

    console.log(channel);

    return res
        .status(200)
        .json(
            new ApiResponse(200, channel[0], "user channel fetched successfully"),
        );
});

const getWatchHistory = asyncHandler(async (req, res) => {
    
    const user = User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id),
            },
        },
        {
            $lookup: {
                form: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            form: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        username: 1,
                                        fullname: 1,
                                        avatar: 1,
                                    },
                                },
                            ],
                        },
                    },
                ],
            },
        },
        {
            $addFields: {
                owner: {
                    $first: "$owner",
                },
            },
        },
    ]);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                user[0].watchHistory,
                "Watch history fetched successfully",
            ),
        );
});

export {
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
    getWatchHistory,
};
