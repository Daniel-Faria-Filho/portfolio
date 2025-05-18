const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // Use TLS
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
    tls: {
        rejectUnauthorized: false // Only for development
    }
});

// Add a verification step
const verifyEmailSetup = async () => {
    try {
        await transporter.verify();
        console.log('Email server connection verified');
    } catch (error) {
        console.error('Email verification failed:', error);
        throw error;
    }
};

const sendPasswordResetEmail = async (email, resetToken) => {
    try {
        const resetUrl = `http://localhost:9002/auth/reset-password/${resetToken}`;
        
        const mailOptions = {
            from: {
                name: 'Daniel Faria',
                address: 'noreply@danielfaria.cc'  // This will be the "from" address
            },
            sender: process.env.SMTP_USER,  // This is the authenticated account
            to: email,
            subject: 'Reset Your Password',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #3498db;">Reset Your Password</h2>
                    <p>You requested to reset your password. Click the button below to set a new password:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetUrl}" style="
                            background: linear-gradient(135deg, #3498db, #2980b9);
                            color: white;
                            padding: 12px 24px;
                            text-decoration: none;
                            border-radius: 5px;
                            display: inline-block;
                        ">Reset Password</a>
                    </div>
                    <p style="color: #666; font-size: 14px;">This link will expire in 1 hour.</p>
                    <p style="color: #666; font-size: 14px;">If you didn't request this, please ignore this email.</p>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Password reset email sent:', info.messageId);
        return info;
    } catch (error) {
        console.error('Error sending password reset email:', error);
        throw error;
    }
};

const sendInvitationEmail = async (email, setupToken) => {
    try {
        const setupUrl = `https://${process.env.SITE_DOMAIN}/auth/setup/${setupToken}`;
        
        const mailOptions = {
            from: {
                name: 'Daniel Faria',
                address: 'noreply@danielfaria.cc'
            },
            sender: process.env.SMTP_USER,
            to: email,
            subject: 'Welcome to Daniel Faria Tech Services',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #3498db;">Welcome!</h2>
                    <p>You've been invited to access Daniel Faria Tech Services Online Billing Page. Click the button below to set up your account:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${setupUrl}" style="
                            background: linear-gradient(135deg, #3498db, #2980b9);
                            color: white;
                            padding: 12px 24px;
                            text-decoration: none;
                            border-radius: 5px;
                            display: inline-block;
                        ">Set Up Account</a>
                    </div>
                    <p style="color: #666; font-size: 14px;">This link will expire in 90 days.</p>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Invitation email sent:', info.messageId);
        return info;
    } catch (error) {
        console.error('Error sending invitation email:', error);
        throw error;
    }
};

// Export both functions
module.exports = {
    sendPasswordResetEmail,
    verifyEmailSetup,
    sendInvitationEmail
}; 