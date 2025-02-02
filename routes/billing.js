const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const StripeService = require('../services/stripe');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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

router.post('/create-checkout-session', auth, async (req, res) => {
    try {
        const { invoiceId } = req.body;
        
        // Get the invoice details
        const invoice = await stripe.invoices.retrieve(invoiceId);
        
        const session = await StripeService.createCheckoutSession(
            [{
                name: `Invoice #${invoice.number}`,
                description: invoice.description || 'Payment for services',
                amount: invoice.amount_due / 100,
            }],
            req.user.stripeCustomerId,
            `${process.env.BASE_URL}/billing/success`,
            `${process.env.BASE_URL}/billing/cancel`
        );

        res.json({ url: session.url });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: 'Error creating checkout session' });
    }
});

// Success route
router.get('/success', auth, (req, res) => {
    res.render('billing-success');
});

// Cancel route
router.get('/cancel', auth, (req, res) => {
    res.redirect('/billing-management');
});

// Add this route to get Stripe invoices
router.get('/get-invoices', auth, async (req, res) => {
    try {
        const invoices = await stripe.invoices.list({
            customer: req.user.stripeCustomerId,
            limit: 100,
        });
        
        // Filter active invoices (not draft or void)
        const activeInvoices = invoices.data.filter(inv => 
            inv.status !== 'draft' && inv.status !== 'void'
        );

        console.log('Active invoices found:', {
            customerId: req.user.stripeCustomerId,
            count: activeInvoices.length,
            invoices: activeInvoices.map(inv => ({
                id: inv.id,
                amount: inv.amount_due / 100,
                status: inv.status
            }))
        });

        res.json(invoices.data);
    } catch (error) {
        console.error('Error fetching invoices:', error);
        res.status(500).json({ error: 'Error fetching invoices' });
    }
});

router.get('/billing-management', auth, async (req, res) => {
    try {
        const stripeInvoices = await stripe.invoices.list({
            customer: req.user.stripeCustomerId,
            limit: 100,
        });

        // Filter active invoices
        const activeInvoices = stripeInvoices.data.filter(inv => 
            inv.status !== 'draft' && inv.status !== 'void'
        );

        res.render('billing-management', { 
            user: req.user,
            invoices: activeInvoices
        });
    } catch (error) {
        console.error('Error fetching invoices:', error);
        res.render('billing-management', { 
            user: req.user,
            invoices: [],
            error: 'Error fetching invoices'
        });
    }
});

module.exports = router; 