module.exports = {
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/portfolio',
    JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    EMAIL_FROM: 'inquiries@danielfaria.cc'
};