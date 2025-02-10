import express from "express";
import paymentRouter from "./routes/paymentRoutes.mjs";
import mongoose from "mongoose";

const app = express();
app.use(express.json());

mongoose.connect(process.env.MONGO_URI_PAYMENTS, {
}).then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.log(err));

app.use(paymentRouter);

const port = process.env.PORT || 8081;
app.listen(port, () => {
  console.log(`Payment Service running on port ${port}`);
});