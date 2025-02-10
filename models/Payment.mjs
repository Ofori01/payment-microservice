import mongoose from "mongoose";


const paymentSchema = new mongoose.Schema(
  {
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }, // Added user reference
    payment_status: {
      type: String,
      enum: ["success", "completed", "failed"],
      default: "failed",
    },
    payment_method: { type: String },
    payment_date: { type: Date, default: Date.now },
    amount: { type: Number, required: true },
    transaction_reference: {
      type: String,
      required: true,
      unique: true,
      sparse: true,
    },
  },
  { timestamps: true }
);

const Payment = mongoose.model("payment", paymentSchema);
export default Payment;
