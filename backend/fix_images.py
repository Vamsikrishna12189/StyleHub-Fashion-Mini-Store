
from database import engine
from sqlalchemy import text

updates = {
    1: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600",
    3: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600",
    4: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600",
    5: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600",
}

with engine.begin() as connection:
    for product_id, image_url in updates.items():
        connection.execute(
            text("""
                UPDATE products
                SET image_url = :image_url
                WHERE id = :product_id
            """),
            {"image_url": image_url, "product_id": product_id},
        )

print("Product image URLs updated.")

with engine.connect() as connection:
    rows = connection.execute(
        text("SELECT id, name, image_url FROM products")
    )
    for row in rows:
        print(dict(row._mapping))