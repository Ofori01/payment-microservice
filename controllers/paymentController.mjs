import dotenv from "dotenv";
import axios from "axios";
import Payment from '../models/Payment.mjs';
// import amqp from "amqplib/callback_api";
import communicator from '../communicator/index.mjs';

dotenv.config();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

// Function to publish message to RabbitMQ
// const sendToQueue = (queue, message) => {
//     const rabbitmqURL = process.env.RABBITMQ_URL;
//     amqp.connect(rabbitmqURL, (error0, connection) => {
//         if (error0) {
//             console.error("RabbitMQ connection error:", error0);
//             return;
//         }
//         connection.createChannel((error1, channel) => {
//             if (error1) {
//                 console.error("RabbitMQ channel error:", error1);
//                 return;
//             }

//             channel.assertQueue(queue, { durable: true });
//             channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), { persistent: true });
//             console.log("Sent message to queue:", message);
//         });

//         setTimeout(() => connection.close(), 500);
//     });
// };

// Initiate Payment
const initiatePayment = async (req, res) => {
    try {
        const { order_id, email } = req.body;
        if (!order_id || !email) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        // Get Order from order service
        const order = await communicator.getOrder(order_id);
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }
        console.log(order);

        // Check if a pending payment already exists for the order
        const existingPayment = await Payment.findOne({ order_id, payment_status: "pending" });
        if (existingPayment) {
            return res.status(400).json({ message: "A payment is already pending for this order" });
        }

        // Validate amount
        const amount = order.total_price;
        if (!amount || amount <= 0) {
            return res.status(400).json({ message: "Invalid order amount" });
        }

        const amountInP = Math.round(amount * 100);

        // Call Paystack API to initialize payment
        const paystackPayload = {
            email,
            amount: amountInP,
        };

        console.log("Sending request to Paystack:", paystackPayload);

        const response = await axios.post(
            "https://api.paystack.co/transaction/initialize",
            paystackPayload,
            { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
        );

        // Extract payment details from Paystack response
        const payment_link = response.data.data.authorization_url;
        const transaction_reference = response.data.data.reference;

        // Ensure transactionReference is not null
        if (!transaction_reference) {
            return res.status(500).json({ message: "Failed to generate transaction reference" });
        }

        // Save payment details in the database
        const payment = new Payment({
            order_id,
            user_id: order.user_id,
            amount,
            payment_status: "completed",
            payment_date: new Date(),
            transaction_reference,
        });

        await payment.save();
        await communicator.updateOrder(order_id,{'payment_status': "completed"});

        res.status(200).json({ message: "Payment initialized", payment_link });
    } catch (err) {
        console.error("Payment initiation failed:", err);
        res.status(500).json({ message: "Payment initiation failed", error: err.message });
    }
};

// Verify Payment
const verifyPayment = async (req, res) => {
    try {
        const { reference } = req.params;

        // Verify payment with Paystack
        const response = await axios.get(
            `https://api.paystack.co/transaction/verify/${reference}`,
            { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
        );

        const transaction = response.data.data;
        if (!transaction) {
            return res.status(400).json({ message: "Invalid transaction reference" });
        }

        // Find Payment
        const payment = await Payment.findOne({ transaction_reference: reference });
        if (!payment) {
            return res.status(404).json({ message: "Payment not found" });
        }

        // Update Payment Status
        payment.payment_status = transaction.status === "success" ? "completed" : "failed";
        payment.payment_method = transaction.channel || "unknown";
        await payment.save().then(async (payment)=>{
            await communicator.updateOrder(payment.order_id,{payment_status:payment.payment_status});
        });

        res.status(200).json({ message: "Payment verified", payment });
    } catch (err) {
        res.status(500).json({ message: "Payment verification failed", error: err.message });
    }
};

// Paystack Webhook
const paystackWebhook = async (req, res) => {
    try {
        const event = req.body;
        const transaction = event.data;

        // Find Payment
        const payment = await Payment.findOne({ transaction_reference: transaction.reference })
        if (!payment) {
            return res.status(404).json({ message: "Payment not found" });
        }

        // Update Payment Status
        payment.payment_status = event.event === "charge.success" ? "completed" : "failed";
        payment.payment_method = transaction.channel || "unknown";
        await payment.save().then(async (payment)=>{ 
            await communicator.updateOrder(payment.order_id,{payment_status:payment.payment_status});
        });

        // const userEmail = payment.user_id.email;

        // if (!userEmail) {
        //     return res.status(400).json({ message: "User email is missing" });
        // }

        // Publish payment status update to RabbitMQ
        // const paymentUpdate = {
        //     orderId: payment.orderId._id,
        //     userId: payment.userId._id,
        //     amount: payment.amount,
        //     targetEmail: userEmail,
        //     paymentStatus: payment.paymentStatus,
        //     transactionReference: payment.transactionReference,
        // };

        // await sendToQueue('payment_status_queue', paymentUpdate);

        res.status(200).json({ message: "Webhook processed successfully" });
    } catch (err) {
        res.status(500).json({ message: "Webhook processing failed", error: err.message });
    }
};

// Get Payment By ID
const getPaymentById = async (req, res) => {
    try {
        const { order_id } = req.params;
        const payment = await Payment.findById(order_id);

        if (!payment) {
            return res.status(404).json({ message: "Payment not found" });
        }

        res.status(200).json(payment);
    } catch (error) {
        console.error("Error fetching payment:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

export { initiatePayment, verifyPayment, paystackWebhook, getPaymentById };
