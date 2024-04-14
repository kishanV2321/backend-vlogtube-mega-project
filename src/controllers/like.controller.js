import mongoose, { isValidObjectId } from "mongoose"
import { Like } from "../models/like.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const toggleVideoLike = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId")
    }

    const isLiked = await Like.findOne({
        video: videoId,
        likedBy: req.user?._id
    })

    console.log(isLiked)

    if (isLiked) {
        await Like.findByIdAndDelete(isLiked?._id)

        return res
            .status(200)
            .json(new ApiResponse(200, { isLiked: false }, "not like video"))
    }

    await Like.create(
        {
            video: videoId,
            likedBy: req.user?._id
        }
    )

    return res
        .status(200)
        .json(new ApiResponse(200, { isLiked: true }, "like video"))

})

const toggleCommentLike = asyncHandler(async (req, res) => {
    const { commentId } = req.params

    if (!isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid commentId")
    }

    const isLiked = await Like.findOne({
        comment: commentId,
        likedBy: req.user?._id
    })

    if (isLiked) {
        await Like.findByIdAndDelete(isLiked._id)

        return res
            .status(200)
            .json(new ApiResponse(200, { isLiked: false }, "not like comment"))
    }

    await Like.create(
        {
            comment: commentId,
            likedBy: req.user?._id
        }
    )

    return res
        .status(200)
        .json(new ApiResponse(200, { isLiked: true }, "like comment"))

})

const toggleTweetLike = asyncHandler(async (req, res) => {
    const { tweetId } = req.params

    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweetId")
    }

    const isLiked = await Like.findOne({
        tweet: tweetId,
        likedBy: req.user?._id
    })

    if (isLiked) {
        await Like.findByIdAndDelete(isLiked._id)

        return res
            .status(200)
            .json(new ApiResponse(200, { isLiked: false }, "not like tweet"))
    }

    await Like.create(
        {
            tweet: tweetId,
            likedBy: req.user?._id
        }
    )

    return res
        .status(200)
        .json(new ApiResponse(200, { isLiked: true }, "like tweet"))
}
)

//liked by user
const getLikedVideos = asyncHandler(async (req, res) => {

    const likedVideos = await Like.aggregate(
        [
            {
                $match: {
                    likedBy: new mongoose.Types.ObjectId(req.user?._id)
                }
            },
            {
                $lookup: {
                    from: "videos",
                    localField: "video",
                    foreignField: "_id",
                    as: "likedVideo",
                    pipeline: [
                        {
                            $lookup: {
                                from: "users",
                                localField: "owner",
                                foreignField: "_id",
                                as: "ownerDetails"
                            },
                        },
                        {
                            $unwind: "$ownerDetails"
                        }
                    ]
                }
            },
            {
                $unwind: "$likedVideo"
            },
            {
                $sort: {
                    createdAt: -1
                }
            },
            {
                $project: {
                    _id: 0,
                    //like model left join videos ke model pe jaa ke details
                    likedVideo: {
                        _id: 1,
                        "videoFile.url": 1,
                        "thumbnail.url": 1,
                        owner: 1,
                        title: 1,
                        description: 1,
                        views: 1,
                        duration: 1,
                        createdAt: 1,
                        isPublished: 1,
                        //video model left join user model pe jaa kr details
                        ownerDetails: {
                            username: 1,
                            fullName: 1,
                            "avatar.url": 1,
                        }
                    }
                }
            }
        ]
    )

    return res
    .status(200)
    .json(new ApiResponse(200, likedVideos, "All liked videos fetched successfully"))
})

export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}

/* another method getAllLikedVideos
const likedVideos = await Like.aggregate([
        {
            $match:{
                $and:[
                    {video: { $exists: true }},
                    {likedBy:new mongoose.Types.ObjectId(req.user._id)}
                ]
            }
        },
        {
            $lookup:{
                from:"videos",
                localField:"video",
                foreignField:"_id",
                as:"video",
                pipeline:[
                    {
                        $lookup:{
                            from:"users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline:[
                                {
                                    $project:{
                                        username:1,
                                        fullName:1,
                                        avatar:1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{$first:"$owner"}
                        }
                    }
                ] 
            }
        },
        {
            $addFields:{
                video:{$first:"$video"}
            }
        },
        {
            $project:{
                video:1
            }
        }
    ])
*/