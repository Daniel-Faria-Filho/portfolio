const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    stripeSubscriptionId: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    status: {
        type: String,
        required: true,
        enum: ['active', 'past_due', 'canceled', 'incomplete']
    },
    currentPeriodEnd: {
        type: Date,
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Subscription', subscriptionSchema); 