
import os
import stripe
from dotenv import load_dotenv

from database import SessionLocal
from models import Order

# Load environment variables from .env
load_dotenv()

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")

if not STRIPE_SECRET_KEY:
    raise RuntimeError(
        "STRIPE_SECRET_KEY is missing. Check your backend .env file."
    )

if not STRIPE_SECRET_KEY.startswith("sk_test_"):
    raise RuntimeError(
        "Safety check failed: Use a Stripe TEST secret key only."
    )

stripe.api_key = STRIPE_SECRET_KEY


def confirm_test_payment():
    db = SessionLocal()

    try:
        # Find Order 9
        order = db.query(Order).filter(Order.id == 9).first()

        if order is None:
            print("Order 9 was not found in the database.")
            return

        if not order.stripe_payment_intent_id:
            print("This order has no Stripe PaymentIntent ID.")
            return

        payment_intent_id = order.stripe_payment_intent_id

        print("Order ID:", order.id)
        print("PaymentIntent ID:", payment_intent_id)

        # Retrieve the existing PaymentIntent from Stripe
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)

        print("Current Stripe status:", intent.status)

        # Verify that the PaymentIntent belongs to this order
        metadata = intent.metadata.to_dict() if intent.metadata else {}

        if metadata.get("order_id") != str(order.id):
            print("ERROR: PaymentIntent order ID does not match.")
            return

        if metadata.get("user_id") != str(order.user_id):
            print("ERROR: PaymentIntent user ID does not match.")
            return

        if int(intent.amount) != int(order.total_amount):
            print("ERROR: Payment amount does not match the order.")
            return

        if intent.currency.lower() != order.currency.lower():
            print("ERROR: Payment currency does not match the order.")
            return

        # Confirm only if the payment still needs a payment method
        if intent.status in (
            "requires_payment_method",
            "requires_confirmation",
        ):
            print("Confirming payment using Stripe test Visa...")

            intent = stripe.PaymentIntent.confirm(
                payment_intent_id,
                payment_method="pm_card_visa",
                return_url="http://localhost:5173",
            )

            print("Updated Stripe status:", intent.status)

        # Never manually mark an order as paid here
        if intent.status == "succeeded":
            print("SUCCESS: Stripe test payment completed.")
            print(
                "Next step: Verify the order using "
                "POST /orders/9/verify-payment in Swagger."
            )
        elif intent.status == "requires_action":
            print("Payment requires additional authentication.")
            print(
                "Use a Stripe test frontend to complete "
                "the authentication flow."
            )
        else:
            print("Payment is not complete.")
            print("Current status:", intent.status)
            print(
                "The order has not been manually marked as paid."
            )

    except stripe.StripeError as error:
        print("Stripe error:", str(error))

    except Exception as error:
        print("Unexpected error:", str(error))

    finally:
        db.close()


if __name__ == "__main__":
    confirm_test_payment()