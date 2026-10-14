
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from datetime import datetime

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class UserResponse(BaseModel):
    id: int
    email: EmailStr

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ProductCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    description: str | None = None
    price: float = Field(gt=0, le=10000000)
    category: str = Field(min_length=2, max_length=100)
    image_url: str | None = Field(default=None, max_length=500)
    stock: int = Field(default=0, ge=0, le=100000)


class ProductResponse(BaseModel):
    id: int
    name: str
    description: str | None
    price: float
    category: str
    image_url: str | None
    stock: int

    model_config = ConfigDict(from_attributes=True)

    
class CartItemCreate(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(default=1, ge=1, le=100)


class CartItemUpdate(BaseModel):
    quantity: int = Field(ge=1, le=100)


class CartItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: int

    model_config = ConfigDict(from_attributes=True)


class CartProductResponse(BaseModel):
    id: int
    name: str
    price: float
    category: str
    image_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


class CartLineResponse(BaseModel):
    id: int
    quantity: int
    product: CartProductResponse
    subtotal: float


class CartResponse(BaseModel):
    items: list[CartLineResponse]
    total: float

    
class CheckoutResponse(BaseModel):
    order_id: int
    client_secret: str
    amount: int
    currency: str
    status: str


class OrderItemResponse(BaseModel):
    product_id: int
    product_name: str
    unit_price: int
    quantity: int

    model_config = ConfigDict(from_attributes=True)


class OrderResponse(BaseModel):
    id: int
    total_amount: int
    currency: str
    status: str
    created_at: datetime
    items: list[OrderItemResponse]

    model_config = ConfigDict(from_attributes=True)