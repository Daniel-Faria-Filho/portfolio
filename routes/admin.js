const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { sendInvitationEmail } = require('../utils/email');
const crypto = require('crypto');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    if (req.user.email === 'inbox@danielfaria.cc') {
        next();
    } else {
        res.status(403).json({ error: 'Unauthorized' });
    }
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
        const tokenExpiry = Date.now() + (5 * 24 * 60 * 60 * 1000); // 5 days

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

module.exports = router; 