
import os

import stripe
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import jwt, JWTError

from database import Base, engine, get_db
from models import User, Product, CartItem, Order, OrderItem
from security import (
    hash_password,
    verify_password,
    create_access_token,
    JWT_SECRET_KEY,
    JWT_ALGORITHM,
)
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))
# ==========================================
# ENVIRONMENT AND APPLICATION SETUP
# ==========================================


ENV_FILE = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(dotenv_path=ENV_FILE, override=True)

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

app = FastAPI(title="StyleHub API")

@app.get("/debug-admin-config")
def debug_admin_config():
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    admin_email = os.getenv("ADMIN_EMAIL", "").strip()

    return {
        "env_file_exists": os.path.isfile(env_path),
        "admin_email_loaded": bool(admin_email),
        "env_file_path": env_path,
    }


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

bearer_scheme = HTTPBearer()


# ==========================================
# AUTHENTICATION
# ==========================================

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
        )

        user_id = payload.get("sub")

        if user_id is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token",
            )

        user_id = int(user_id)

    except (JWTError, ValueError, TypeError):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired authentication token",
        )

    user = db.query(User).filter(User.id == user_id).first()

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="User not found",
        )

    return user



ENV_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(dotenv_path=ENV_FILE, override=True)
# ==========================================
# ADMIN AUTHENTICATION
# ==========================================

def get_current_admin(
    current_user: User = Depends(get_current_user),
):
    admin_email = os.getenv("ADMIN_EMAIL", "").strip().lower()

    if not admin_email:
        raise HTTPException(
            status_code=500,
            detail="Admin email is not configured",
        )

    if current_user.email.strip().lower() != admin_email:
        raise HTTPException(
            status_code=403,
            detail="Admin access required",
        )

    return current_user


# ==========================================
# HOME
# ==========================================

@app.get("/")
def home():
    return {
        "message": "Welcome to StyleHub API",
        "status": "running",
    }


# ==========================================
# REGISTER
# ==========================================

@app.post("/auth/register")
def register(
    name: str,
    email: str,
    password: str,
    db: Session = Depends(get_db),
):
    existing_user = db.query(User).filter(
        User.email == email
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email is already registered",
        )

    try:
        hashed_password = hash_password(password)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    user = User(
        name=name,
        email=email,
        hashed_password=hashed_password,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "message": "Registration successful",
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
    }


# ==========================================
# LOGIN
# ==========================================

@app.post("/auth/login")
def login(
    email: str,
    password: str,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(
        User.email == email
    ).first()

    if not user or not verify_password(
        password,
        user.hashed_password,
    ):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password",
        )

    return {
        "access_token": create_access_token(user.id),
        "token_type": "bearer",
        "user_id": user.id,
    }


# ==========================================
# CURRENT USER PROFILE
# ==========================================

@app.get("/auth/me")
def get_my_profile(
    current_user: User = Depends(get_current_user),
):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
    }


# ==========================================
# PRODUCTS
# ==========================================


@app.post("/products")
def create_product(
    name: str,
    description: str,
    price: float,
    category: str,
    image_url: str = "",
    stock: int = 0,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    if price < 0 or stock < 0:
        raise HTTPException(
            status_code=400,
            detail="Price and stock cannot be negative",
        )

    product = Product(
        name=name,
        description=description,
        price=price,
        category=category,
        image_url=image_url,
        stock=stock,
    )

    db.add(product)
    db.commit()
    db.refresh(product)

    return product


@app.get("/products")
def get_products(db: Session = Depends(get_db)):
    return db.query(Product).all()


@app.get("/admin/products")
def get_admin_products(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    return db.query(Product).all()


@app.get("/products/{product_id}")
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(
        Product.id == product_id
    ).first()

    if product is None:
        raise HTTPException(
            status_code=404,
            detail="Product not found",
        )

    return product


# ==========================================
# CART
# ==========================================

@app.post("/cart")
def add_to_cart(
    product_id: int,
    quantity: int = 1,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if quantity < 1:
        raise HTTPException(
            status_code=400,
            detail="Quantity must be at least 1",
        )

    product = db.query(Product).filter(
        Product.id == product_id
    ).first()

    if product is None:
        raise HTTPException(
            status_code=404,
            detail="Product not found",
        )

    cart_item = db.query(CartItem).filter(
        CartItem.user_id == current_user.id,
        CartItem.product_id == product_id,
    ).first()

    requested_quantity = quantity

    if cart_item:
        requested_quantity += cart_item.quantity

    if requested_quantity > product.stock:
        raise HTTPException(
            status_code=400,
            detail="Not enough stock available",
        )

    if cart_item:
        cart_item.quantity = requested_quantity
    else:
        cart_item = CartItem(
            user_id=current_user.id,
            product_id=product_id,
            quantity=quantity,
        )
        db.add(cart_item)

    db.commit()
    db.refresh(cart_item)

    return {
        "message": "Product added to cart",
        "cart_item_id": cart_item.id,
        "product_id": product.id,
        "quantity": cart_item.quantity,
    }


@app.get("/cart")
def get_cart(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items = db.query(CartItem).filter(
        CartItem.user_id == current_user.id
    ).all()

    result = []
    total = 0.0

    for item in items:
        product = db.query(Product).filter(
            Product.id == item.product_id
        ).first()

        if product is None:
            continue

        subtotal = product.price * item.quantity
        total += subtotal

        result.append({
            "cart_item_id": item.id,
            "product_id": product.id,
            "product_name": product.name,
            "price": product.price,
            "quantity": item.quantity,
            "subtotal": round(subtotal, 2),
        })

    return {
        "items": result,
        "total": round(total, 2),
    }


@app.put("/cart/{cart_item_id}")
def update_cart_item(
    cart_item_id: int,
    quantity: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if quantity < 1:
        raise HTTPException(
            status_code=400,
            detail="Quantity must be at least 1",
        )

    item = db.query(CartItem).filter(
        CartItem.id == cart_item_id,
        CartItem.user_id == current_user.id,
    ).first()

    if item is None:
        raise HTTPException(
            status_code=404,
            detail="Cart item not found",
        )

    product = db.query(Product).filter(
        Product.id == item.product_id
    ).first()

    if product is None or quantity > product.stock:
        raise HTTPException(
            status_code=400,
            detail="Requested quantity exceeds available stock",
        )

    item.quantity = quantity
    db.commit()
    db.refresh(item)

    return {
        "message": "Cart updated",
        "cart_item_id": item.id,
        "quantity": item.quantity,
    }


@app.delete("/cart/{cart_item_id}")
def remove_cart_item(
    cart_item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = db.query(CartItem).filter(
        CartItem.id == cart_item_id,
        CartItem.user_id == current_user.id,
    ).first()

    if item is None:
        raise HTTPException(
            status_code=404,
            detail="Cart item not found",
        )

    db.delete(item)
    db.commit()

    return {"message": "Cart item removed"}


# ==========================================
# STRIPE CHECKOUT
# ==========================================

@app.post("/checkout")
def checkout(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not stripe.api_key:
        raise HTTPException(
            status_code=500,
            detail="Stripe secret key is not configured",
        )

    cart_items = db.query(CartItem).filter(
        CartItem.user_id == current_user.id
    ).all()

    if not cart_items:
        raise HTTPException(
            status_code=400,
            detail="Your cart is empty",
        )

    total_paise = 0
    order_items_data = []

    for item in cart_items:
        product = db.query(Product).filter(
            Product.id == item.product_id
        ).first()

        if product is None:
            raise HTTPException(
                status_code=400,
                detail="A product in your cart no longer exists",
            )

        if item.quantity > product.stock:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for {product.name}",
            )

        unit_price_paise = round(product.price * 100)
        total_paise += unit_price_paise * item.quantity

        order_items_data.append({
            "product_id": product.id,
            "product_name": product.name,
            "unit_price": unit_price_paise,
            "quantity": item.quantity,
        })

    if total_paise <= 0:
        raise HTTPException(
            status_code=400,
            detail="Order total must be greater than zero",
        )

    order = Order(
        user_id=current_user.id,
        total_amount=total_paise,
        currency="inr",
        status="pending",
    )

    db.add(order)
    db.flush()

    for data in order_items_data:
        db.add(
            OrderItem(
                order_id=order.id,
                product_id=data["product_id"],
                product_name=data["product_name"],
                unit_price=data["unit_price"],
                quantity=data["quantity"],
            )
        )

    db.commit()
    db.refresh(order)

    try:
        intent = stripe.PaymentIntent.create(
            amount=total_paise,
            currency="inr",
            automatic_payment_methods={
                "enabled": True,
                "allow_redirects": "never",
            },
            metadata={
                "order_id": str(order.id),
                "user_id": str(current_user.id),
            },
            idempotency_key=f"stylehub-order-{order.id}",
        )

        order.stripe_payment_intent_id = intent.id
        db.commit()

        return {
            "order_id": order.id,
            "client_secret": intent.client_secret,
            "amount": total_paise,
            "currency": "inr",
            "status": order.status,
        }

    except stripe.StripeError as exc:
        print(
            "Stripe checkout error:",
            type(exc).__name__,
            str(exc),
        )

        order.status = "payment_failed"
        db.commit()

        raise HTTPException(
            status_code=502,
            detail="Stripe could not initialize the payment",
        )


# ==========================================
# VERIFY STRIPE PAYMENT
# ==========================================

@app.post("/orders/{order_id}/verify-payment")
def verify_payment(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == current_user.id,
    ).first()

    if order is None:
        raise HTTPException(
            status_code=404,
            detail="Order not found",
        )

    if not order.stripe_payment_intent_id:
        raise HTTPException(
            status_code=400,
            detail="No Stripe payment is associated with this order",
        )

    try:
        intent = stripe.PaymentIntent.retrieve(
            order.stripe_payment_intent_id
        )

        metadata = intent.metadata.to_dict()

        if (
            str(metadata.get("order_id")) != str(order.id)
            or str(metadata.get("user_id")) != str(current_user.id)
            or int(intent.amount) != int(order.total_amount)
            or intent.currency.lower() != order.currency.lower()
        ):
            raise HTTPException(
                status_code=400,
                detail="Payment details do not match this order",
            )

        if intent.status != "succeeded":
            return {
                "order_id": order.id,
                "status": intent.status,
                "message": "Payment has not succeeded yet",
            }

        order.status = "paid"

        db.query(CartItem).filter(
            CartItem.user_id == current_user.id
        ).delete(synchronize_session=False)

        db.commit()
        db.refresh(order)

        return {
            "order_id": order.id,
            "status": order.status,
            "message": "Payment verified successfully",
        }

    except stripe.StripeError as exc:
        print(
            "Stripe verification error:",
            type(exc).__name__,
            str(exc),
        )

        raise HTTPException(
            status_code=502,
            detail="Could not verify payment with Stripe",
        )


# ==========================================
# ORDER HISTORY
# ==========================================

@app.get("/orders")
def get_order_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    orders = (
        db.query(Order)
        .filter(Order.user_id == current_user.id)
        .order_by(Order.created_at.desc())
        .all()
    )

    return [
        {
            "order_id": order.id,
            "total_amount": order.total_amount,
            "currency": order.currency,
            "status": order.status,
            "payment_intent_id": order.stripe_payment_intent_id,
            "created_at": (
                order.created_at.isoformat()
                if order.created_at
                else None
            ),
            "items": [
                {
                    "product_name": item.product_name,
                    "unit_price": item.unit_price,
                    "quantity": item.quantity,
                    "line_total": item.unit_price * item.quantity,
                }
                for item in order.items
            ],
        }
        for order in orders
    ]


@app.get("/orders/{order_id}")
def get_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == current_user.id,
    ).first()

    if order is None:
        raise HTTPException(
            status_code=404,
            detail="Order not found",
        )

    items = db.query(OrderItem).filter(
        OrderItem.order_id == order.id
    ).all()

    return {
        "id": order.id,
        "total_amount": order.total_amount,
        "currency": order.currency,
        "status": order.status,
        "created_at": (
            order.created_at.isoformat()
            if order.created_at
            else None
        ),
        "items": [
            {
                "product_id": item.product_id,
                "product_name": item.product_name,
                "unit_price": item.unit_price,
                "quantity": item.quantity,
            }
            for item in items
        ],
    }

# ==========================================
# ADMIN ORDER MANAGEMENT
# ==========================================


# ==========================================
# ADMIN ORDER MANAGEMENT
# ==========================================

@app.get("/admin/orders")
def get_all_orders(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    orders = (
        db.query(Order)
        .order_by(Order.created_at.desc())
        .all()
    )

    return [
        {
            "order_id": order.id,
            "user_id": order.user_id,
            "total_amount": order.total_amount,
            "currency": order.currency,
            "status": order.status,
            "payment_intent_id": order.stripe_payment_intent_id,
            "created_at": (
                order.created_at.isoformat()
                if order.created_at
                else None
            ),
            "items": [
                {
                    "product_name": item.product_name,
                    "unit_price": item.unit_price,
                    "quantity": item.quantity,
                    "line_total": item.unit_price * item.quantity,
                }
                for item in order.items
            ],
        }
        for order in orders
    ]

@app.put("/products/{product_id}/image")
def update_product_image(
    product_id: int,
    image_url: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    product = db.query(Product).filter(
        Product.id == product_id
    ).first()

    if product is None:
        raise HTTPException(
            status_code=404,
            detail="Product not found",
        )

    product.image_url = image_url
    db.commit()
    db.refresh(product)

    return {
        "message": "Product image updated successfully",
        "product_id": product.id,
        "image_url": product.image_url,
    }

