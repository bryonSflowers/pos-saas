from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth, tenants, products, orders, locations,
    payments, categories, users, reports,
    customers, shifts, inventory_adjustments, suppliers, promotions, billing,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(tenants.router)
api_router.include_router(products.router)
api_router.include_router(orders.router)
api_router.include_router(locations.router)
api_router.include_router(payments.router)
api_router.include_router(categories.router)
api_router.include_router(users.router)
api_router.include_router(reports.router)
api_router.include_router(customers.router)
api_router.include_router(shifts.router)
api_router.include_router(inventory_adjustments.router)
api_router.include_router(suppliers.router)
api_router.include_router(promotions.router)
api_router.include_router(billing.router)
