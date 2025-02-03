const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const StripeService = require('../services/stripe');
const config = require('../config/config');
const stripe = require('stripe')(config.STRIPE_SECRET_KEY);
const { sendPasswordResetEmail } = require('../utils/email');
const crypto = require('crypto');

router.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/');
});

router.post('/register', async (req, res) => {
    let customer;
    try {
        const { email, password, name } = req.body;

        // Check if user already exists before creating Stripe customer
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            throw new Error('Email already registered');
        }

        console.log('Creating Stripe customer...');
        // Create Stripe customer
        customer = await StripeService.createCustomer(email, name);
        console.log('Stripe customer created:', customer.id);

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = new User({
            email,
            password: hashedPassword,
            name,
            stripeCustomerId: customer.id
        });

        console.log('Saving user to database...');
        await user.save();
        console.log('User saved successfully');

        // Create token
        const token = jwt.sign({ userId: user._id }, config.JWT_SECRET);

        res.cookie('token', token, { httpOnly: true });
        res.json({ user: { email: user.email, name: user.name } });
    } catch (error) {
        console.error('Registration error:', error);
        // Delete Stripe customer if user creation fails
        if (error.message !== 'Email already registered' && customer?.id) {
            try {
                await stripe.customers.del(customer.id);
            } catch (stripeError) {
                console.error('Error deleting Stripe customer:', stripeError);
            }
        }
        res.status(400).json({ error: error.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user || !await bcrypt.compare(password, user.password)) {
            throw new Error('Invalid credentials');
        }

        const token = jwt.sign({ userId: user._id }, config.JWT_SECRET);
        res.cookie('token', token, { httpOnly: true });
        res.json({ user: { email: user.email, name: user.name } });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST route for forgot password
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ error: 'No account with that email exists' });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = Date.now() + 3600000; // 1 hour from now

        // Save token to user
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = resetTokenExpiry;
        await user.save();

        // Send reset email
        await sendPasswordResetEmail(email, resetToken);

        res.json({ message: 'Password reset email sent' });
    } catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json({ error: 'Error processing your request' });
    }
});

// GET route for reset password page
router.get('/reset-password/:token', async (req, res) => {
    try {
        const user = await User.findOne({
            resetPasswordToken: req.params.token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.redirect('/auth/forgot-password?error=invalid');
        }

        res.render('auth/reset-password', { token: req.params.token });
    } catch (error) {
        res.redirect('/auth/forgot-password?error=error');
    }
});

// POST route for reset password
router.post('/reset-password', async (req, res) => {
    try {
        const { password, token } = req.body;

        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ error: 'Password reset token is invalid or has expired' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({ message: 'Password has been reset' });
    } catch (error) {
        res.status(500).json({ error: 'Error resetting password' });
    }
});

// Route to show setup account page
router.get('/setup/:token', async (req, res) => {
    try {
        const user = await User.findOne({
            setupToken: req.params.token,
            setupTokenExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.redirect('/auth/login?error=invalid');
        }

        res.render('auth/setup-account', { token: req.params.token });
    } catch (error) {
        res.redirect('/auth/login?error=error');
    }
});

// Route to handle account setup
router.post('/setup-account', async (req, res) => {
    try {
        const { password, name, token } = req.body;

        const user = await User.findOne({
            setupToken: token,
            setupTokenExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ error: 'Setup token is invalid or has expired' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Update user
        user.password = hashedPassword;
        user.name = name;
        user.setupToken = undefined;
        user.setupTokenExpires = undefined;
        await user.save();

        // Update Stripe customer name
        try {
            await stripe.customers.update(
                user.stripeCustomerId,
                {
                    name: name
                }
            );
        } catch (stripeError) {
            console.error('Error updating Stripe customer name:', stripeError);
            // Continue with account setup even if Stripe update fails
        }

        // Create JWT token
        const jwtToken = jwt.sign(
            { userId: user._id },
            config.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Set cookie
        res.cookie('token', jwtToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        res.json({ message: 'Account setup successful' });
    } catch (error) {
        console.error('Setup error:', error);
        res.status(500).json({ error: 'Error setting up account' });
    }
});

module.exports = router; 