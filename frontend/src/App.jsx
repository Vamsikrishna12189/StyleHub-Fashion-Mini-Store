
import { useEffect, useState } from "react";
import StripePayment from "./StripePayment";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";

function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [cartCount, setCartCount] = useState(0);
  const [cartItems, setCartItems] = useState([]);
  const [cartTotal, setCartTotal] = useState(0);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartLoading, setCartLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [paymentData, setPaymentData] = useState(null);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);

  // Customer order history
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Admin order management
  const [adminOrders, setAdminOrders] = useState([]);
  const [adminOrdersLoading, setAdminOrdersLoading] = useState(false);

  // Admin dashboard and products
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminProducts, setAdminProducts] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminMessage, setAdminMessage] = useState("");

  const [adminForm, setAdminForm] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
    image_url: "",
    stock: 0,
  });

  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await fetch(`${API_URL}/products`);

        if (!response.ok) {
          throw new Error("Unable to load products.");
        }

        const data = await response.json();
        setProducts(Array.isArray(data) ? data : data.products || []);
      } catch (err) {
        console.error("Product loading error:", err);
        setError(
          "Could not connect to the store. Please check that the backend is running."
        );
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  async function handleLogin(event) {
    event.preventDefault();
    setMessage("");
    setLoginLoading(true);

    try {
      const params = new URLSearchParams({ email, password });

      const response = await fetch(
        `${API_URL}/auth/login?${params.toString()}`,
        { method: "POST" }
      );

      const data = await response.json();

      if (!response.ok) {
        const detail =
          typeof data.detail === "string"
            ? data.detail
            : JSON.stringify(data.detail || "Login failed");

        throw new Error(detail);
      }

      if (!data.access_token) {
        throw new Error("Login response did not contain an access token.");
      }

      localStorage.setItem("access_token", data.access_token);
      setLoginOpen(false);
      setPassword("");
      setMessage("Login successful! You can now add products to your cart.");
    } catch (err) {
      console.error("Login error:", err);
      setMessage(err.message || "Login failed. Please try again.");
    } finally {
      setLoginLoading(false);
    }
  }

  async function loadCart(token) {
    setCartLoading(true);

    try {
      const response = await fetch(`${API_URL}/cart`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to load cart.");
      }

      const items = Array.isArray(data.items) ? data.items : [];

      setCartItems(items);
      setCartTotal(Number(data.total || 0));
      setCartCount(
        items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
      );
    } catch (err) {
      console.error("Cart loading error:", err);
      setMessage(err.message || "Unable to load cart.");
    } finally {
      setCartLoading(false);
    }
  }

  async function handleRemoveFromCart(cartItemId) {
    const token = localStorage.getItem("access_token");

    if (!token) {
      setMessage("Please log in again.");
      setLoginOpen(true);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/cart/${cartItemId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to remove this product.");
      }

      await loadCart(token);
      setMessage("Product removed from your cart!");
    } catch (err) {
      console.error("Remove from cart error:", err);
      setMessage(err.message || "Could not remove this product.");
    }
  }

  async function handleUpdateQuantity(cartItemId, newQuantity) {
    if (newQuantity < 1) {
      return;
    }

    const token = localStorage.getItem("access_token");

    if (!token) {
      setMessage("Please log in again.");
      setLoginOpen(true);
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/cart/${cartItemId}?quantity=${newQuantity}`,
        {
          method: "PUT",
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
            : "Unable to update quantity."
        );
      }

      await loadCart(token);
      setMessage("Cart quantity updated!");
    } catch (err) {
      console.error("Update quantity error:", err);
      setMessage(err.message || "Could not update quantity.");
    }
  }

  async function handleAddToCart(product) {
    setMessage("");

    const token = localStorage.getItem("access_token");

    if (!token) {
      setMessage("Please log in before adding products to your cart.");
      setLoginOpen(true);
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/cart?product_id=${encodeURIComponent(product.id)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const detail =
          typeof data.detail === "string"
            ? data.detail
            : JSON.stringify(data.detail || "Unable to add product");

        if (response.status === 401) {
          localStorage.removeItem("access_token");
          setLoginOpen(true);
          throw new Error("Please log in again.");
        }

        throw new Error(detail);
      }

      await loadCart(token);
      setMessage(`${product.name} added to your cart!`);
    } catch (err) {
      console.error("Add to cart error:", err);
      setMessage(err.message || "Could not add this product to your cart.");
    }
  }

  async function handleCheckout() {
    setMessage("");

    const token = localStorage.getItem("access_token");

    if (!token) {
      setMessage("Please log in before checkout.");
      setLoginOpen(true);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/checkout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Unable to start checkout."
        );
      }

      setPaymentData(data);
      setPaymentMessage("");
      setPaymentOpen(true);

      setMessage(
        `Order #${data.order_id} created. Payment is ready to be completed.`
      );
    } catch (err) {
      console.error("Checkout error:", err);
      setMessage(err.message || "Checkout failed. Please try again.");
    }
  }

  // Customer order history
  async function handleViewOrders() {
    const token = localStorage.getItem("access_token");

    if (!token) {
      setMessage("Please log in to view your order history.");
      setLoginOpen(true);
      return;
    }

    setOrdersLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/orders`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Unable to load order history."
        );
      }

      setOrders(Array.isArray(data) ? data : []);

      document.getElementById("order-history")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } catch (err) {
      console.error("Order history error:", err);
      setMessage(err.message || "Unable to load order history.");
    } finally {
      setOrdersLoading(false);
    }
  }

  // Load all orders for the admin dashboard
  async function handleLoadOrders() {
    const token = localStorage.getItem("access_token");

    if (!token) {
      setAdminMessage("Please log in with your admin account first.");
      setLoginOpen(true);
      return;
    }

    setAdminOrdersLoading(true);
    setAdminMessage("");

    try {
      const response = await fetch(`${API_URL}/admin/orders`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : `Unable to load orders. Status: ${response.status}`
        );
      }

      setAdminOrders(Array.isArray(data) ? data : []);

      setAdminMessage(
        Array.isArray(data)
          ? `${data.length} order(s) loaded successfully.`
          : "Orders loaded."
      );
    } catch (err) {
      console.error("Admin orders loading error:", err);
      setAdminMessage(err.message || "Unable to load orders.");
    } finally {
      setAdminOrdersLoading(false);
    }
  }

  // Create a product
  async function handleCreateProduct(event) {
    event.preventDefault();

    const token = localStorage.getItem("access_token");

    if (!token) {
      setAdminMessage("Please log in again.");
      setLoginOpen(true);
      return;
    }

    setAdminLoading(true);
    setAdminMessage("");

    try {
      const params = new URLSearchParams({
        name: adminForm.name,
        description: adminForm.description,
        price: adminForm.price,
        category: adminForm.category,
        image_url: adminForm.image_url,
        stock: String(adminForm.stock || 0),
      });

      const response = await fetch(
        `${API_URL}/products?${params.toString()}`,
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
            : "Unable to create product."
        );
      }

      setAdminMessage("Product created successfully!");

      setAdminForm({
        name: "",
        description: "",
        price: "",
        category: "",
        image_url: "",
        stock: 0,
      });

      await handleLoadAdminProducts();

      const storeResponse = await fetch(`${API_URL}/products`);

      if (storeResponse.ok) {
        const storeData = await storeResponse.json();
        setProducts(
          Array.isArray(storeData) ? storeData : storeData.products || []
        );
      }
    } catch (err) {
      console.error("Product creation error:", err);
      setAdminMessage(err.message || "Product creation failed.");
    } finally {
      setAdminLoading(false);
    }
  }

  // Load products in the admin dashboard
  async function handleLoadAdminProducts() {
    const token = localStorage.getItem("access_token");

    if (!token) {
      setMessage("Please log in with your admin account.");
      setLoginOpen(true);
      return;
    }

    setAdminLoading(true);
    setAdminMessage("");

    try {
      const response = await fetch(`${API_URL}/admin/products`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Unable to load admin products."
        );
      }

      setAdminProducts(Array.isArray(data) ? data : data.products || []);
      setAdminOpen(true);
    } catch (err) {
      console.error("Admin products loading error:", err);
      setAdminMessage(err.message || "Could not load admin products.");
    } finally {
      setAdminLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("access_token");

    setCartCount(0);
    setCartItems([]);
    setCartTotal(0);
    setOrders([]);
    setAdminOrders([]);
    setCartOpen(false);
    setPaymentOpen(false);
    setLoginOpen(false);
    setAdminOpen(false);
    setMessage("You have logged out.");
  }

  return (
    <div className="app" id="home">
      {/* Navigation */}
      <header className="navbar">
        <a href="#home" className="logo">
          STYLE<span>HUB</span>
        </a>

        <nav className="nav-links">
          <a href="#home">Home</a>
          <a href="#categories">Categories</a>
          <a href="#products">Shop</a>
          <a href="#footer">Contact</a>
        </nav>

        <div className="nav-actions">
          <button
            type="button"
            className="login-btn"
            onClick={() => setLoginOpen((open) => !open)}
          >
            {localStorage.getItem("access_token") ? "Account" : "Login"}
          </button>

          <button
            type="button"
            className="login-btn"
            onClick={handleViewOrders}
          >
            My Orders
          </button>

          {localStorage.getItem("access_token") && (
            <>
              <button
                type="button"
                className="login-btn"
                onClick={handleLoadAdminProducts}
                disabled={adminLoading}
              >
                {adminLoading ? "Loading Admin..." : "Admin Dashboard"}
              </button>

              <button
                type="button"
                className="login-btn"
                onClick={handleLogout}
              >
                Logout
              </button>
            </>
          )}

          <button
            type="button"
            className="cart-link"
            onClick={async () => {
              const token = localStorage.getItem("access_token");

              if (!token) {
                setMessage("Please log in to view your cart.");
                setLoginOpen(true);
                return;
              }

              setCartOpen(true);
              await loadCart(token);
            }}
          >
            Cart ({cartCount})
          </button>
        </div>
      </header>

      {/* Login form */}
      {loginOpen && (
        <section className="login-panel">
          <form onSubmit={handleLogin}>
            <h2>Login to StyleHub</h2>

            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your email"
              required
            />

            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
            />

            <button type="submit" disabled={loginLoading}>
              {loginLoading ? "Logging in..." : "Login"}
            </button>

            <button type="button" onClick={() => setLoginOpen(false)}>
              Close
            </button>
          </form>
        </section>
      )}

      {/* Admin Dashboard */}
      {adminOpen && (
        <section className="orders-section" id="admin-dashboard">
          <h2>StyleHub Admin Dashboard</h2>

          <button
            type="button"
            className="login-btn"
            onClick={() => setAdminOpen(false)}
          >
            Close Dashboard
          </button>

          {adminMessage && <p role="status">{adminMessage}</p>}

          {/* Add product */}
          <h3>Add New Product</h3>

          <form onSubmit={handleCreateProduct} className="login-panel">
            <label>Product Name</label>
            <input
              value={adminForm.name}
              onChange={(e) =>
                setAdminForm({ ...adminForm, name: e.target.value })
              }
              required
            />

            <label>Description</label>
            <input
              value={adminForm.description}
              onChange={(e) =>
                setAdminForm({ ...adminForm, description: e.target.value })
              }
              required
            />

            <label>Price</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={adminForm.price}
              onChange={(e) =>
                setAdminForm({ ...adminForm, price: e.target.value })
              }
              required
            />

            <label>Category</label>
            <input
              value={adminForm.category}
              onChange={(e) =>
                setAdminForm({ ...adminForm, category: e.target.value })
              }
              required
            />

            <label>Image URL</label>
            <input
              type="url"
              value={adminForm.image_url}
              onChange={(e) =>
                setAdminForm({ ...adminForm, image_url: e.target.value })
              }
              placeholder="https://example.com/product.jpg"
            />

            <label>Stock Quantity</label>
            <input
              type="number"
              min="0"
              value={adminForm.stock}
              onChange={(e) =>
                setAdminForm({ ...adminForm, stock: e.target.value })
              }
            />

            <button type="submit" disabled={adminLoading}>
              {adminLoading ? "Saving..." : "Add Product"}
            </button>
          </form>

          {/* Existing products */}
          <h3>Existing Products</h3>

          {adminProducts.length === 0 ? (
            <p>No products found.</p>
          ) : (
            <div className="product-grid">
              {adminProducts.map((product) => (
                <article className="product-card" key={product.id}>
                  <div className="product-info">
                    <h3>{product.name}</h3>
                    <p>{product.description}</p>
                    <p>Category: {product.category}</p>
                    <p>
                      Price: ₹
                      {Number(product.price).toLocaleString("en-IN")}
                    </p>
                    <p>Stock: {product.stock ?? "Not provided"}</p>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* Admin orders */}
          <h3>Customer Orders</h3>

          <button
            type="button"
            className="login-btn"
            onClick={handleLoadOrders}
            disabled={adminOrdersLoading}
          >
            {adminOrdersLoading ? "Loading Orders..." : "Load / Refresh Orders"}
          </button>

          {adminOrdersLoading ? (
            <p>Loading customer orders...</p>
          ) : adminOrders.length === 0 ? (
            <p>No orders loaded yet. Click "Load / Refresh Orders".</p>
          ) : (
            <div className="orders-list">
              {adminOrders.map((order) => (
                <article className="order-card" key={order.order_id}>
                  <h3>Order #{order.order_id}</h3>
                  <p>Customer ID: {order.user_id}</p>

                  <p>
                    Amount: ₹
                    {(Number(order.total_amount) / 100).toLocaleString(
                      "en-IN",
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }
                    )}
                  </p>

                  <p>
                    Status: <strong>{order.status}</strong>
                  </p>

                  <p>
                    Date:{" "}
                    {order.created_at
                      ? new Date(order.created_at).toLocaleString("en-IN")
                      : "Not available"}
                  </p>

                  <h4>Items</h4>

                  {order.items?.length ? (
                    <div className="order-items">
                      {order.items.map((item, index) => (
                        <div
                          className="order-item"
                          key={`${order.order_id}-${index}`}
                        >
                          <p>
                            <strong>{item.product_name}</strong>
                          </p>
                          <p>Quantity: {item.quantity}</p>
                          <p>
                            Unit price: ₹
                            {(Number(item.unit_price) / 100).toFixed(2)}
                          </p>
                          <p>
                            Item total: ₹
                            {(
                              (Number(item.line_total) ||
                                Number(item.unit_price) *
                                  Number(item.quantity)) / 100
                            ).toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>No item details available.</p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Store message */}
      {message && (
        <div className="store-message" role="status">
          <p>{message}</p>
          <button type="button" onClick={() => setMessage("")}>
            ×
          </button>
        </div>
      )}

      {/* Customer order history */}
      <section className="orders-section" id="order-history">
        <h2>My Order History</h2>

        {ordersLoading ? (
          <p>Loading your orders...</p>
        ) : orders.length === 0 ? (
          <p>No orders found yet. Click My Orders to load your purchases.</p>
        ) : (
          <div className="orders-list">
            {orders.map((order) => (
              <article className="order-card" key={order.order_id}>
                <h3>Order #{order.order_id}</h3>

                <p>
                  Date:{" "}
                  {order.created_at
                    ? new Date(order.created_at).toLocaleString("en-IN")
                    : "Not available"}
                </p>

                <p>
                  Status: <strong>{order.status}</strong>
                </p>

                <h4>Products Purchased</h4>

                {!order.items || order.items.length === 0 ? (
                  <p>Product details are not available for this order.</p>
                ) : (
                  <div className="order-items">
                    {order.items.map((item, index) => (
                      <div
                        className="order-item"
                        key={`${order.order_id}-${index}`}
                      >
                        <p>
                          <strong>{item.product_name}</strong>
                        </p>
                        <p>
                          Price: ₹{(item.unit_price / 100).toFixed(2)}
                        </p>
                        <p>Quantity: {item.quantity}</p>
                        <p>
                          Item total: ₹
                          {(
                            (item.line_total ??
                              item.unit_price * item.quantity) / 100
                          ).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <h4>
                  Order Total: ₹
                  {(order.total_amount / 100).toFixed(2)}
                </h4>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Shopping cart */}
      {cartOpen && (
        <section className="cart-section" id="shopping-cart">
          <h2>Your Shopping Cart</h2>

          <button type="button" onClick={() => setCartOpen(false)}>
            Continue Shopping
          </button>

          {cartLoading ? (
            <p>Loading your cart...</p>
          ) : cartItems.length === 0 ? (
            <p>Your cart is empty. Add some products to get started!</p>
          ) : (
            <>
              {cartItems.map((item) => (
                <div className="cart-item" key={item.cart_item_id}>
                  <div>
                    <h3>{item.product_name}</h3>

                    <p>
                      Price: ₹
                      {Number(item.price).toLocaleString("en-IN")}
                    </p>

                    <div className="quantity-controls">
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateQuantity(
                            item.cart_item_id,
                            Number(item.quantity) - 1
                          )
                        }
                        disabled={Number(item.quantity) <= 1}
                      >
                        −
                      </button>

                      <span>{item.quantity}</span>

                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateQuantity(
                            item.cart_item_id,
                            Number(item.quantity) + 1
                          )
                        }
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleRemoveFromCart(item.cart_item_id)
                      }
                    >
                      Remove
                    </button>

                    <p>
                      Subtotal: ₹
                      {Number(item.subtotal).toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
              ))}

              <h3>Total: ₹{cartTotal.toLocaleString("en-IN")}</h3>

              <button
                type="button"
                className="checkout-btn"
                onClick={handleCheckout}
                disabled={cartItems.length === 0 || cartLoading}
              >
                Proceed to Checkout
              </button>

              {paymentOpen &&
                paymentData &&
                paymentData.client_secret && (
                  <div className="payment-section">
                    <StripePayment
                      orderId={paymentData.order_id}
                      clientSecret={paymentData.client_secret}
                      onSuccess={async (successMessage) => {
                        setPaymentMessage(successMessage);
                        setPaymentOpen(false);

                        const token = localStorage.getItem("access_token");

                        if (token) {
                          await loadCart(token);
                        }

                        await handleViewOrders();
                      }}
                      onCancel={() => {
                        setPaymentOpen(false);
                      }}
                    />
                  </div>
                )}

              {paymentMessage && (
                <p role="status">{paymentMessage}</p>
              )}
            </>
          )}
        </section>
      )}

      {/* Hero */}
      <section className="hero">
        <div className="hero-content">
          <p className="section-label">NEW SEASON · NEW YOU</p>

          <h1>
            Style that
            <br />
            speaks <span>you.</span>
          </h1>

          <p>
            Discover everyday essentials and statement pieces made for your
            own kind of style.
          </p>

          <a href="#products" className="shop-now-btn">
            Shop Collection
          </a>
        </div>
      </section>

      {/* Categories */}
      <section className="categories" id="categories">
        <p className="section-label">EXPLORE YOUR STYLE</p>
        <h2>Shop by Category</h2>

        <div className="category-grid">
          <a href="#products" className="category-card">
            <div className="category-icon">✦</div>
            <h3>Women's Fashion</h3>
            <p>Everyday looks and statement styles</p>
          </a>

          <a href="#products" className="category-card">
            <div className="category-icon">◇</div>
            <h3>Men's Fashion</h3>
            <p>Classic pieces for modern living</p>
          </a>

          <a href="#products" className="category-card">
            <div className="category-icon">♡</div>
            <h3>Accessories</h3>
            <p>The finishing touches you love</p>
          </a>
        </div>
      </section>

      {/* Products */}
      <section className="products-section" id="products">
        <p className="section-label">CURATED FOR YOU</p>
        <h2>Our Collection</h2>
        <p className="section-description">
          Find your next favourite piece.
        </p>

        {loading ? (
          <p className="loading-message">Loading products...</p>
        ) : error ? (
          <div className="error-message">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
            >
              Try Again
            </button>
          </div>
        ) : products.length === 0 ? (
          <p>No products are available yet.</p>
        ) : (
          <div className="product-grid">
            {products.map((product) => (
              <article className="product-card" key={product.id}>
                <div className="product-image">
                  <img
                    src={
                      product.image_url ||
                      "https://placehold.co/500x600?text=StyleHub"
                    }
                    alt={product.name}
                    loading="lazy"
                  />
                </div>

                <div className="product-info">
                  <p className="product-category">
                    {product.category || "Fashion"}
                  </p>

                  <h3>{product.name}</h3>

                  <p className="product-price">
                    ₹{Number(product.price).toLocaleString("en-IN")}
                  </p>

                  <button
                    type="button"
                    className="add-to-cart-btn"
                    onClick={() => handleAddToCart(product)}
                  >
                    Add to Cart
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Newsletter */}
      <section className="newsletter">
        <p className="section-label">STAY IN STYLE</p>
        <h2>A little more style in your inbox.</h2>
        <p>Discover new arrivals and everyday inspiration.</p>
      </section>

      {/* Footer */}
      <footer className="footer" id="footer">
        <a href="#home" className="logo">
          STYLE<span>HUB</span>
        </a>

        <p>
          Style made simple. © {new Date().getFullYear()} StyleHub.
        </p>
      </footer>
    </div>
  );
}

export default App;
