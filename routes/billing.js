const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const StripeService = require('../services/stripe');

router.post('/create-subscription', auth, async (req, res) => {
    try {
        const { priceId } = req.body;
        const subscription = await StripeService.createSubscription(
            req.user.stripeCustomerId,
            priceId
        );
        res.json(subscription);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/create-invoice', auth, async (req, res) => {
    try {
        const { amount, description } = req.body;
        const invoice = await StripeService.createInvoice(
            req.user.stripeCustomerId,
            amount,
            description
        );
        await StripeService.sendInvoice(invoice.id);
        res.json(invoice);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router; 