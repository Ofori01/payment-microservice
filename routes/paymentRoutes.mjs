// payment-service/routes/paymentRoutes.js
import { Router } from "express";
import { getPaymentById, initiatePayment, paystackWebhook, verifyPayment } from "../controllers/paymentController.mjs";


const paymentRouter = Router();
paymentRouter.post("/initiate", initiatePayment);
paymentRouter.get("/verify/:transaction_id",verifyPayment);
paymentRouter.post("/webhook", paystackWebhook);
paymentRouter.get("/order/:order_id", getPaymentById)

export default paymentRouter;