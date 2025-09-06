import multer from 'multer'

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "./public/temp")
    },
    filename: function (req, file, cb) {
      
      cb(null, file.originalname) // not a good btw to use original name, rather check the deleted method of setting filename
    }
  })

  export const upload = multer({storage})