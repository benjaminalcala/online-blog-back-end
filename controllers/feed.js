const fs = require('fs');
const path = require('path');

const {validationResult} = require('express-validator/check')

const io = require('../socket');
const Post = require('../models/post');
const User = require('../models/user');

exports.getPosts = (req, res, next) => {
    const currentPage = req.query.page || 1;
    const perPage = 2;
    let totalItems;
    Post.find()
    .countDocuments()
    .then(numDocuments => {
        totalItems = numDocuments;
        return Post.find()
            .populate('creator')
            .sort({createdAt: -1})
            .skip((currentPage - 1) * perPage)
            .limit(perPage)
    })
    .then(posts => {
        res.status(200).json({
            message: 'Fecthed posts successfully',
            posts: posts,
            totalItems: totalItems
        })
    })
    .catch(err => {
        if(!err.statusCode){
            err.statusCode = 500;
        }
        next(err)
    })
}

exports.getPost = (req, res, next) => {
    const postId = req.params.postId;
    Post.findById(postId)
    .then(post => {
        if(!post){
            const error = new Error('Could not find post.');
            error.statusCode = 404;
            throw err;
        }
        res.status(200).json({
            message: 'Post fetched!',
            post: post
        })
    })
    .catch(err => {
        if(!err.statusCode){
            err.statusCode = 500
        }
        next(err)
    })
}

exports.postPost = (req, res, next) => {
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        const error = new Error('Invalid input.')
        error.statusCode = 422;
        throw error;
    }
    if(!req.file) {
        const error = new Error('No image provided.');
        error.statusCode = 422;
        throw error;
    }
    const imageUrl = req.file.path.replace('\\', '/')
    const title = req.body.title;
    const content = req.body.content;
    let creator;

    const post = new Post({
        title: title,
        content: content,
        imageUrl: imageUrl,
        creator: req.userId
    })
    post.save()
    .then(result => {
        return User.findById(req.userId)
    })
    .then(user => {
        creator = user;
        user.posts.push(post);
        return user.save()
    })
    .then(result => {
        io.getIO().emit('posts', {action: 'create', post: {...post._doc, creator: {_id: req.userId, name: creator.name}}})
        res.status(201).json({
            message: 'Successfully created post!',
            post: post,
            creator: {_id: creator._id, name: creator.name}
        })
    })
    .catch(err => {
        if(!err.statusCode){
            err.statusCode = 500;
        }
        next(err)
    })
}

exports.updatePost = (req, res, next) => {
    const postId = req.params.postId;
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        const error = new Error('Incorrect data entered.');
        error.statusCode = 422;
        throw error;
    }
    
    const title = req.body.title;
    const content = req.body.content;
    let imageUrl = req.body.image;
    if(req.file){
        console.log('imageURLLL:', imageUrl)
        imageUrl = req.file.path.replace('\\', '/')
        console.log('imageURLL2:', imageUrl)
    }
    if(!imageUrl) {
        const error = new Error('No image selected.');
        error.statusCode = 422;
        throw error;
    }
    Post.findById(postId)
    .populate('creator')
    .then(post => {
        if(!post){
            const error = new Error('No post found.');
            error.statusCode = 404;
            throw error
        }
        if(post.creator._id.toString() !== req.userId){
            const error = new Error('Not authorized.');
            error.statusCode = 403;
            throw error;
        }
        if(imageUrl !== post.imageUrl){
            clearImage(post.imageUrl);
        }
        post.title = title;
        post.content = content;
        post.imageUrl = imageUrl;
        return post.save()
    })
    .then(result => {
        io.getIO().emit('posts', {action: 'update', post: result});
        res.status(200).json({message: 'Post updated successfully!', post: result})
    })
    .catch(err => {
        if(!err.statusCode){
            err.statusCode = 500;
        }
        next(err)
    })
}

exports.deletePost = (req, res, next) => {
    const postId = req.params.postId;
    Post.findById(postId)
    .then(post => {
        if(!post){
            const error = new Error('Could not find post.');
            error.statusCode = 404;
            throw error;
        }
        if(post.creator.toString() !== req.userId){
            const error = new Error('Not authorized.');
            error.statusCode = 403;
            throw error;  
        }
        clearImage(post.imageUrl);
        return Post.findByIdAndRemove(postId)
    })
    .then(result => {
        return User.findById(req.userId)
    })
    .then(user => {
        user.posts.pull(postId)
        return user.save()
    })
    .then(result => {
        io.getIO().emit('posts', {action: 'delete', post: postId})
        res.status(200)
        .json({
            message: 'Post has been deleted!'
        })
        
    })
    .catch(err => {
        if(!err.statusCode){
            err.statusCode = 500;
        }
        next(err)
    })
}

exports.getStatus = (req, res, next) => {
    User.findById(req.userId)
    .then(user => {
        if(!user){
            const error = new Error('User not found.');
            error.statusCode = 404;
            throw error;
        }
        res.status(200).json({status: user.status})
    })
    .catch(err => {
        if(!err.statusCode){
            err.statusCode = 500;
        }
        next(err)
    })
}

exports.postStatus = (req, res, next) => {
    const status = req.body.status;
    User.findById(req.userId)
    .then(user => {
        if(!user){
            const error = new Error('User not found.');
            error.statusCode = 404;
            throw error;
        }
        user.status = status;
        return user.save()
    })
    .then(result => {
        res.status(201).json({
            message: 'Updated status successfully!',
            status: result.status
        })
    })
    .catch((err) => {
        if(!err.statusCode){
            err.statusCode = 500;
        }
        next(err);
    })

}

const clearImage = filePath => {
    filePath = path.join(__dirname, '..', filePath);
    fs.unlink(filePath, (err) => {
        console.log(err)
    })
}