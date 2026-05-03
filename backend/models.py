from sqlalchemy import Column, Integer, String, DateTime, Float, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

# Setup Database
DATABASE_URL = "sqlite:///./parking.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class ParkingSession(Base):
    __tablename__ = "parking_sessions"

    id = Column(Integer, primary_key=True, index=True)
    slot_id = Column(String, index=True)
    name = Column(String)
    license_plate = Column(String)
    start_time = Column(DateTime, default=datetime.utcnow)
    expiry_time = Column(DateTime) # This will be start_time + 12 hours
    end_time = Column(DateTime, nullable=True)
    penalty_paid = Column(Float, default=0.0)
    is_active = Column(Integer, default=1) # 1 for parked, 0 for left

# Create the tables
def init_db():
    Base.metadata.create_all(bind=engine)