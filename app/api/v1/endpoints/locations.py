from uuid import UUID
from fastapi import APIRouter, HTTPException
from sqlalchemy import select, func
from app.core.deps import SessionDep, UserDep, AdminDep
from app.core.plans import check_limit
from app.models.location import Location
from app.models.tenant import Tenant
from app.schemas.location import LocationCreate, LocationUpdate, LocationOut

router = APIRouter(prefix="/locations", tags=["locations"])


@router.get("/", response_model=list[LocationOut])
async def list_locations(session: SessionDep, user: UserDep):
    locations = await session.scalars(
        select(Location).where(Location.tenant_id == user.tenant_id).order_by(Location.name)
    )
    return locations.all()


@router.post("/", response_model=LocationOut, status_code=201)
async def create_location(body: LocationCreate, session: SessionDep, user: AdminDep):
    tenant = await session.get(Tenant, user.tenant_id)
    if tenant:
        current_count = await session.scalar(
            select(func.count(Location.id)).where(
                Location.tenant_id == user.tenant_id, Location.is_active == True
            )
        ) or 0
        allowed, limit = check_limit(tenant.plan, "locations", current_count)
        if not allowed:
            raise HTTPException(
                status_code=402,
                detail=f"Location limit reached ({limit} on your plan). Upgrade to add more."
            )
    location = Location(tenant_id=user.tenant_id, **body.model_dump())
    session.add(location)
    await session.flush()
    return location


@router.patch("/{location_id}", response_model=LocationOut)
async def update_location(location_id: UUID, body: LocationUpdate, session: SessionDep, user: AdminDep):
    location = await session.scalar(
        select(Location).where(Location.id == location_id, Location.tenant_id == user.tenant_id)
    )
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(location, k, v)
    return location


@router.delete("/{location_id}", status_code=204)
async def delete_location(location_id: UUID, session: SessionDep, user: AdminDep):
    location = await session.scalar(
        select(Location).where(Location.id == location_id, Location.tenant_id == user.tenant_id)
    )
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    # Soft delete
    location.is_active = False
