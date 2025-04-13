Hello! Welcome to my Open Source Portfolio code live at https://danielfaria.cc. To use this for youself, follow these instructions:


# Environment Variables Setup Guide

## Initial Setup
1. Find the `.env.example` file in the root directory
2. Make a copy of this file and rename it to `.env`
3. Replace all placeholder values in your new `.env` file with your actual credentials
4. Never commit your actual `.env` file to version control

## Variable Explanations

Feature Flags:
- SHOW_DRONE_SERVICES: Set to "true" to enable drone services throughout the site, "false" to hide all drone-related content
  - When disabled:
    - Removes drone services section from services page
    - Updates meta titles and descriptions to exclude drone references
    - Removes location-specific content since web services are remote
    - Adjusts schema markup to exclude local business data
    - Updates navigation and UI elements accordingly

Location Configuration (used when SHOW_DRONE_SERVICES is "true"):
- STATE_NAME: Full name of your state (e.g., "California")
- STATE_CODE: Two-letter state code (e.g., "CA")
  - Used in:
    - SEO titles and descriptions
    - Services page headers
    - Schema markup for local business
    - Contact information

Site Configuration:
- SITE_NAME: Your name as displayed throughout the site
- SITE_TITLE_SUFFIX: Text appended to browser tab titles
- SITE_LOGO_TEXT: Text displayed in the header logo (supports HTML-like syntax)
- SITE_DOMAIN: Your website's domain name

Contact Information:
- CONTACT_EMAIL: Main contact email address for the contact form
- CONTACT_PHONE: Contact phone number (include country code and formatting)
- CONTACT_DISCORD: Your Discord username without discriminator

Social Media:
- GITHUB_URL: Full URL to your GitHub profile
- LINKEDIN_URL: Full URL to your LinkedIn profile

Admin Configuration:
- ADMIN_EMAIL: Administrator email address for special permissions
- COPYRIGHT_NAME: Full name used in copyright notices

Stripe Integration:
- STRIPE_SECRET_KEY: Your Stripe secret key from Dashboard → Developers → API keys
- STRIPE_PUBLISHABLE_KEY: Your Stripe publishable key from the same location
- STRIPE_WEBHOOK_SECRET: Webhook signing secret from Stripe Dashboard → Webhooks
- HOSTING_YEARLY_PRICE: Annual hosting price in USD (numbers only)
- HOSTING_YEARLY_PRICE_ID: Stripe Price ID for the annual hosting product

Database Configuration:
- MONGODB_URI: Your MongoDB connection string
- JWT_SECRET: Random secure string for JWT token encryption

Email Service Configuration:
- SMTP_HOST: Your SMTP server hostname
- SMTP_PORT: SMTP server port (usually 587 for TLS)
- SMTP_USER: Email account username
- SMTP_PASS: Email account password or app-specific password
- EMAIL_FROM_ADDRESS: Address that sends automated emails
- EMAIL_FROM_NAME: Name shown in email "from" field
- EMAIL_NOREPLY_ADDRESS: Address for system notifications

## Getting Your Credentials

Stripe Setup:
1. Create a Stripe account
2. Navigate to Dashboard → Developers → API keys
3. Create a webhook endpoint in Dashboard → Developers → Webhooks
4. Create your products and note the Price IDs

MongoDB Setup:
1. Create a MongoDB Atlas account or use local MongoDB
2. Get your connection string from the Atlas Dashboard
3. Generate a secure random string for JWT_SECRET

Email Setup (Gmail Example):
1. Enable 2FA on your Gmail account
2. Generate an App Password
3. Use Gmail's SMTP settings and your app password

Remember to keep your .env file secure and never share or commit your actual credentials. The .env.example file serves as a template and can be safely committed to version control.

# Site Features & Administration Guide

## Public Pages
- **Home**: Landing page with introduction
- **About**: Detailed information about you/your services
- **Services**: List of available services and pricing
- **Projects**: Portfolio of work and projects
- **Contact**: Contact form and direct contact information

## User Features
- User registration and authentication
- Profile customization
- Billing management
- Invoice viewing and payment

## Administrative Features
The admin account (set by ADMIN_EMAIL in .env) has access to:

### User Management
- Invite new users
- Manage existing users
- View user profiles
- Edit user information

### Billing & Subscriptions
- Create new invoices
- Manage existing invoices
- Create subscriptions
- Manage subscription status
- View payment history

### Admin Dropdown Menu
Administrators have access to additional menu items:
- **Invite Users**: Send registration invitations
- **Manage Users**: User administration panel
- **Create Invoice**: Generate new invoices
- **Manage Invoices**: View and edit invoices
- **Create Subscription**: Set up new subscriptions
- **Manage Subscriptions**: Monitor active subscriptions
- **Notes**: Internal admin notes system
- **Portainer**: Server management interface (You can easily remove this from the admin dropdown menu if you don't need it. Remove it in header.ejs)

### Content Management
Administrators can:
- Edit project entries in the projects page directly through the site when logged in with the admin account
- Manage service offerings in the services page directly through the site when logged in with the admin account
- Edit the about page content directly through the site when logged in with the admin account
- Edit the home page content directly through the site when logged in with the admin account



### Technical Access
- Access to Portainer dashboard via redirect from the admin dropdown menu
- System configuration options

## Security Features
- JWT-based authentication
- Secure password reset system
- Role-based access control
- Encrypted data transmission
- Secure payment processing via Stripe

## Additional Features
- Responsive design for mobile devices
- Automated email notifications
- File upload capabilities for profile pictures
- Real-time updates
- Secure data handling
- Easy to customize
- Easy to deploy
- Easy to maintain
- Easy to update
- Easy to add new features
- Easy to customize the design
- Easy to deploy the application
- Easy to maintain the application
- Easy to update the application
- Constantly being updated and improved

# Docker Deployment

The project includes Docker configuration files for easy deployment. Here's how to use them:

## Understanding the Configuration

### docker-compose.yml
The included docker-compose.yml uses environment variables from your .env file. You can either:
1. Use the variables from your .env file (recommended for development):
```yaml
environment:
  - SITE_NAME=${SITE_NAME}
  - SITE_TITLE_SUFFIX=${SITE_TITLE_SUFFIX}
  # ... other environment variables
```

2. Or hardcode your values (easier for production):
```yaml
environment:
  - SITE_NAME=Your Name
  - SITE_TITLE_SUFFIX= - Your Suffix
  # ... other environment variables
```

The configuration includes:
- Port mapping to 9002
- Volume mapping for live development
- Automatic container restart

### Dockerfile
The included Dockerfile:
- Uses Node.js 18
- Sets up the application directory
- Installs dependencies
- Exposes port 9002
- Starts the application with `node .`

## Running the Application

1. Make sure your .env file is set up with your credentials
2. Start the container:
```bash
docker-compose up --build
```

3. For background running:
```bash
docker-compose up -d --build
```

4. To stop:
```bash
docker-compose down
```

Your application will be available at http://localhost:9002

## Development vs Production
- Development: Keep the volume mappings for live code updates
- Production: Consider removing volume mappings for better security
