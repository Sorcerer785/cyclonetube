import {v2 as cloudinary} from 'cloudinary'
import fs from 'fs'


    // Configuration
    cloudinary.config({ 
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
        api_key: process.env.CLOUDINARY_API_KEY, 
        api_secret: process.env.CLOUDINARY_API_SECRET// Click 'View API Keys' above to copy your API secret
    });
    
    // Upload file
    const uploadOnCloudinary =  async (localFilePath) => {
        try{
            if (!localFilePath) return null
            //upload the file from hereon
            const response = await cloudinary.uploader.upload(localFilePath,{resource_type: "auto"})
            console.log("file uploaded",
            response.url)
            return response;
        } catch (error){
            fs.unlinkSync(localFilePath) //remove locally saved temp file if operation fails
        }
    }

    
export {uploadOnCloudinary}