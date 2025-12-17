const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const { uploadVideo, uploadImage } = require('../utils/fileUpload');
router.post('/upload', uploadVideo.single('video'), uploadController.uploadVideo);
router.post('/upload/image', uploadImage.single('image'), uploadController.uploadOverlayImage);
router.get('/status/:jobId', uploadController.getJobStatus);
router.get('/result/:jobId', uploadController.getResult);

module.exports = router;