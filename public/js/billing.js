class BillingManager {
    static async createPaymentMethod(stripe, elements) {
        const { error, paymentMethod } = await stripe.createPaymentMethod({
            type: 'card',
            card: elements.getElement('card')
        });

        if (error) {
            throw new Error(error.message);
        }

        return paymentMethod;
    }

    static async handleSubscription(subscriptionId, customerId, paymentMethodId) {
        const response = await fetch('/billing/handle-subscription', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                subscriptionId,
                customerId,
                paymentMethodId
            }),
        });

        return await response.json();
    }
} 