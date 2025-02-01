const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

class StripeService {
    static async createCustomer(email, name) {
        return await stripe.customers.create({
            email,
            name
        });
    }

    static async createSubscription(customerId, priceId) {
        return await stripe.subscriptions.create({
            customer: customerId,
            items: [{ price: priceId }],
            payment_behavior: 'default_incomplete',
            expand: ['latest_invoice.payment_intent']
        });
    }

    static async createInvoice(customerId, amount, description) {
        const invoice = await stripe.invoices.create({
            customer: customerId,
            auto_advance: false, // draft invoice
            collection_method: 'send_invoice',
            days_until_due: 30
        });

        await stripe.invoiceItems.create({
            customer: customerId,
            amount: amount * 100, // convert to cents
            currency: 'usd',
            invoice: invoice.id,
            description
        });

        return await stripe.invoices.finalizeInvoice(invoice.id);
    }

    static async sendInvoice(invoiceId) {
        return await stripe.invoices.sendInvoice(invoiceId);
    }
}

module.exports = StripeService; 