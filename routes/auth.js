const express = require('express');
const { body } = require('express-validator/check');

const User = require('../models/user');
const authController = require('../controllers/auth');

const router = express.Router();

router.put('/signup',[
    body('email')
    .isEmail()
    .withMessage('Invalid email address.')
    .custom((value, {req}) => {
        return User.findOne({email: value})
        .then(userData => {
            if(userData){
                return Promise.reject('This email is already in use.')
            }
        })
    }),
    body('name')
    .trim()
    .not()
    .isEmpty(),
    body('password')
    .trim()
    .isLength({min: 5})

], authController.signup)

router.post('/login', authController.login)

module.exports = router;