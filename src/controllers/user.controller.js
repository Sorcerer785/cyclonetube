import {asyncHandler} from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import {User} from "../models/user.models.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from 'jsonwebtoken'
import mongoose,{ SchemaTypeOptions } from "mongoose"

// Access and Refresh Token
const generateAccessAndRefreshTokens = async (userId) => {
    try{
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave:  false})

        return {accessToken, refreshToken}

    }catch(error){
        throw new ApiError(500, error?.message || "Something wrong during access or refresh token")
    }
}

// User Registration
const registerUser = asyncHandler( async (req,res) => {
    // using comments here is good step
    // get user details from frontend
    // validation -  not empty
    // check if user already exist: username, email
    // check for images, avatar
    // upload them to cloudinary,  avatar
    // create user object(for NOSql ) - entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res

     const {fullname,email, username, password} = req.body
     console.log("email: ", email)

    //  if (fullName === ""){
    //     throw new ApiError(400, "fullname is required")
    //  } 

    if (
        [fullname,email, username,password].some((field) => 
        field?.trim() === ""))
        {
            throw new ApiError(400, "All fields req")
        }
    const existedUser = await User.findOne({
        $or: [{username},{email}]
    })
    if (existedUser) {
        throw new ApiError(409, "user already existed")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path
    console.log(avatarLocalPath)
    const coverImageLocalPath = req.files?.coverImage[0]?.path
    
    if (!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage =await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar){
        throw new ApiError(400, "Avatar file is required")
    }

    const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser){
        throw new ApiError(500, "Something wrong during user registration")
    }

    //time to send response
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User Register Successfully")
    )


})

const loginUser= asyncHandler(async (req,res) => {
    // req body --> data
    // username or email
    // find the user
    // password check
    // access and refresh Token generation
    // send cookie

    const {email, username, password} = req.body
    
    if (!username && !email){
        throw new ApiError(400, "username or email required")
    }

    const user = await User.findOne({
        $or: [{username}, { email }]
    })

    if (!user){
        throw new ApiError(404, "user doesnt exist")
    }

    const isPassValid = await user.isPasswordCorrect(password)

    if(!isPassValid){
        throw new ApiError(401, "invalid Credentials")
    }

    const {accessToken, refreshToken}= await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options= {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .cookie("accessToken", accessToken,options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(200,
            {
                user: loggedInUser, accessToken,refreshToken
            },
            "user logged in successfully"
        )
        
    )

   


    
})

const logoutUser= asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(  
        /* this step is made possible using the middleware
         as we dont have direct access to user in this block, 
         now this method can be used for like, comment etc */
        req.user._id,
        {
            // $set: {
            //     refreshToken: undefined //use null instead
            // } // thise method was a little ineffecient
            
            $unset: {
                refreshTiken: 1 // this removes the field from document
            }
            
        },
        {
            new: true
        }
    )
    const options= {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, "User Logged out"))


})

const refreshAccessToken = asyncHandler(async (req,res) => {
    try {
        const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    
        if (!incomingRefreshToken){
            throw new ApiError(401, "unauthorized request")
        }
    
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id)
        if (!user){
            throw new ApiError(401, "Invalid refresh Token")
        }
    
        if (incomingRefreshToken !== user?.refreshToken ){
            throw new ApiError(401, "Refresh Token expired or used")
        }
    
        const options ={
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newRefreshToken}=await generateAccessAndRefreshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken", newRefreshToken,options)
        .json(
            new ApiResponse(200,
                {
                    accessToken, 
                    refreshToken: newRefreshToken},
                    "Access Token Refreshed Successfully"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "well something wrong with refresh token")
    }
})

const changeCurrentPassword = asyncHandler(async (req,res) => {
      const {oldPassword, newPassword} = req.body

      const user =  await User.findById(req.user?._id)
      const isCorrect= await user.isPasswordCorrect(oldPassword)

      if(!isCorrect){
        throw new ApiError(400,"invalid old Password")
      }
      
      user.password = newPassword
      await user.save({validateBeforeSave: false})
      return res
      .status(200)
      .json(new ApiResponse(200,{},"Password changed Successfully"))
})


const getCurrentUser= asyncHandler(async (req,res) => {
    return res
    .status(200)
    .json(200,ApiResponse(200,req.user,"current user fetched successfully"))
})

const updateAccountDetails =asyncHandler(async (req,res) => {
    const {fullname, email} = req.body

    if (!fullname || !email){
        throw new ApiError(400, "All fields required")

    }

    const user =await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullname,
                email
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))
})

// changing files

const updateUserAvatar = asyncHandler(async (req,res) => {
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath){
        throw new ApiError(400, "Avatar file not found")
    }

    const avatar =await uploadOnCloudinary(avatarLocalPath)

    if (!avatar.url){
        throw new ApiError(400, "Error while uploading on avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {new: true}

     ).select("-password")
      return res
      .status(200)
      .json(new ApiResponse(200, req.user, "avatar image updated"))

})

const updateUserCoverImage = asyncHandler(async (req,res) => {
    const coverLocalPath = req.file?.path

    if (!coverLocalPath){
        throw new ApiError(400, "Cover file not found")
    }

    const cover =await uploadOnCloudinary(coverLocalPath)

    if (!cover.url){
        throw new ApiError(400, "Error while uploading on cover")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: cover.url
            }
        },
        {new: true}

    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, req.user, "cover image updated"))
    
})

const getUserChannelProfile = asyncHandler(async (req,res) => {
    const {username} = req.params  //for url
    if(!username?.trim()){
        throw new ApiError(400,"username not found")
    }

    const channel = await User.aggregate(
        [
            {
               $match: {username: username} 
            },
            {
                $lookup:{
                    from: "subscriptions",
                    localField: "_id",
                    foreignField: "channel",
                    as: "subscribers"
                }
            },
            {
                $lookup: {
                    from: "subscriptions",
                    localField: "_id",
                    foreignField: "subscriber",
                    as: "subscribedTo"
                }
            },
            {
                $addFields: {
                    subscribersCount: {
                        $size: "$subscribers"
                    },
                    channelSubscribedToCount: {
                        $size: "$subscribedTo"
                    },
                    isSubscribed: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true, 
                        else: false
                    }

                }
            },
            {
                $project: { // what to send
                    fullname: 1,
                    username: 1,
                    subscribersCount: 1,
                    channelSubscribedToCount: 1,
                    isSubscribed: 1,
                    avatar: 1,
                    email: 1

                }
            }
        ])
        if (!channel?.length){
            throw new ApiError(404, "channel doesnt exist")
        }

        return res
        .status(200)
        .json(
            new ApiResponse(200,channel[0], "User channel fetched successfully")
        )

})

const getWatchHistory = asyncHandler(async (req,res) => {
    const user = await User.aggregate(
        [
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user.id)
            },
        },
            {
                $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                // now due to owner object in videos we need nested lookup
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullname: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]

            }
            }
        
    ])
    return res
    .status(200)
    .json(
        new ApiResponse(200, user[0].watchHistory,"Watch history fetched successfully")
    )

})




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
    getWatchHistory
}