const path = require('path');
const fs = require("fs");

const express = require('express');
const bodyParser= require('body-parser');
const mongoose = require('mongoose');
const multer = require('multer');
const uuidv4 = require('uuid/v4');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const aws = require('aws-sdk');
const multerS3 = require('multer-s3');

const feedRoutes = require('./routes/feed');
const authRoutes = require('./routes/auth');

aws.config.update({
    secretAccessKey: process.env.AMAZON_SECRET_ACCESS_KEY,
    accessKeyId:process.env.AMAZON_ACCESS_KEY_ID,
    region: 'us-west-1'
  })
  
const s3 = new aws.S3();

const app = express();

// const fileStorage = multer.diskStorage({
//     destination: (req, file, cb) => {
//         cb(null, 'images')
//     },
//     filename: (req, file, cb) => {
//         cb(null, uuidv4())
//     }
// })

const fileFilter = (req, file, cb) => {
    if(
        file.mimetype === 'image/png' ||
        file.mimetype === 'image/jpg' ||
        file.mimetype === 'image/jpeg'
    ) {
        cb(null, true)
    } else {
        cb(null, false)
    }
}

// const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), {flags: 'a'});

// app.use(helmet());
// app.use(compression());
// app.use(morgan('combined', {stream: accessLogStream}))

app.use(bodyParser.json());
app.use(multer({
    storage: multerS3({
      s3: s3,
      bucket: 'ben-online-blog-images',
      acl:'public-read',
      metadata: (req, file, cb) => {
        cb(null, {fieldName: file.fieldname});
      },
      contentDisposition: 'attachment',
      key: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname)
      }
    }), fileFilter: fileFilter}).single('image'));
//app.use(multer({storage: fileStorage, fileFilter: fileFilter}).single('image'));
app.use('/images', express.static(path.join(__dirname, 'images')))

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*'),
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE'),
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    next();
})

app.use('/feed', feedRoutes);
app.use('/auth', authRoutes);

app.use((err, req, res, next) => {
    console.log(err);
    const status = err.statusCode || 500;
    const message = err.message;
    const data = err.data;
    res.status(status).json({message: message, data: data});
})

mongoose
    .connect(`mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@cluster0-amusn.mongodb.net/${process.env.MONGO_DEFAULT_DATABASE}?retryWrites=true&w=majority`)
    .then(result => {
        const server = app.listen(process.env.PORT || 8080);
        const io = require('./socket').init(server);
        io.on('connection', socket => {
            console.log('Client connected!')
        })
    })
    .catch(err => {
        console.log(err)
    })

