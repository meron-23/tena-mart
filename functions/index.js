const functions = require("firebase-functions");
const admin = require("firebase-admin");
const Stripe = require("stripe");

// Initialize Firebase Admin
admin.initializeApp();

// Initialize Stripe with your secret key
const stripe = Stripe(functions.config().stripe.secret_key);

// Website ID for filtering (Matched to frontend)
const WEBSITE_ID = "sns_international_market";

const twilio = require("twilio");

// You can set these in Firebase config using:
// firebase functions:config:set twilio.sid="YOUR_SID" twilio.auth_token="YOUR_TOKEN" twilio.phone_number="YOUR_TWILIO_NUMBER" admin.phone_number="OWNER_PHONE_NUMBER"
// For now we'll load them safely if they exist, or fallback to an error logger if missing.
const twilioConfig = functions.config().twilio || {};
const twilioClient = (twilioConfig.sid && twilioConfig.auth_token) ? twilio(twilioConfig.sid, twilioConfig.auth_token) : null;
const TWILIO_PHONE_NUMBER = twilioConfig.phone_number;
const ADMIN_PHONE_NUMBER = functions.config().admin ? functions.config().admin.phone_number : null; // Owner's phone number

// Helper function to send SMS
async function sendSMS(phoneNumber, message) {
    if (!twilioClient || !TWILIO_PHONE_NUMBER) {
        console.warn(`[Mock SMS] To: ${phoneNumber} | Message: ${message}`);
        return { success: true, mocked: true };
    }

    try {
        const response = await twilioClient.messages.create({
            body: message,
            from: TWILIO_PHONE_NUMBER,
            to: phoneNumber
        });
        console.log(`SMS sent successfully to ${phoneNumber}. SID: ${response.sid}`);
        return { success: true, sid: response.sid };
    } catch (error) {
        console.error(`Failed to send SMS to ${phoneNumber}:`, error);
        return { success: false, error: error.message };
    }
}

// 1. Create Payment Intent
exports.createPaymentIntent = functions.https.onCall(async (data, context) => {
    try {
        const { amount, currency = "usd", customerEmail, orderData } = data;

        // Validate amount
        if (!amount || amount < 1) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Invalid amount"
            );
        }

        // Create a Payment Intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Convert dollars to cents
            currency,
            metadata: {
                website: WEBSITE_ID,
                orderType: "pickup",
                ...orderData,
            },
            receipt_email: customerEmail,
            description: `SnS International Market Order - ${new Date().toLocaleDateString()}`,
            // For digital wallets
            payment_method_types: ["card"], // apple_pay and google_pay usually handled via card/wallet on client
        });

        return {
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
        };
    } catch (error) {
        console.error("Error creating payment intent:", error);
        throw new functions.https.HttpsError(
            "internal",
            "Failed to create payment intent",
            error.message
        );
    }
});

// 2. Handle Successful Payment
exports.handleSuccessfulPayment = functions.https.onCall(
    async (data, context) => {
        try {
            const {
                paymentIntentId,
                orderData,
                cartItems,
                totals,
                customerInfo,
            } = data;

            // Verify the payment with Stripe
            const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

            if (paymentIntent.status !== "succeeded") {
                throw new functions.https.HttpsError(
                    "failed-precondition",
                    "Payment not completed"
                );
            }

            // Generate order reference
            const orderRef = `SNS-${new Date().getFullYear()}-${Math.floor(
                1000 + Math.random() * 9000
            )}`;

            // Prepare order document
            const order = {
                orderRef,
                paymentIntentId,
                stripeCustomerId: paymentIntent.customer || null,
                items: cartItems,
                totals,
                customer: customerInfo,
                paymentMethod: paymentIntent.payment_method_types[0],
                paymentStatus: "paid",
                stripeChargeId: paymentIntent.latest_charge,
                website: WEBSITE_ID,
                status: "pending",
                pickup: true,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                // Add Central Time fields if needed by backend, but usually frontend handles display
            };

            // Save to Firestore
            const db = admin.firestore();
            const orderRefDoc = await db.collection("orders").add(order);

            // Send confirmation SMS to customer
            const smsMessage = `Thank you for your order at SnS International Market! Your order #${orderRef} has been received. This is a PICKUP-ONLY order. We'll call you when it's ready for pickup at 2425 W Walnut St #200, Garland, TX 75042. Total: $${totals.total}`;
            await sendSMS(customerInfo.phone, smsMessage);

            // Send notification to admin (you could add admin phone number to config)
            // const adminMessage = `New pickup order #${orderRef} received from ${customerInfo.name}. Total: $${totals.total}. Payment: ${paymentIntent.payment_method_types[0]}. Items: ${cartItems.length}`;
            // await sendSMS("+12141234567", adminMessage);

            return {
                success: true,
                orderRef,
                orderId: orderRefDoc.id,
                paymentStatus: "succeeded",
            };
        } catch (error) {
            console.error("Error handling successful payment:", error);
            throw new functions.https.HttpsError(
                "internal",
                "Failed to process payment",
                error.message
            );
        }
    }
);

// 3. Handle Cash Payment (No Stripe processing)
exports.createCashOrder = functions.https.onCall(async (data, context) => {
    try {
        const { orderData, cartItems, totals, customerInfo } = data;

        // Generate order reference
        const orderRef = `SNS-${new Date().getFullYear()}-${Math.floor(
            1000 + Math.random() * 9000
        )}`;

        // Prepare order document
        const order = {
            orderRef,
            items: cartItems,
            totals,
            customer: customerInfo,
            paymentMethod: "cash",
            paymentStatus: "pending",
            website: WEBSITE_ID,
            status: "pending",
            pickup: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        // Save to Firestore
        const db = admin.firestore();
        const orderRefDoc = await db.collection("orders").add(order);

        // Send confirmation SMS
        const smsMessage = `Thank you for your order at SnS International Market! Your order #${orderRef} has been received. This is a PICKUP-ONLY order. Please bring cash when you pick up at 2425 W Walnut St #200, Garland, TX 75042. Total: $${totals.total}`;
        await sendSMS(customerInfo.phone, smsMessage);


        return {
            success: true,
            orderRef,
            orderId: orderRefDoc.id,
            paymentStatus: "pending_cash",
        };
    } catch (error) {
        console.error("Error creating cash order:", error);
        throw new functions.https.HttpsError(
            "internal",
            "Failed to create order",
            error.message
        );
    }
});

// 4. Webhook for Stripe events
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const endpointSecret = functions.config().stripe.webhook_secret;

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const db = admin.firestore();

    // Handle the event
    switch (event.type) {
        case "payment_intent.succeeded":
            const paymentIntent = event.data.object;
            console.log("PaymentIntent was successful!");

            // Update order in Firestore
            const orders = await db
                .collection("orders")
                .where("paymentIntentId", "==", paymentIntent.id)
                .get();

            if (!orders.empty) {
                const orderDoc = orders.docs[0];
                await orderDoc.ref.update({
                    paymentStatus: "paid",
                    stripeChargeId: paymentIntent.latest_charge,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
            break;

        case "payment_intent.payment_failed":
            const failedPaymentIntent = event.data.object;
            console.log("PaymentIntent failed!");

            // Update order in Firestore
            const failedOrders = await db
                .collection("orders")
                .where("paymentIntentId", "==", failedPaymentIntent.id)
                .get();

            if (!failedOrders.empty) {
                const failedOrderDoc = failedOrders.docs[0];
                await failedOrderDoc.ref.update({
                    paymentStatus: "failed",
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
            break;

        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
});

// 5. Get Order Status
exports.getOrderStatus = functions.https.onCall(async (data, context) => {
    try {
        const { orderId } = data;

        const db = admin.firestore();
        const orderDoc = await db.collection("orders").doc(orderId).get();

        if (!orderDoc.exists) {
            throw new functions.https.HttpsError("not-found", "Order not found");
        }

        return {
            status: orderDoc.data().status,
            paymentStatus: orderDoc.data().paymentStatus,
            orderRef: orderDoc.data().orderRef,
        };
    } catch (error) {
        console.error("Error getting order status:", error);
        throw new functions.https.HttpsError(
            "internal",
            "Failed to get order status",
            error.message
        );
    }
});

// 6. Hook for newly created orders in Firestore
exports.onOrderCreated = functions.firestore
    .document('orders/{orderId}')
    .onCreate(async (snap, context) => {
        const orderData = snap.data();

        // Ensure this is an order for our specific website
        if (orderData.website !== WEBSITE_ID) {
            console.log(`Order not for website ${WEBSITE_ID}, ignoring.`);
            return null;
        }

        const db = admin.firestore();

        try {
            // Fetch message templates from websiteSettings or messageTemplates
            let templateStr = "New order {orderRef} from {name}. Total: ${total}."; // Default template

            const templatesSnapshot = await db.collection("messageTemplates").where("website", "==", WEBSITE_ID).get();
            if (!templatesSnapshot.empty) {
                const templatesData = templatesSnapshot.docs[0].data();
                if (templatesData.orderPlaced) {
                    templateStr = templatesData.orderPlaced;
                }
            }

            // Construct placeholders
            const orderRef = orderData.orderReference || orderData.orderRef || orderData.id || context.params.orderId;
            const name = orderData.customer?.name || "Customer";
            const total = (orderData.totals?.total || 0).toFixed(2);
            const items = (orderData.items || []).map(i => `${i.name} x${i.quantity}`).join(', ');

            // Replace templates
            let finalMessage = templateStr
                .replace(/{orderRef}/g, orderRef)
                .replace(/{name}/g, name)
                .replace(/{total}/g, total)
                .replace(/{items}/g, items);

            // Send notification to Owner (Admin)
            if (ADMIN_PHONE_NUMBER) {
                await sendSMS(ADMIN_PHONE_NUMBER, finalMessage);
            } else {
                console.warn("No ADMIN_PHONE_NUMBER configured. Cannot send owner notification.");
                console.log(`[Would have sent to owner]: ${finalMessage}`);
            }

        } catch (error) {
            console.error("Error processing new order onCreate hook:", error);
        }

        return null;
    });
