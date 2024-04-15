import mongoose, { isValidObjectId } from "mongoose"
import { Comment } from "../models/comment.model.js"
import { Video} from "../models/video.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import { Like } from "../models/like.model.js"

const getVideoComments = asyncHandler(async (req, res) => {
    const {videoId} = req.params
    const {page = 1, limit = 10} = req.query

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    const videoComments = Comment.aggregate(
        [
            {
                $match: {
                    video: new mongoose.Types.ObjectId(videoId)
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "owner",
                    foreignField: "_id",
                    as: "owner"
                }
            },
            {
                $lookup: {
                    from: "likes",
                    localField: "_id",
                    foreignField: "comment",
                    as: "likes"
                }
            },
            {
                $addFields: {
                    likesCount: {
                        $size: "$likes"
                    },

                    isLiked: {
                        $cond: {
                            if: {
                                $in: [req.user?._id, "$likes.likedBy"]
                            },
                            then: true,
                            else: false
                        }
                    },

                    owner: {
                        $first: "$owner" //array of first elemet in object form
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
                    createdAt: 1,
                    likesCount: 1,
                    owner: {
                        fullname: 1,
                        username: 1,
                        "avatar.url": 1
                    },
                    isLiked: 1,
                }
            }
        ]
    )

    
    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
    }
    
    //not send correct form data
    const comments = await Comment.aggregatePaginate(videoComments, options)
    
    // console.log(comments);
    
    return res
    .status(200)
    .json(new ApiResponse(200, comments, "comments fetched successfully"))

})

const addComment = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const { content } = req.body

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId")
    }

    if(!content){
        throw new ApiError(400, "content is required")
    }

    const video = await Video.findById(videoId)

    if (!video) {
        throw new ApiError(404, "video not found");
    }

    const comment = await Comment.create(
        {
            content: content,
            video: videoId,
            owner: req.user?._id
        }
    )

    if(!comment){
        throw new ApiError(500, "failed to add comment")
    }

    return res
    .status(200)
    .json(new ApiResponse(200, comment, "Add comment successfully"))
})

const updateComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params
    const { content } = req.body

    if (!isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid commentId")
    }

    if(!content){
        throw new ApiError(400, "content is required")
    }

    const comment = await Comment.findById(commentId)

    if (!commentId) {
        throw new ApiError(404, "comment not found");
    }

    if(req.user?._id.toString() !== comment.owner.toString()){
        throw new ApiError(400, "only owner can update comment")
    }

    const updatedComment = await Comment.findByIdAndUpdate(
        commentId,
        {
            $set:{
                content: content
            }
        },
        {
            new: true
        }
    )

    if(!updatedComment){
        throw new ApiError(500, "failed to update comment")
    }

    return res
    .status(200)
    .json(new ApiResponse(200, updatedComment, "updated comment successfully"))
})

const deleteComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params

    if (!isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid commentId")
    }

    const comment = await Comment.findById(commentId)

    if (!commentId) {
        throw new ApiError(404, "comment not found");
    }

    if(req.user?._id.toString() !== comment.owner.toString()){
        throw new ApiError(400, "only owner can delete comment")
    }

    const deleteComment = await Comment.findByIdAndDelete(commentId)

    await Like.deleteMany(
        {
            comment: commentId,
            likeby: req.user?._id
        }
    )

    if(!deleteComment){
        throw new ApiError(500, "failed to delete comment")
    }

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "deleted comment successfully"))
})

export {
    getVideoComments, 
    addComment, 
    updateComment,
    deleteComment
    }