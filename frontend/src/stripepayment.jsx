import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
);

function PaymentForm({ orderId, clientSecret, onSuccess, onCancel }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    if (!stripe || !elements) return;

    setLoading(true);
    setMessage("");

    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (result.error) {
      setMessage(result.error.message || "Payment failed.");
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem("access_token");
      const response = await fetch(
        `http://127.0.0.1:8000/orders/${orderId}/verify-payment`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Payment verification failed."
        );
      }

      if (data.status === "paid") {
        onSuccess(`Payment successful! Order #${orderId} is paid.`);
      } else {
        setMessage(data.message || "Payment is not confirmed yet.");
      }
    } catch (error) {
      setMessage(error.message || "Could not verify payment.");
    }

    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="stripe-payment-form">
      <h2>Complete Your Payment</h2>
      <p>Order #{orderId}</p>

      <PaymentElement />

      {message && <p role="alert">{message}</p>}

      <button type="submit" disabled={!stripe || loading}>
        {loading ? "Processing..." : "Pay Now"}
      </button>

      <button type="button" onClick={onCancel} disabled={loading}>
        Cancel
      </button>
    </form>
  );
}

export default function StripePayment({
  orderId,
  clientSecret,
  onSuccess,
  onCancel,
}) {
  return (
    <Elements
      stripe={stripePromise}
      options={{ clientSecret }}
    >
      <PaymentForm
        orderId={orderId}
        clientSecret={clientSecret}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    </Elements>
  );
}
