import {asyncHandler} from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import {User} from "../models/user.models.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"


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
            $set: {
                refreshToken: undefined
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


export { 
    registerUser,
    loginUser,
    logoutUser
}