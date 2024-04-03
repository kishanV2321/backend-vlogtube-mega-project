import multer from "multer";

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
    cb(null, "./public/temp");
},
    filename: function (req, file, cb) {
    cb(null, file.originalname);   //we can change in unique filename
},
});

export const upload = multer({
    storage
});
