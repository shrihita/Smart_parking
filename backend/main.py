from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
import uvicorn

app = FastAPI()

# Enable CORS so your React app (on localhost:5173) can talk to this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for testing (use a database like SQLite for production)
active_sessions = {}

@app.post("/book/{slot_id}")
async def book_slot(slot_id: str, plate: str):
    start_time = datetime.now()
    expiry_time = start_time + timedelta(hours=12) # Setting the 12-hour limit
    
    active_sessions[slot_id] = {
        "plate": plate,
        "expiry": expiry_time
    }
    return {"status": "booked", "expiry": expiry_time}

@app.post("/leave/{slot_id}")
async def leave_slot(slot_id: str):
    if slot_id not in active_sessions:
        return {"error": "No active session found"}
    
    session = active_sessions[slot_id]
    now = datetime.now()
    penalty = 0
    
    # Logic: If current time is past the 12-hour expiry, calculate penalty
    if now > session["expiry"]:
        overdue_duration = now - session["expiry"]
        overdue_hours = overdue_duration.total_seconds() / 3600
        penalty = round(overdue_hours * 5.0, 2) # Charging $5 per extra hour

    # Clear the slot
    del active_sessions[slot_id]
    
    return {
        "status": "success",
        "penalty": penalty,
        "message": "Spot is now open for the next user"
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)