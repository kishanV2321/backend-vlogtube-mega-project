import mongoose, { isValidObjectId } from "mongoose"
import {Tweet} from "../models/tweet.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const createTweet = asyncHandler(async (req, res) => {
    const { content } = req.body

    console.log(content);

    if(!content){
        throw new ApiError(400, "content is required")
    }

    const tweet = await Tweet.create(
        {
            content: content,
            owner: req.user?._id
        }
    )

    if(!tweet){
        throw new ApiError(500, "failed to create tweet")
    }

    return res
    .status(200)
    .json(new ApiResponse(200, tweet, "tweet created successfully"))
})

const updateTweet = asyncHandler(async (req, res) => {
    const { content } = req.body
    const { tweetId } = req.params

    if(!content){
        throw new ApiError(400, "content is required")
    }

    if(!isValidObjectId(tweetId)){
        throw new ApiError(400, "Invalid tweetId")
    }

    const tweet = await Tweet.findById(tweetId)

    if(!tweet){
        throw new ApiError(404, "Tweet not found");
    }

    if(req.user?._id.toString() !== tweet.owner.toString()){
        throw new ApiError(404, "You can't edit this tweet as you are not the owner")
    }

    const newTweet = await Tweet.findByIdAndUpdate(
        tweetId,
        {
            $set: {
                content: content
            }
        },
        {
            new: true
        }
    )

    if(!newTweet){
        throw new ApiError(500, "failed to update tweet")
    }

    return res
    .status(200)
    .json(new ApiResponse(200, newTweet, "tweet updated successfully"))
})

const deleteTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params

    if(!isValidObjectId(tweetId)){
        throw new ApiError(400, "Invalid tweetId")
    }

    const tweet = await Tweet.findById(tweetId)

    if(!tweet){
        throw new ApiError(404, "Tweet not found");
    }

    if(req.user?._id.toString() !== tweet.owner.toString()){
        throw new ApiError(404, "only owner can delete thier tweet")
    }

    const deleteTweet = await Tweet.findByIdAndDelete(tweetId)

    if(!deleteTweet){
        throw new ApiError(500, "failed to delete tweet please try again")
    }

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "deleted tweet sucessfully"))
})

const getUserTweets = asyncHandler(async (req, res) => {
    const { userId } = req.params
    
    if(!isValidObjectId(userId)){
        throw new ApiError(400, "Invalid userId")
    }

    const tweets = await Tweet.aggregate(
        [
            {
                $match: {
                    owner: new mongoose.Types.ObjectId(userId)}
            },
            {
                $lookup: {
                    from: "users",
                    localField: "owner",
                    foreignField: "_id",
                    as: "ownerDetails",
                    pipeline: [
                        {
                            $project: {
                                username: 1,
                                "avatar.url": 1
                            }
                        }
                    ]
                }
            },
            {
                $lookup: {
                    from: "likes",
                    localField: "_id",
                    foreignField: "tweet",
                    as: "likes"
                }
            },
            {
                $addFields: {
                    //total no. of likes
                    likesCount: {
                        $size: "$likes"
                    },

                    //user like tweet or not
                    isLiked: {
                        $cond: {
                            if: {
                                $in: [req.user?._id, "$likes.likeBy"]
                            },
                            then: true,
                            else: false
                        }
                    },

                    owner: {
                        $first: "$ownerDetails"
                    }
                }
            },
            {
                $sort: {
                    createdAt: -1
                }
            },
            {
                $project: {
                    content: 1,
                    owner: 1,
                    likesCount: 1,
                    isLiked: 1,
                    createdAt: 1
                }
            }
        ]
    )

    return res
    .status(200)
    .json(new ApiResponse(200, tweets, "Tweets fetched successfully"))

})

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}