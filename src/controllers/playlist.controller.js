import mongoose, { isValidObjectId } from "mongoose"
import { Playlist } from "../models/playlist.model.js"
import { Video} from "../models/video.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"


const createPlaylist = asyncHandler(async (req, res) => {
    const { name, description } = req.body

    if (!(name && description)) {
        throw new ApiError(400, "name and description both are requires")
    }

    const playlist = await Playlist.create(
        {
            name: name,
            description: description,
            owner: req.user?._id
        }
    )

    if (!playlist) {
        throw new ApiError(500, "failed to create playlist")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, playlist, "Playlist created succesfully"))
})

const updatePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params
    const { name, description } = req.body

    if (!(name && description)) {
        throw new ApiError(400, "name and description both are requires")
    }

    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlistId")
    }

    const playlist = await Playlist.findById(playlistId)

    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }


    if (req.user?._id.toString() !== playlist.owner.toString()) {
        throw new ApiError(400, "only owner can update their playlist")
    }

    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $set: {
                name: name,
                description: description
            }
        },
        {
            new: true
        }
    )

    if (!updatedPlaylist) {
        throw new ApiError(500, "failed to update playlist")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, updatedPlaylist, "Playlist updated succesfully"))
})

const deletePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params

    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlistId")
    }

    const playlist = await Playlist.findById(playlistId)

    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    if (req.user?._id.toString() !== playlist.owner.toString()) {
        throw new ApiError(400, "only owner can delete their playlist")
    }

    const deletePlaylist = await Playlist.findByIdAndDelete(playlistId)

    if (!deletePlaylist) {
        throw new ApiError(500, "failed to delete playlist")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "playlist deleted succesfully"))
})

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params

    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlistId")
    }

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId")
    }

    const playlist = await Playlist.findById(playlistId)
    const video = await Video.findById(videoId)


    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    if (!video) {
        throw new ApiError(404, "video not found");
    }

    if ((playlist.owner.toString() !== video.owner.toString()) &&
        (req.user?._id.toString() !== (playlist.owner.toString()))) {
        throw new ApiError(400, "only owner can add video their playlist")
    }


    const addVideo = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            //add elements to an array field within a document but only if the elements are not already present in the array.
            // is used to add elements to an array field, ensuring that each element is unique within the array
            $addToSet: {
                videos: videoId
            }
        },
        {
            new: true
        }
    )

    if (!addVideo) {
        throw new ApiError(500, "failed to add video in playlist")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, addVideo, "added video to playlist succesfully"))
})

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params

    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlistId")
    }

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId")
    }

    const playlist = await Playlist.findById(playlistId)
    const video = await Video.findById(videoId)

    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    if (!video) {
        throw new ApiError(404, "video not found");
    }

    if ((playlist.owner.toString() !== video.owner.toString()) &&
        (req.user?._id.toString() !== (playlist.owner.toString()))) {
        throw new ApiError(400, "only owner can add video their playlist")
    }

    const removeVideo = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            //pull -> is used to remove all the instances of the value or the value that matches the specified condition from the existing array
            $pull: {
                videos: videoId
            }
        }
    )

    if (!removeVideo) {
        throw new ApiError(500, "failed to remove video from playlist")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, removeVideo, "Succesfully removed video from playlist"))
})

const getUserPlaylists = asyncHandler(async (req, res) => {
    const { userId } = req.params

    if (!isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid userId")
    }

    const playlist = await Playlist.aggregate(
        [
            {
                $match: {
                    owner: new mongoose.Types.ObjectId(userId)
                }
            },
            {
                $lookup: {
                    from: "videos",
                    localField: "videos",
                    foreignField: "_id",
                    as: "videos"
                }
            },
            {
                $addFields: {
                    totalVideos: {
                        $size: "$videos"
                    },

                    totalViews: {
                        $sum: "$videos.views"
                    }
                }
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    description: 1,
                    totalVideos: 1,
                    totalViews: 1,
                    updatedAt: 1
                }
            }
        ]
    )

    return res
    .status(200)
    .json(new ApiResponse(200, playlist, "User playlists fetched successfully"))

})

const getPlaylistById = asyncHandler(async (req, res) => {
    const { playlistId } = req.params

    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid userId")
    }

    const playlistVideos = await Playlist.aggregate(
        [
            {
                $match: {
                    _id : new mongoose.Types.ObjectId(playlistId)
                }
            },
            {
                $lookup: {
                    from: "videos",
                    localField: "videos",
                    foreignField: "_id",
                    as: "videos",
                }
            },
            {
                $match: {
                    "videos.isPublished": true
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
                $addFields: {
                    totalVideos: {
                        $size: "$videos"
                    },

                    totalViews: {
                        $sum: "$videos.views"
                    },

                    owner: {
                        $first: "$owner"
                    }
                }
            },
            {
                $project: {
                    name: 1,
                    description: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    totalVideos: 1,
                    totalViews: 1,
                    videos: {
                        _id: 1,
                        "videoFile.url": 1,
                        "thumbnail.url": 1,
                        title: 1,
                        description: 1,
                        duration: 1,
                        views: 1,
                        createdAt: 1
                    },
                    owner: {
                        username: 1,
                        "avatar.url": 1,
                        fullname: 1,
                    }
                }
            }
        ]
    )


    return res
    .status(200)
    .json(new ApiResponse(200, playlistVideos[0], "video playlists fetched successfully"))
})


export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
}