import mongoose from "mongoose"
import {Video} from "../models/video.model.js"
import {Subscription} from "../models/subscription.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getChannelStats = asyncHandler(async (req, res) => {
    // TODO: Get the channel stats like total video views, total subscribers, total videos, total likes etc.
    const channelStats = await User.aggregate(
        [
            {
                $match: {
                    _id : new mongoose.Types.ObjectId(req.user?._id)
                }
            },
            {
                $lookup: {
                    from: "videos",
                    localField: "_id",
                    foreignField: "owner",
                    as: "video",
                    pipeline: [
                        {
                            $lookup: {
                                from: "likes",
                                localField: "_id",
                                foreignField: "video",
                                as: "likes"
                            }
                        },
                        {
                            $addFields: {
                                likesCount: {
                                    $size: "$likes"
                                }
                            }
                        }
                    ]
                }
            },
            {
                $lookup: {
                    from: "subscriptions",
                    localField: "_id",
                    foreignField: "channel",
                    as: "subscribers"
                }
            },
            {
                $addFields: {
                    totalVideos: {
                        $size: "$video"
                    },

                    totalLikes: {
                        $sum: "$video.likesCount"
                    },

                    totalSubscribers: {
                        $size: "$subscribers"
                    },

                    totalViews: {
                        $sum: "$video.views"
                    }
                }
            },
            {
                $project: {
                    totalVideos: 1,
                    totalSubscribers: 1,
                    totalLikes: 1,
                    totalViews: 1
                }
            }
        ]
    )

    if (!channelStats) {
        throw new ApiError(400,"channel not found");
    }

    return res
    .status(200)
    .json(new ApiResponse(200, channelStats[0], "channel stats fetched successfully"))
})

const getChannelVideos = asyncHandler(async (req, res) => {
    // TODO: Get all the videos uploaded by the channel
    const channelVideos = await Video.aggregate(
        [
            {
                //all videos
                $match: {
                    owner: new mongoose.Types.ObjectId(req.user?._id)
                }
            },
            {
                $lookup: {
                    from: "likes",
                    localField: "_id",
                    foreignField: "video",
                    as: "likes"
                }
            },
            {
                $addFields: {
                    totalLikes: {
                        $size: "$likes"
                    },

                    createdAt: {
                        $dateToParts: {
                            date: "$createdAt"
                        }
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
                    _id: 1,
                    "videoFile.url": 1,
                    "thumbnail.url": 1,
                    title: 1,
                    description: 1,
                    duration: 1,
                    views: 1,
                    isPublished: 1,
                    createdAt: {
                        day: 1,
                        month: 1,
                        year: 1
                    }
                }
            }
        ]
    )

    if (!channelVideos) {
        throw new ApiError(400,"channel videos not found");
    }

    return res
    .status(200)
    .json(new ApiResponse(200, channelVideos, "Channel all videos fetched successfully"))
})

export {
    getChannelStats, 
    getChannelVideos
    }