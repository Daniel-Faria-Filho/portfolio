const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['paid', 'pending', 'failed'],
        default: 'pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    description: String,
    stripeInvoiceId: String
});

module.exports = mongoose.model('Invoice', invoiceSchema); 