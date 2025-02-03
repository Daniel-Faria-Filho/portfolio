require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const config = require('./config/config');
const User = require('./models/User');
const Subscription = require('./models/Subscription');
const Invoice = require('./models/Invoice');
const jwt = require('jsonwebtoken');
const fileUpload = require('express-fileupload');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const app = express();
const port = 9002;

const auth = require('./middleware/auth'); // Fix the path to middleware
const billingRouter = require('./routes/billing');
const { verifyEmailSetup } = require('./utils/email');
const adminRouter = require('./routes/admin');

// Set EJS as templating engine
app.set('view engine', 'ejs');

// Initialize essential middleware first
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());  // Move this up, before any cookie access
app.use(fileUpload({
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max file size
    createParentPath: true
}));

// Then add the user authentication middleware
app.use(async (req, res, next) => {
    if (req.cookies.token) {
        try {
            const decoded = jwt.verify(req.cookies.token, config.JWT_SECRET);
            const user = await User.findById(decoded.userId);
            req.user = user;  // Add full user object to request
            res.locals.user = user;  // Add user to response locals for views
            next();
        } catch (error) {
            res.clearCookie('token');
            next();
        }
    } else {
        next();
    }
});

// Email configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'gdifaria1987@gmail.com',
        pass: 'wmma jupp xwnm hgrc'
    }
});

// Read projects from JSON file
function getProjects() {
    const data = fs.readFileSync(path.join(__dirname, 'data', 'projects.json'));
    return JSON.parse(data).projects;
}

// Save projects to JSON file
function saveProjects(projects) {
    const data = JSON.stringify({ projects }, null, 2);
    fs.writeFileSync(path.join(__dirname, 'data', 'projects.json'), data);
}

// Routes
app.get('/', (req, res) => {
    res.render('home', { user: res.locals.user });
});

app.get('/about', (req, res) => {
    res.render('about', { user: res.locals.user });
});

app.get('/projects', (req, res) => {
    const projects = getProjects();
    res.render('projects', { projects, user: res.locals.user });
});

app.get('/contact', (req, res) => {
    res.render('contact', { 
        success: req.query.success, 
        error: req.query.error,
        user: res.locals.user 
    });
});

app.get('/services', (req, res) => {
    res.render('services', { 
        success: req.query.success, 
        error: req.query.error,
        user: res.locals.user 
    });
});

app.get('/auth/forgot-password', (req, res) => {
    res.render('auth/forgot-password');
});

app.get('/auth/reset-password', (req, res) => {
    res.render('auth/reset-password');
});

// Handle contact form submission
app.post('/send-email', async (req, res) => {

    try {
        const mailOptions = {
            from: req.body.email,
            to: 'inbox@danielfaria.cc',
            subject: `Portfolio Contact: ${req.body.subject}`,
            text: `Name: ${req.body.name}\nEmail: ${req.body.email}\n\nMessage:\n${req.body.message}`
        };

        await transporter.sendMail(mailOptions);
        res.redirect('/contact?success=true');
    } catch (error) {
        console.error('Error sending email:', error);
        res.redirect('/contact?error=true');
    }
});

// Project management routes
app.get('/projects-manage', (req, res) => {
    const projects = getProjects();
    res.render('projects-manage', { projects });
});

app.post('/verify-pin', (req, res) => {
    const { pin, action } = req.body;
    if (pin === "1987") {
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

app.post('/add-project', (req, res) => {
    try {
        const { title, description } = req.body;
        const projects = getProjects();
        const newProject = {
            id: Date.now(), // Use timestamp as ID to ensure uniqueness
            title,
            description
        };
        projects.push(newProject);
        saveProjects(projects);
        res.redirect('/projects');
    } catch (error) {
        console.error('Error adding project:', error);
        res.status(500).send('Error adding project');
    }
});

app.post('/delete-project', (req, res) => {
    const { id } = req.body;
    let projects = getProjects();
    projects = projects.filter(p => p.id !== parseInt(id));
    saveProjects(projects);
    res.json({ success: true });
});

app.post('/edit-project', (req, res) => {
    try {
        const { id, title, description } = req.body;
        let projects = getProjects();
        const projectIndex = projects.findIndex(p => p.id === parseInt(id));
        
        if (projectIndex !== -1) {
            projects[projectIndex] = {
                ...projects[projectIndex],
                title,
                description
            };
            saveProjects(projects);
        }
        
        res.redirect('/projects');
    } catch (error) {
        console.error('Error editing project:', error);
        res.status(500).send('Error editing project');
    }
});

app.post('/update-project-order', (req, res) => {
    try {
        const { order } = req.body;
        if (!Array.isArray(order)) {
            throw new Error('Invalid order format');
        }

        let projects = getProjects();
        const reorderedProjects = order.map(id => 
            projects.find(p => p.id === id)
        ).filter(Boolean); // Remove any undefined entries

        if (reorderedProjects.length !== projects.length) {
            throw new Error('Some projects were lost in reordering');
        }

        saveProjects(reorderedProjects);
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating project order:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Connect to MongoDB
console.log('Connecting to MongoDB...');
mongoose.connect(config.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000
})
.then(() => {
    console.log('Connected to MongoDB');
    console.log('Database connection established');
    verifyEmailSetup()
        .then(() => {
            console.log('Email service ready');
        })
        .catch(error => {
            console.error('Email service setup failed:', error);
        });
})
.catch(err => {
    console.error('MongoDB connection error:', err);
    console.error('Connection details:', {
        uri: config.MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'),
        options: mongoose.connection.config
    });
});

// Add authentication routes
app.use('/auth', require('./routes/auth'));
app.use('/billing', billingRouter);
app.use('/admin', adminRouter);

// Stripe webhook handler
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log('Received webhook event:', event.type);

    // Handle the event
    switch (event.type) {
        case 'invoice.payment_succeeded':
            try {
                const stripeInvoice = event.data.object;
                console.log('Stripe Invoice:', stripeInvoice);

                // Find user by Stripe customer ID
                const user = await User.findOne({ stripeCustomerId: stripeInvoice.customer });
                
                if (!user) {
                    console.error('No user found for Stripe customer:', stripeInvoice.customer);
                    return res.status(400).send('No matching user found');
                }

                // Check if invoice already exists
                const existingInvoice = await Invoice.findOne({ stripeInvoiceId: stripeInvoice.id });
                if (existingInvoice) {
                    console.log('Invoice already exists:', existingInvoice);
                    return res.json({ received: true });
                }

                const invoice = new Invoice({
                    userId: user._id,
                    amount: stripeInvoice.amount_paid,
                    status: 'paid',
                    description: stripeInvoice.description || 'Payment',
                    stripeInvoiceId: stripeInvoice.id
                });
                await invoice.save();
                console.log('Invoice created:', invoice);

                // Add invoice to user's invoices array
                user.invoices.push(invoice._id);
                await user.save();
                
                console.log('User updated with new invoice');
            } catch (error) {
                console.error('Error creating invoice:', error);
                return res.status(500).send('Error processing invoice');
            }
            break;
        case 'invoice.payment_failed':
            // Handle failed payment
            break;
        // Add other event handlers as needed
    }

    res.json({received: true});
});

app.get('/billing-management', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        console.log('Current user:', {
            id: user._id,
            stripeCustomerId: user.stripeCustomerId
        });

        // Fetch invoices for the user
        const invoices = await Invoice.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .limit(5);
        
        console.log('User ID:', req.user._id);
        console.log('Found invoices:', invoices);
        
        // Check if MongoDB query is working
        const allInvoices = await Invoice.find({});
        console.log('All invoices in system:', allInvoices);
        
        res.render('billing-management', {
            user,
            invoices,
            stripePublicKey: process.env.STRIPE_PUBLISHABLE_KEY
        });
    } catch (error) {
        console.error('Error loading billing page:', error);
        res.status(500).send('Error loading billing page');
    }
});

app.get('/auth/login', (req, res) => {
    res.render('auth/login');
});

app.get('/auth/register', (req, res) => {
    res.render('auth/register');
});

// Profile route
app.get('/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        res.render('profile', { 
            user,
            success: req.query.success,
            error: req.query.error
        });
    } catch (error) {
        console.error('Error loading profile:', error);
        res.status(500).render('error', { error: 'Error loading profile' });
    }
});

// Settings route
app.get('/settings', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        res.render('settings', { 
            user,
            success: req.query.success,
            error: req.query.error
        });
    } catch (error) {
        console.error('Error loading settings:', error);
        res.status(500).render('error', { error: 'Error loading settings' });
    }
});

// Profile update routes
app.post('/profile/update', auth, async (req, res) => {
    try {
        const { name, email, bio, location, website } = req.body;
        const user = await User.findById(req.user._id);

        // Check if email is being changed and if it's already in use
        if (email !== user.email) {
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({ error: 'Email already in use' });
            }
        }

        user.name = name;
        user.email = email;
        user.bio = bio;
        user.location = location;
        user.website = website;

        await user.save();
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Error updating profile' });
    }
});

// Profile picture update route
app.post('/profile/update-picture', auth, async (req, res) => {
    try {
        if (!req.files || !req.files.profilePicture) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const file = req.files.profilePicture;
        
        // Check file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            return res.status(400).json({ error: 'File size must be less than 2MB' });
        }

        // Check file type
        if (!file.mimetype.startsWith('image/')) {
            return res.status(400).json({ error: 'File must be an image' });
        }

        // Generate unique filename
        const filename = `${req.user._id}-${Date.now()}${path.extname(file.name)}`;
        const filepath = path.join(__dirname, 'public', 'uploads', 'profiles', filename);

        // Save file
        await file.mv(filepath);

        // Update user profile
        const user = await User.findById(req.user._id);
        user.profilePicture = `/uploads/profiles/${filename}`;
        await user.save();

        res.json({ success: true, profilePicture: user.profilePicture });
    } catch (error) {
        console.error('Error updating profile picture:', error);
        res.status(500).json({ error: 'Error updating profile picture' });
    }
});

// Password change route
app.post('/settings/change-password', auth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user._id);

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        res.json({ success: true });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ error: 'Error changing password' });
    }
});

// Reset profile picture route
app.post('/profile/reset-picture', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        user.profilePicture = null;
        await user.save();
        res.json({ success: true });
    } catch (error) {
        console.error('Error resetting profile picture:', error);
        res.status(500).json({ error: 'Error resetting profile picture' });
    }
});

// Test route to create an invoice (remove in production)
app.get('/test-invoice', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        console.log('Creating test invoice for user:', user.email);
        
        const testInvoice = new Invoice({
            userId: req.user._id,
            amount: 2500, // $25.00
            status: 'paid',
            description: 'Test Invoice',
            stripeInvoiceId: 'test_' + Date.now()
        });
        await testInvoice.save();
        
        // Add invoice to user's invoices array
        user.invoices.push(testInvoice._id);
        await user.save();
        
        console.log('Test invoice created:', testInvoice);
        res.redirect('/billing-management');
    } catch (error) {
        console.error('Error creating test invoice:', error);
        res.status(500).send('Error creating test invoice');
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 