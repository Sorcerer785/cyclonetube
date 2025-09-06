import multer from 'multer'
import path from "path"
import fs from "fs"

const storage = multer.diskStorage({
    destination: function (req, file, cb) {

      cb(null, "./Public/temp")
    },
    filename: function (req, file, cb) {
      
      cb(null, file.originalname) // not a good btw to use original name, rather check the deleted method of setting filename
    }
  })

  export const upload = multer({storage})