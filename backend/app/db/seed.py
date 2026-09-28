#!/usr/bin/env python3
"""
Seed script – populates the database with realistic test data for PhysioDesk.

Usage:
    python -m app.db.seed          # from the backend/ directory
    python backend/app/db/seed.py  # from the project root
"""

import uuid
import sys
import os
from datetime import date, time, timedelta
from decimal import Decimal

# Windows consoles default to cp1252, which cannot print the emoji output
# below. Reconfigure stdout/stderr to UTF-8 (Python 3.7+).
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Ensure the backend package is importable: seed.py is at backend/app/db/seed.py,
# so the backend package root is three levels up.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..")))

from sqlalchemy.orm import Session

from backend.app.core.database import SessionLocal, engine
from backend.app.core.security import hash_password
from backend.app.db.base import Base  # noqa – triggers model registration

# Import every model so Base.metadata knows about them
from backend.app.models.user import User  # noqa: F401
from backend.app.models.therapist import Therapist  # noqa: F401
from backend.app.models.patient import Patient  # noqa: F401
from backend.app.models.therapist_override import TherapistOverride  # noqa: F401
from backend.app.models.appointment import Appointment  # noqa: F401
from backend.app.models.invoice import Invoice  # noqa: F401


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

THERAPIST_IDS = [uuid.uuid4() for _ in range(4)]
PATIENT_IDS = [uuid.uuid4() for _ in range(10)]


def _users() -> list[dict]:
    return [
        {
            "id": uuid.uuid4(),
            "email": "admin@physiodesk.com",
            "username": "admin",
            "full_name": "Dr. Admin User",
            "hashed_password": hash_password("admin123"),
            "role": "ADMIN",
        },
        {
            "id": uuid.uuid4(),
            "email": "reception@physiodesk.com",
            "username": "reception",
            "full_name": "Jane Reception",
            "hashed_password": hash_password("staff123"),
            "role": "STAFF",
        },
    ]


def _therapists() -> list[dict]:
    specs = [
        ("Dr. Sarah Chen", "Sports Injuries"),
        ("Dr. Raj Patel", "Neurological Rehab"),
        ("Dr. Maria Lopez", "Orthopedic Rehab"),
        ("Dr. James Wilson", "Pediatric Physiotherapy"),
    ]
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    return [
        {
            "id": THERAPIST_IDS[i],
            "name": name,
            "specialty": spec,
            "working_days": days,
            "start_time": time(9, 0),
            "end_time": time(17, 0),
            "slot_duration_minutes": 60,
        }
        for i, (name, spec) in enumerate(specs)
    ]


def _patients() -> list[dict]:
    data = [
        ("Amit Kumar", "9876543210", 34, "Male", "12 MG Road, Delhi", "ACL Rehabilitation", "10-Session Rehab", "Active"),
        ("Priya Singh", "9876543211", 28, "Female", "45 Park Street, Kolkata", "Lower Back Pain", "Pay-as-you-go", "Active"),
        ("Rohan Mehta", "9876543212", 45, "Male", "78 Civil Lines, Jaipur", "Post-Surgery Rehab", "10-Session Rehab", "Active"),
        ("Sneha Iyer", "9876543213", 31, "Female", "23 Anna Salai, Chennai", "Shoulder Impingement", "Pay-as-you-go", "Active"),
        ("Vikram Rao", "9876543214", 52, "Male", "90 MG Road, Bangalore", "Knee Replacement Rehab", "15-Session Rehab", "On hold"),
        ("Neha Gupta", "9876543215", 26, "Female", "56 JP Nagar, Bangalore", "Tennis Elbow", "Pay-as-you-go", "Completed"),
        ("Arjun Nair", "9876543216", 38, "Male", "12 Marine Drive, Mumbai", "Cervical Spondylosis", "10-Session Rehab", "Active"),
        ("Divya Sharma", "9876543217", 41, "Female", "33 Hazratganj, Lucknow", "Frozen Shoulder", "Pay-as-you-go", "Active"),
        ("Rahul Verma", "9876543218", 55, "Male", "8 Connaught Place, Delhi", "Sciatica", "15-Session Rehab", "On hold"),
        ("Ananya Das", "9876543219", 29, "Female", "67 Salt Lake, Kolkata", "Ankle Sprain", "Pay-as-you-go", "Completed"),
    ]
    return [
        {
            "id": PATIENT_IDS[i],
            "name": n,
            "phone": p,
            "age": a,
            "gender": g,
            "address": addr,
            "condition": cond,
            "assigned_therapist_id": THERAPIST_IDS[i % len(THERAPIST_IDS)],
            "package": pkg,
            "status": st,
        }
        for i, (n, p, a, g, addr, cond, pkg, st) in enumerate(data)
    ]


def _appointments(session: Session) -> list[dict]:
    """Generate a mix of past, today, and future appointments."""
    today = date.today()
    rows: list[dict] = []
    statuses = ["Booked", "Completed", "Cancelled"]
    times = [
        (time(9, 0), time(10, 0)),
        (time(10, 0), time(11, 0)),
        (time(11, 0), time(12, 0)),
        (time(14, 0), time(15, 0)),
        (time(15, 0), time(16, 0)),
    ]
    counter = 0
    for day_offset in [-7, -3, -1, 0, 0, 0, 1, 3, 7, 10]:
        appt_date = today + timedelta(days=day_offset)
        start, end = times[counter % len(times)]
        patient_id = PATIENT_IDS[counter % len(PATIENT_IDS)]
        therapist_id = THERAPIST_IDS[counter % len(THERAPIST_IDS)]
        if day_offset < 0:
            status = "Completed"
        elif day_offset == 0:
            status = "Booked"
        else:
            status = "Booked"
        rows.append(
            {
                "id": uuid.uuid4(),
                "patient_id": patient_id,
                "therapist_id": therapist_id,
                "date": appt_date,
                "start_time": start,
                "end_time": end,
                "status": status,
                "payment_method": "Cash" if counter % 2 == 0 else "Card",
                "notes": f"Auto-seeded appointment #{counter + 1}",
            }
        )
        counter += 1
    return rows


def _invoices() -> list[dict]:
    return [
        {
            "id": uuid.uuid4(),
            "invoice_number": f"INV-2026-{i+1:03d}",
            "patient_id": PATIENT_IDS[i % len(PATIENT_IDS)],
            "service_package": pkg,
            "amount": Decimal(str(amt)),
            "discount": Decimal(str(disc)),
            "status": st,
            "payment_method": pm,
        }
        for i, (pkg, amt, disc, st, pm) in enumerate(
            [
                ("10-Session Rehab", 5000.00, 500.00, "Paid", "Card"),
                ("Pay-as-you-go", 800.00, 0.00, "Paid", "Cash"),
                ("15-Session Rehab", 7500.00, 750.00, "Due", None),
                ("Pay-as-you-go", 800.00, 0.00, "Due", None),
                ("10-Session Rehab", 5000.00, 0.00, "Paid", "Insurance"),
                ("Pay-as-you-go", 800.00, 0.00, "Paid", "Card"),
                ("15-Session Rehab", 7500.00, 1000.00, "Due", None),
                ("Pay-as-you-go", 800.00, 0.00, "Paid", "Cash"),
            ]
        )
    ]


# ---------------------------------------------------------------------------
# Main seed routine
# ---------------------------------------------------------------------------

def seed(drop_first: bool = False) -> None:
    """Seed the database.  Pass *drop_first=True* to wipe tables first."""
    if drop_first:
        print("⚠  Dropping and recreating all tables …")
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)

    db: Session = SessionLocal()
    try:
        # Check if data already exists
        if db.query(User).first():
            print("ℹ  Data already present.  Pass --drop to re-seed.")
            return

        print("🌱 Seeding users …")
        db.add_all([User(**u) for u in _users()])

        print("🌱 Seeding therapists …")
        db.add_all([Therapist(**t) for t in _therapists()])

        print("🌱 Seeding patients …")
        db.add_all([Patient(**p) for p in _patients()])

        # Flush so FK references resolve
        db.flush()

        print("🌱 Seeding appointments …")
        db.add_all([Appointment(**a) for a in _appointments(db)])

        print("🌱 Seeding invoices …")
        db.add_all([Invoice(**i) for i in _invoices()])

        db.commit()
        print("✅ Seed complete!")
    except Exception as exc:
        db.rollback()
        print(f"❌ Seed failed: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    drop = "--drop" in sys.argv
    seed(drop_first=drop)
