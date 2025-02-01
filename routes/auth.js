const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const StripeService = require('../services/stripe');
const config = require('../config/config');
const stripe = require('stripe')(config.STRIPE_SECRET_KEY);

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

module.exports = router; 