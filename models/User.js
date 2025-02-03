const mongoose = require('mongoose');
const { getInitials } = require('../utils/avatarUtils');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    profilePicture: {
        type: String,
        default: null
    },
    bio: {
        type: String,
        maxLength: 500
    },
    website: String,
    location: String,
    stripeCustomerId: {
        type: String,
        sparse: true
    },
    subscriptions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subscription'
    }],
    invoices: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Invoice'
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    setupToken: String,
    setupTokenExpires: Date
}, { timestamps: true });

userSchema.methods.getAvatar = function() {
    if (this.profilePicture) {
        return this.profilePicture;
    }
    return null; // Will use initials if null
};

module.exports = mongoose.model('User', userSchema); 