import mongoose, { isValidObjectId } from "mongoose"
import { Video } from "../models/video.model.js"
import { Like } from "../models/like.model.js"
import { Comment } from "../models/comment.model.js"
import { User } from "../models/user.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { uploadOnCloudinary, deleteOnCloudinary } from "../utils/cloudinary.js"


const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body
    // TODO: get video, upload to cloudinary, create video

    //check is empty title & description
    if ([title, description].some((fields) => fields.trim() === "")) {
        throw new ApiError(400, "All fields are required")
    }

    //get file using middleware multer
    const thumbnailLocalPath = req.files?.thumbnail[0].path
    const videoFileLocalPath = req.files?.videoFile[0].path

    //if get empty path
    if (!(thumbnailLocalPath && videoFileLocalPath)) {
        throw new ApiError(400, "thumbnail and video file are required")
    }

    //upload on cloudinary
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)
    const videoFile = await uploadOnCloudinary(videoFileLocalPath, "video")

    if (!thumbnail.url) {
        throw new ApiError(404, "thumbnail failed to upload on cloudinary")
    }

    if (!videoFile.url) {
        throw new ApiError(404, "video failed to upload on cloudinary")
    }

    // console.log("video:- ", videoFile)

    //create video object
    const video = await Video.create(
        {
            title: title,
            description: description,
            videoFile: {
                url: videoFile.url,
                public_id: videoFile.public_id
            },
            thumbnail: {
                url: thumbnail.url,
                public_id: thumbnail.public_id
            },
            duration: videoFile.duration,
            owner: req.user?._id,
            isPublished: true
        }
    )

    const publishVideo = await Video.findById(video._id)

    if (!publishVideo) {
        throw new ApiError(500, "Something went wromg while publishing the video")
    }

    // console.log("video:- ", video);

    return res
        .status(200)
        .json(new ApiResponse(200, publishVideo, "video published successfully"))
})

// most difficult
const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query
    //TODO: get all videos based on query, sort, pagination
    const pipeline = []

    // for using Full Text based search u need to create a search index in mongoDB atlas
    // you can include field mapppings in search index eg.title, description, as well
    // Field mappings specify which fields within your documents should be indexed for text search.
    // this helps in seraching only in title, desc providing faster search results
    // here the name of search index is 'search-videos'

    //Step-1 for filtering
    //fetch videos if isPublished = true
    pipeline.push(
        {
            $match: {
                isPublished: true
            }
        }
    )

    //Step-2 for filtering
    if(query){
        pipeline.push(
            {
                $search: {
                    index: "search-videos",  //search index in video mongodb database
                    text: {
                        query: query,
                        //path: [title, description] //search only on title, desc
                    }
                }
            }
        )
    }
    

    //Step-3 for filtering
    if(userId){
        if(!isValidObjectId(userId)){
            throw new ApiError(400, "Invalid userID")
        }
        
        pipeline.push(
            {
                $match: {
                    owner: new mongoose.Types.ObjectId(userId)
                }
            }
        )
    }
    

    //sortBy can be views, createdAt, duration
    //sortType can be ascending(1) or descending(-1)
    //Step-4 for sorting(filter krke jo bhi aaya hai usse sort krna hai)
    if (sortBy && sortType) {
        pipeline.push({
            $sort: {
                [sortBy]: sortType === "asc" ? 1 : -1
            }
        });
    } else {
        pipeline.push(
            { 
                
                $sort: {
                    createdAt: -1 
                } 
            }
        )
    }

    //hrr video ke ownerDetails nikalne hai
    pipeline.push(
        {
            $lookup:{
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
            //hmare pass array ke andar bhut saare object aayegye but use of $unwind saare owner hrr ek single entity(object) mai divide ho jaygye -> destructrue of array
            $unwind: "$ownerDetails"
        }
    )

    const videoAggregate = Video.aggregate(pipeline)

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
    }

    const video = await Video.aggregatePaginate(videoAggregate, options)

    if(!video){
        throw new ApiError(500, "failed to fetched videos")
    }

    // console.log(video)

    return res
    .status(200)
    .json(new ApiResponse(200, video, "videos fetched successfully"))
})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: get video by id

    //check videoID is valid or not
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid VideoID")
    }

    // using aggregate we try to find video -> total no. of likes -> Video owner [ owner subscriber, avatar, islikes video or not] -> user subsriber video owner channel or not
    const video = await Video.aggregate([
        {
            //find video
            $match: {
                _id: new mongoose.Types.ObjectId(videoId)
            }
        },
        {
            //total likes document
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },
        {
            //video owner
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        //total subscribers of channel document
                        $lookup: {
                            from: "subscriptions",
                            localField: "_id",
                            foreignField: "channel",
                            as: "subscribers"
                        }
                    },
                    {
                        $addFields: {
                            //total subscriber of owner channel(user)
                            subscribersCount: {
                                $size: "$subscribers"
                            },

                            //check user subscribe the channel or not
                            isSubscribed: {
                                $cond: {
                                    if: {
                                        //check userID(login) is present in subscribers document -> subscriber
                                        $in: [req.user?._id, "$subscribers.subscriber"]
                                    },
                                    then: true,
                                    else: false
                                }
                            }
                        }
                    },
                    {
                        $project: {
                            username: 1,
                            "avatar.url" : 1,
                            subscribersCount: 1,
                            isSubscribed: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                //total no. of likes
                likesCount: {
                    $size: "$likes"
                },

                //owner first object [provide arrey so we get first array element]
                owner: {
                    $first: "$owner"
                },

                //user like video or not
                isLiked: {
                    $cond: {
                        if: {
                            $in: [req.user?._id, "$likes.likedBy"]
                        },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                "videoFile.url": 1,
                title: 1,
                description: 1,
                views: 1,
                duration: 1,
                createdAt: 1,
                owner: 1,
                likesCount: 1,
                isLiked: 1,
                comments: 1
            }
        }
    ])

    // console.log(video)

    if(!video){
        throw new ApiError(500, "failed to fetched video")
    }

    //increment views if video fetched succesfully
    await Video.findByIdAndUpdate(
        videoId,
        {
            $inc: {
                views: 1
            }
        }
    )

    //update User watchHistory and add this video in watchHistory
    await User.findByIdAndUpdate(
        req.user?._id,
        {
            $addToSet: {
                watchHistory: videoId
            }
        }
    )

    return res
    .status(200)
    .json(new ApiResponse(200, video[0], "video details fetched successfully"))
})

const updateVideo = asyncHandler(async (req, res) => {
    const {title, description} = req.body
    const { videoId } = req.params
    //TODO: update video details like title, description, thumbnail

    if(!isValidObjectId(videoId)){
        throw new ApiError(404, "Invalid videoId")
    }

    const video = await Video.findById(videoId)

    if(!video){
        throw new ApiError(404, "no video found")
    }

    if(req.user?._id.toString() !== video.owner.toString()){
        throw new ApiError(404, "You can't edit this video as you are not the owner")
    }

    if ([title, description].some((fields) => fields.trim() === "")) {
        throw new ApiError(400, "All fields are required")
    }

    //get file using middleware multer
    const thumbnailLocalPath = req.file?.path

    //if get empty path
    if (!thumbnailLocalPath) {
        throw new ApiError(400, "thumbnail file are required")
    }

    //upload on cloudinary
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)

    if (!thumbnail.url) {
        throw new ApiError(404, "thumbnail failed to upload on cloudinary")
    }


    const updatedVideo = await Video.findByIdAndUpdate(
        video._id,
        {
            $set: {
                title: title,
                description: description,
                thumbnail: {
                    url: thumbnail.url,
                    public_id: thumbnail.public_id
                }
            }
        },
        {new: true}
    )

    if(!updatedVideo){
        throw new ApiError(500, "failed to update video and thumbnail file")
    }

    //deleting old thumbnail and updating with new one
    if(updatedVideo){
        await deleteOnCloudinary(video.thumbnail.public_id)
    }

    // console.log(updatedVideo);

    return res
    .status(200)
    .json(new ApiResponse(200, updatedVideo, "video update succesfully"))
})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: delete video

    if(!isValidObjectId(videoId)){
        throw new ApiError(404, "Invalid videoId")
    }

    const video = await Video.findById(videoId)

    if(!video){
        throw new ApiError(404, "no video found")
    }

    if(req.user?._id.toString() !== video.owner.toString()){
        throw new ApiError(404, "You can't delete this video as you are not the owner")
    }

    //delete in video mongoDB
    const videoDelete = await Video.findByIdAndDelete(video?._id)

    if(!videoDelete){
        throw new ApiError(400, "failed to delete the video please try again")
    }

    //delete thumbnail on cloudinary
    await deleteOnCloudinary(video?.thumbnail.public_id)

    //delete video on cloudinary and specify source-type = "video"
    await deleteOnCloudinary(video?.videoFile.public_id)

    //delete likes
    await Like.deleteMany(
        {
            video: videoId,
            likeBy: req.user?._id
        }
    )

    //delete comment
    await Comment.deleteMany(
        {
            video: videoId
        }
    )

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "video deleted successfully"))
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if(!isValidObjectId(videoId)){
        throw new ApiError(404, "Invalid videoId")
    }

    const video = await Video.findById(videoId)

    if(!video){
        throw new ApiError(404, "no video found")
    }

    if(req.user?._id.toString() !== video?.owner.toString()){
        throw new ApiError(404, "You can't toogle publish status as you are not the owner")
    }

    // Toggle the isPublished field
    // video.isPublished = !video.isPublished;
    // const toggledVideoPublish = await video.save();

    const toggledVideoPublish = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                isPublished: !video?.isPublished
            }
        },
        {
            new: true
        }
    )

    console.log(togglePublishStatus)


    if (!toggledVideoPublish) {
        throw new ApiError(500, "Failed to toogle video publish status");
    }

    return res
    .status(200)
    .json(new ApiResponse(
        200, 
        {isPublished: toggledVideoPublish.isPublished},
        "Video publish toggled successfully"
    ))

})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}