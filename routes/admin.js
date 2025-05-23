const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { sendInvitationEmail } = require('../utils/email');
const crypto = require('crypto');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createProxyMiddleware } = require('http-proxy-middleware');
const Note = require('../models/Note');
const fs = require('fs').promises;
const path = require('path');
const contentPath = path.join(__dirname, '..', 'data', 'content.json');

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    if (!req.user || req.user.email !== process.env.ADMIN_EMAIL) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    next();
};

router.get('/invite', isAdmin, (req, res) => {
    res.render('admin/invite', { user: req.user });
});

router.post('/invite', isAdmin, async (req, res) => {
    try {
        const { email } = req.body;

        // Check if user already exists
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Create Stripe customer
        const customer = await stripe.customers.create({
            email: email,
            name: email.split('@')[0] // Temporary name from email
        });

        // Generate setup token
        const setupToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiry = Date.now() + (90 * 24 * 60 * 60 * 1000); // 90 days

        // Create user with temporary token
        user = new User({
            email,
            name: email.split('@')[0], // Temporary name
            stripeCustomerId: customer.id,
            setupToken,
            setupTokenExpires: tokenExpiry,
            password: crypto.randomBytes(16).toString('hex') // temporary password
        });
        await user.save();

        // Send invitation email
        await sendInvitationEmail(email, setupToken);

        res.json({ message: 'Invitation sent successfully' });
    } catch (error) {
        console.error('Error sending invitation:', error);
        res.status(500).json({ error: 'Error sending invitation' });
    }
});

// Add this route to get all users
router.get('/users', isAdmin, async (req, res) => {
    try {
        const users = await User.find().sort({ createdAt: -1 });
        res.render('admin/users', { users });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).send('Error fetching users');
    }
});

// Route to update user name
router.post('/users/:userId/update-name', isAdmin, async (req, res) => {
    try {
        const { name } = req.body;
        const user = await User.findById(req.params.userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.name = name;
        await user.save();

        // Update Stripe customer name
        try {
            await stripe.customers.update(
                user.stripeCustomerId,
                { name: name }
            );
        } catch (stripeError) {
            console.error('Error updating Stripe customer name:', stripeError);
        }

        res.json({ message: 'Name updated successfully' });
    } catch (error) {
        console.error('Error updating user name:', error);
        res.status(500).json({ error: 'Error updating user name' });
    }
});

// Route to delete user
router.delete('/users/:userId/delete', isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.email === 'inbox@danielfaria.cc') {
            return res.status(403).json({ error: 'Cannot delete admin user' });
        }

        // Delete Stripe customer
        try {
            await stripe.customers.del(user.stripeCustomerId);
        } catch (stripeError) {
            console.error('Error deleting Stripe customer:', stripeError);
        }

        await User.findByIdAndDelete(req.params.userId);
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Error deleting user' });
    }
});

// Add this route to get the create invoice page
router.get('/create-invoice', isAdmin, async (req, res) => {
    try {
        const users = await User.find().sort({ name: 1 });
        const products = await stripe.products.list({
            active: true,
            expand: ['data.default_price']
        });

        res.render('admin/create-invoice', { 
            user: req.user,
            users: users,
            products: products.data
        });
    } catch (error) {
        console.error('Error loading invoice creation page:', error);
        res.redirect('/administration/users?error=Error+loading+invoice+page');
    }
});

// Add this route to handle invoice creation
router.post('/create-invoice', isAdmin, async (req, res) => {
    try {
        const { customerId, items, dueDate, notes, sendEmail } = req.body;

        // Create invoice items
        const invoiceItems = [];
        
        for (const item of items) {
            if (item.type === 'product') {
                // Add product item
                invoiceItems.push({
                    price: item.priceId,
                    quantity: item.quantity
                });
            } else {
                // Add custom item
                const price = await stripe.prices.create({
                    unit_amount: Math.round(item.price * 100),
                    currency: 'usd',
                    product_data: {
                        name: item.name
                    }
                });
                
                invoiceItems.push({
                    price: price.id,
                    quantity: item.quantity
                });
            }
        }

        // Create the invoice
        const invoice = await stripe.invoices.create({
            customer: customerId,
            collection_method: 'send_invoice',
            due_date: Math.floor(new Date(dueDate).getTime() / 1000),
            description: notes || undefined
        });

        // Add items to the invoice
        for (const item of invoiceItems) {
            await stripe.invoiceItems.create({
                customer: customerId,
                price: item.price,
                quantity: item.quantity,
                invoice: invoice.id
            });
        }

        // Finalize the invoice
        await stripe.invoices.finalizeInvoice(invoice.id);

        // Send the invoice if requested
        if (sendEmail) {
            await stripe.invoices.sendInvoice(invoice.id);
        }

        res.json({ 
            message: 'Invoice created successfully',
            invoiceId: invoice.id,
            invoiceUrl: invoice.hosted_invoice_url
        });
    } catch (error) {
        console.error('Error creating invoice:', error);
        res.status(500).json({ error: 'Error creating invoice' });
    }
});

// Get all invoices
router.get('/invoices', isAdmin, async (req, res) => {
    try {
        // Get all invoices from Stripe
        const invoices = await stripe.invoices.list({
            limit: 100,
            expand: ['data.customer']
        });

        res.render('admin/invoices', { 
            user: req.user,
            invoices: invoices.data
        });
    } catch (error) {
        console.error('Error fetching invoices:', error);
        res.status(500).send('Error fetching invoices');
    }
});

// Update invoice status
router.post('/invoices/:invoiceId/status', isAdmin, async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const { status } = req.body;

        let stripeAction;
        switch (status) {
            case 'void':
                stripeAction = stripe.invoices.voidInvoice(invoiceId);
                break;
            case 'paid':
                stripeAction = stripe.invoices.pay(invoiceId);
                break;
            // Add other status updates as needed
        }

        if (stripeAction) {
            await stripeAction;
        }

        res.json({ message: 'Invoice status updated successfully' });
    } catch (error) {
        console.error('Error updating invoice status:', error);
        res.status(500).json({ error: 'Error updating invoice status' });
    }
});

// Resend invoice
router.post('/invoices/:invoiceId/resend', isAdmin, async (req, res) => {
    try {
        const { invoiceId } = req.params;
        await stripe.invoices.sendInvoice(invoiceId);
        res.json({ message: 'Invoice resent successfully' });
    } catch (error) {
        console.error('Error resending invoice:', error);
        res.status(500).json({ error: 'Error resending invoice' });
    }
});

// Delete draft invoice
router.delete('/invoices/:invoiceId/delete', isAdmin, async (req, res) => {
    try {
        const { invoiceId } = req.params;
        
        // First verify it's a draft
        const invoice = await stripe.invoices.retrieve(invoiceId);
        if (invoice.status !== 'draft') {
            return res.status(400).json({ error: 'Only draft invoices can be deleted' });
        }
        
        await stripe.invoices.del(invoiceId);
        res.json({ message: 'Draft invoice deleted successfully' });
    } catch (error) {
        console.error('Error deleting draft invoice:', error);
        res.status(500).json({ error: 'Error deleting draft invoice' });
    }
});

// Get all notes
router.get('/notes', isAdmin, async (req, res) => {
    try {
        const [notes, pinnedNotes] = await Promise.all([
            Note.find({ pinned: false }).sort({ updatedAt: -1 }),
            Note.find({ pinned: true }).sort({ updatedAt: -1 })
        ]);

        // Get unique categories
        const categories = [...new Set([...notes, ...pinnedNotes]
            .map(note => note.category)
            .filter(category => category))];

        res.render('admin/notes', { 
            notes, 
            pinnedNotes,
            categories
        });
    } catch (error) {
        console.error('Error fetching notes:', error);
        res.status(500).send('Error fetching notes');
    }
});

// Create new note
router.post('/notes', isAdmin, async (req, res) => {
    try {
        const note = new Note(req.body);
        await note.save();
        res.json({ message: 'Note created successfully' });
    } catch (error) {
        console.error('Error creating note:', error);
        res.status(500).json({ error: 'Error creating note' });
    }
});

// Get single note
router.get('/notes/:id', isAdmin, async (req, res) => {
    try {
        const note = await Note.findById(req.params.id);
        if (!note) {
            return res.status(404).json({ error: 'Note not found' });
        }
        res.json(note);
    } catch (error) {
        console.error('Error fetching note:', error);
        res.status(500).json({ error: 'Error fetching note' });
    }
});

// Update note
router.put('/notes/:id', isAdmin, async (req, res) => {
    try {
        const note = await Note.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        res.json({ message: 'Note updated successfully' });
    } catch (error) {
        console.error('Error updating note:', error);
        res.status(500).json({ error: 'Error updating note' });
    }
});

// Delete note
router.delete('/notes/:id', isAdmin, async (req, res) => {
    try {
        await Note.findByIdAndDelete(req.params.id);
        res.json({ message: 'Note deleted successfully' });
    } catch (error) {
        console.error('Error deleting note:', error);
        res.status(500).json({ error: 'Error deleting note' });
    }
});

// Toggle pin status
router.post('/notes/:id/pin', isAdmin, async (req, res) => {
    try {
        const note = await Note.findByIdAndUpdate(
            req.params.id,
            { pinned: req.body.pinned },
            { new: true }
        );
        res.json({ message: 'Pin status updated successfully' });
    } catch (error) {
        console.error('Error updating pin status:', error);
        res.status(500).json({ error: 'Error updating pin status' });
    }
});

// Portainer redirect
router.get('/portainer', isAdmin, (req, res) => {
    res.redirect('https://admin.danielfaria.cc/portainer');
});

// Subscription routes
router.get('/create-subscription', isAdmin, async (req, res) => {
    try {
        const users = await User.find({}).sort({ name: 1 });
        res.render('admin/create-subscription', { users });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).send('Error fetching users');
    }
});

router.get('/subscriptions', isAdmin, async (req, res) => {
    try {
        const subscriptions = await stripe.subscriptions.list({
            limit: 100,
            expand: ['data.customer']
        });
        
        res.render('admin/subscriptions', { subscriptions: subscriptions.data });
    } catch (error) {
        console.error('Error fetching subscriptions:', error);
        res.status(500).send('Error fetching subscriptions');
    }
});

router.post('/subscriptions/create', isAdmin, async (req, res) => {
    try {
        const { customerId, startDate, planType, customPlanName, customPlanPrice } = req.body;

        let priceId;
        if (planType === 'custom') {
            // Create a product and price for custom subscriptions
            const product = await stripe.products.create({
                name: customPlanName
            });
            const price = await stripe.prices.create({
                product: product.id,
                unit_amount: Math.round(customPlanPrice * 100),
                currency: 'usd',
                recurring: { interval: 'year' }
            });
            priceId = price.id;
        } else {
            // Use the fixed price ID for hosting renewal
            priceId = process.env.HOSTING_YEARLY_PRICE_ID;
        }

        // Convert date to Unix timestamp and ensure it's in the future
        const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
        const now = Math.floor(Date.now() / 1000);
        
        if (startTimestamp <= now) {
            return res.status(400).json({ error: 'Start date must be in the future' });
        }

        // Create the subscription
        const subscription = await stripe.subscriptions.create({
            customer: customerId,
            items: [{ price: priceId }],
            billing_cycle_anchor: startTimestamp,
            proration_behavior: 'none',
            payment_behavior: 'default_incomplete',
            expand: ['latest_invoice.payment_intent']
        });

        res.json({ subscriptionId: subscription.id });
    } catch (error) {
        console.error('Error creating subscription:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/subscriptions/:id/status', isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        let subscription;
        if (status === 'canceled') {
            subscription = await stripe.subscriptions.cancel(id);
        } else if (status === 'active') {
            subscription = await stripe.subscriptions.resume(id);
        } else if (status === 'paused') {
            subscription = await stripe.subscriptions.update(id, {
                pause_collection: {
                    behavior: 'void'
                }
            });
        }

        res.json({ message: 'Subscription status updated' });
    } catch (error) {
        console.error('Error updating subscription status:', error);
        res.status(500).json({ error: 'Error updating subscription status' });
    }
});

// Add this route for editing subscriptions
router.get('/subscriptions/:id/edit', isAdmin, async (req, res) => {
    try {
        const subscription = await stripe.subscriptions.retrieve(req.params.id, {
            expand: ['customer', 'items.data.price.product']
        });
        
        res.render('admin/edit-subscription', { subscription });
    } catch (error) {
        console.error('Error fetching subscription:', error);
        res.redirect('/administration/subscriptions');
    }
});

// Add route to handle subscription updates
router.post('/subscriptions/:id/edit', isAdmin, async (req, res) => {
    try {
        const { startDate } = req.body;
        const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);

        // Get current subscription details before canceling
        const subscription = await stripe.subscriptions.retrieve(req.params.id);

        // Cancel the current subscription immediately
        await stripe.subscriptions.cancel(req.params.id);

        // Create new subscription with the new billing date
        await stripe.subscriptions.create({
            customer: subscription.customer,
            items: subscription.items.data.map(item => ({
                price: item.price.id,
            })),
            billing_cycle_anchor: startTimestamp,
            proration_behavior: 'none',
            payment_behavior: 'default_incomplete'
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating subscription:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add these new routes
router.get('/users/:userId/invoices', isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user || !user.stripeCustomerId) {
            return res.redirect('/administration/users');
        }

        const invoices = await stripe.invoices.list({
            customer: user.stripeCustomerId,
            limit: 100
        });

        res.render('admin/user-invoices', { 
            user,
            invoices: invoices.data
        });
    } catch (error) {
        console.error('Error fetching user invoices:', error);
        res.redirect('/administration/users');
    }
});

router.get('/users/:userId/subscriptions', isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user || !user.stripeCustomerId) {
            return res.redirect('/administration/users');
        }

        const subscriptions = await stripe.subscriptions.list({
            customer: user.stripeCustomerId,
            limit: 100,
            expand: ['data.default_payment_method', 'data.latest_invoice']
        });

        res.render('admin/user-subscriptions', {
            user,
            subscriptions: subscriptions.data
        });
    } catch (error) {
        console.error('Error fetching user subscriptions:', error);
        res.redirect('/administration/users');
    }
});

// Add invoice view route
router.get('/invoices/:id', isAdmin, async (req, res) => {
    try {
        const invoice = await stripe.invoices.retrieve(req.params.id, {
            expand: ['customer', 'subscription']
        });

        res.render('admin/invoice-view', { invoice });
    } catch (error) {
        console.error('Error fetching invoice:', error);
        res.redirect('/administration/users');
    }
});

// Content management routes
router.post('/content', isAdmin, async (req, res) => {
    try {
        const { type, content } = req.body;
        const contentData = JSON.parse(await fs.readFile(contentPath, 'utf8'));
        
        // Update the specified content type
        contentData[type] = content;
        
        // Write the updated content back to file
        await fs.writeFile(contentPath, JSON.stringify(contentData, null, 2));
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating content:', error);
        res.status(500).json({ error: 'Failed to update content' });
    }
});

module.exports = router; 