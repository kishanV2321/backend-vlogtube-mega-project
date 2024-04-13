import mongoose, { isValidObjectId } from "mongoose";
import { Subscription } from "../models/subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleSubscription = asyncHandler(async (req, res) => {
    const { channelId } = req.params;
    // TODO: toggle subscription
    if (!channelId) {
        throw new ApiError(400, "Invalid channelId");
    }

    const isSubscribed = await Subscription.findOne({
        subscriber: req.user?._id,
        channel: channelId,
    });

    if (isSubscribed) {
        await Subscription.findByIdAndDelete(isSubscribed?._id);

        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    { isSubscribed: false },
                    "unsubscribed successfully",
                ),
            );
    }

    await Subscription.create({
        subscriber: req.user?._id,
        channel: channelId,
    });

    return res
        .status(200)
        .json(
            new ApiResponse(200, { isSubscribed: true }, "Subscribed successfully"),
        );
});

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const { channelId } = req.params;
    console.log(channelId);

    if (!channelId) {
        throw new ApiError(400, "Invalid channelId");
    }

    const subscribers = await Subscription.aggregate(
        [
            {
                $match: {
                    channel: new mongoose.Types.ObjectId(channelId)
                }
            },
            {
                //Woh saare user jinhone mare channel subscribe kr rkha hai
                $lookup: {
                    from: "users",
                    localField: "subscriber",
                    foreignField: "_id",
                    as: "subscriber",
                    pipeline: [
                        {
                            //woh subscriber jinhe maine subscribe kr rkha hai
                            //smj nhi aaya 
                            $lookup: {
                                from: "subcriptions", //my subscription model
                                localField: "_id", //user._id
                                foreignField: "channel", //maine jo channel subscribe kiye hai
                                as: "subscribedToSubscriber",
                            }
                        },
                        {
                            $addFields: {
                                subscribedToSubscriber: {
                                    $cond: {
                                        if: {
                                            $in: [channelId, "$subscribedToSubscriber.channel"]
                                        },
                                        then: true,
                                        else: false
                                    }
                                },

                                subscribersCount: {
                                    $size: "$subscribedToSubscriber",
                                }
                            }
                        }
                    ]
                }
            },
            {
                $unwind: "$subscriber",
            },
            {
                $project: {
                    _id: 0,
                    subscriber: {
                        _id: 1,
                        username: 1,
                        fullName: 1,
                        "avatar.url": 1,
                        //maine kaun se subseriber to subscribe kiya hai or kitne kiye hai
                        subscribedToSubscriber: 1,
                        subscribersCount: 1,
                    },
                },
            },
        ]
    )

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                subscribers,
                "subscribers fetched successfully"
            )
        );
});

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params;
    console.log(subscriberId);

    if (!subscriberId) {
        throw new ApiError(400, "Invalid subscriberId");
    }

    const subscribedChannels = await Subscription.aggregate(
        [
            {
                $match: {
                    subscriber: new mongoose.Types.ObjectId(subscriberId)
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "channel",
                    foreignField: "_id",
                    as: "subscribedChannel",
                    pipeline: [
                        {
                            //find channel all videos
                            $lookup: {
                                from: "videos",
                                localField: "_id",
                                foreignField: 'owner',
                                as: "videos"
                            }
                        },
                        {
                            //only latest video
                            $addFields: {
                                latestVideo: {
                                    $last: "$videos"
                                }
                            }
                        }
                    ]
                }
            },
            {
                //destructure array
                $unwind: "$subscribedChannel"
            },
            {
                $project: {
                    _id: 0,
                    //channel subscribed information
                    subscribedChannel: {
                        _id: 1,
                        username: 1,
                        fullName: 1,
                        "avatar.url": 1,
                        //latest video information
                        latestVideo: {
                            _id: 1,
                            "videoFile.url": 1,
                            "thumbnail.url": 1,
                            owner: 1,
                            title: 1,
                            description: 1,
                            duration: 1,
                            createdAt: 1,
                            views: 1
                        },
                    },
                }
            }
        ]
    )

    console.log(subscribedChannels);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                subscribedChannels,
                "subscribedChannels fetched successfully"
            )
        );
});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };

/* subscriber easy code made by me
const subscribers = await Subscription.aggregate([
        {
            $match:{channel:new mongoose.Types.ObjectId(channelId)}
        },
        {
            $lookup:{
                from:"users",
                localField:"subscriber",
                foreignField:"_id",
                as:"subscriber",
                pipeline:[
                    {
                        $project:{
                            username:1,
                            "avatar.url":1,
                            fullName:1
                        }
                    }
                ]
            }
        },
        {
            $addFields:{
                subscriber:{
                    $first:"$subscriber"
                }
            }
        }
    ])

*/

/* subscribedChannel easy code made by me
const subscribed = await Subscription.aggregate([
        {
            $match:{subscriber:new mongoose.Types.ObjectId(subscriberId)}
        },
        {
            $lookup:{
                from:"users",
                localField:"channel",
                foreignField:"_id",
                as:"channel",
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
                channel:{
                    $first:"$channel"
                }
            }
        }
    ])

*/