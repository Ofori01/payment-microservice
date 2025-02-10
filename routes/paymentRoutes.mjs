// payment-service/routes/paymentRoutes.js
import { Router } from "express";
import { getPaymentById, initiatePayment, paystackWebhook, verifyPayment } from "../controllers/paymentController.mjs";


const paymentRouter = Router();
paymentRouter.post("/initiate", initiatePayment);
paymentRouter.get("/verify/:transactionId",verifyPayment);
paymentRouter.post("/webhook", paystackWebhook);
paymentRouter.get("/order/:orderId", getPaymentById)

export default paymentRouter;