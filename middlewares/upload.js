const multer = require('multer')
const cloudinary = require('../config/cloudinary');
const path = require('path');

const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const fileTypes = /jpeg|jpg|png|gif|webp|avif/;
        const extName = fileTypes.test(path.extname(file.originalname).toLowerCase())
        const mimeType = fileTypes.test(file.mimetype)

        if (extName && mimeType) {
            cb(null, true)
        } else {
            cb(new Error('Only images are allowed'))
        }
    }
})

// Middleware to upload files to Cloudinary
const uploadToCloudinary = (req, res, next) => {
    if (!req.files && !req.file) {
        return next();
    }

    const files = req.files || (req.file ? [req.file] : []);

    Promise.all(files.map(file => {
        return cloudinary.uploader.upload(
            `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
            {
                folder: 'DejaVu/uploads',
                resource_type: 'auto',
                public_id: `${Date.now()}-${file.originalname.split('.')[0]}`
            }
        );
    }))
        .then(results => {
            if (req.files) {
                req.files = results;
            } else if (req.file) {
                req.file = results[0];
            }
            next();
        })
        .catch(error => {
            res.status(500).json({ error: error.message });
        });
}

module.exports = { upload, uploadToCloudinary }
