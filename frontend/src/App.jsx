import React, { useState, useEffect } from 'react';
import { bookSlot, leaveSlot } from './api';
import { Clock, Car, CreditCard, Camera } from 'lucide-react';

export default function App() {
  const [step, setStep] = useState('scan'); // States: scan -> form -> active
  const [slotId, setSlotId] = useState(null);
  const [details, setDetails] = useState({ name: '', plate: '' });
  const [timeLeft, setTimeLeft] = useState(43200); // 12 hours in seconds

  // Timer logic for the 12-hour countdown
  useEffect(() => {
    let timer;
    if (step === 'active' && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [step, timeLeft]);

  // Simulate scanning for the prototype
  const simulateScan = () => {
    const mockSlotId = "GROUND_SLOT_01";
    setSlotId(mockSlotId);
    setStep('form');
  };

  const handlePayment = async () => {
    try {
      // In a real app, this waits for the backend
      // await bookSlot(slotId, details); 
      setStep('active');
    } catch (err) { alert("Backend not connected yet!"); setStep('active'); }
  };

  const handleLeave = async () => {
    // This calls your Python logic to check if you are over 12 hours
    try {
      const res = await leaveSlot(slotId);
      if (res.data.penalty > 0) {
        alert(`Penalty applied: $${res.data.penalty}`);
      }
    } catch (e) {
      alert("Leaving space. Spot is now open for others!");
    }
    setStep('scan');
    setTimeLeft(43200);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 font-sans flex flex-col items-center">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-extrabold text-blue-400 tracking-tight">PARK-AI PRO</h1>
        <p className="text-slate-400">Smart Ground-Slot Management</p>
      </header>

      {/* STEP 1: SCANNING */}
      {step === 'scan' && (
        <div className="text-center bg-slate-800 p-10 rounded-3xl shadow-2xl border border-slate-700">
          <div className="bg-blue-500/10 p-6 rounded-full mb-6 inline-block">
            <Camera size={64} className="text-blue-500 animate-pulse" />
          </div>
          <h2 className="text-xl font-bold mb-2">Ready to Park?</h2>
          <p className="text-slate-400 mb-8">Scan the barcode on the ground slot</p>
          <button 
            onClick={simulateScan}
            className="bg-blue-600 hover:bg-blue-500 px-8 py-4 rounded-2xl font-bold transition-all transform active:scale-95"
          >
            Open Scanner
          </button>
        </div>
      )}

      {/* STEP 2: BOOKING FORM */}
      {step === 'form' && (
        <div className="w-full max-w-md bg-slate-800 p-8 rounded-3xl shadow-2xl border border-slate-700">
          <h2 className="text-2xl font-bold mb-6 flex items-center text-blue-400">
            <Car className="mr-3" /> Booking {slotId}
          </h2>
          <div className="space-y-4">
            <input 
              className="w-full bg-slate-900 border border-slate-700 p-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" 
              placeholder="Your Name" 
              onChange={e => setDetails({...details, name: e.target.value})}
            />
            <input 
              className="w-full bg-slate-900 border border-slate-700 p-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" 
              placeholder="License Plate (e.g. MH-12-AB-1234)" 
              onChange={e => setDetails({...details, plate: e.target.value})}
            />
            <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl text-sm text-blue-300">
              Note: This booking is valid for 12 hours. Penalty fees apply after expiry.
            </div>
            <button 
              onClick={handlePayment}
              className="w-full bg-green-600 hover:bg-green-500 py-4 rounded-xl font-bold flex justify-center items-center shadow-lg"
            >
              <CreditCard className="mr-2" /> Pay & Secure Slot
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: ACTIVE TIMER */}
      {step === 'active' && (
        <div className="w-full max-w-md text-center bg-slate-800 p-10 rounded-3xl shadow-2xl border-t-4 border-blue-500">
          <div className="flex justify-center mb-4 text-blue-500"><Clock size={48} /></div>
          <h2 className="text-sm uppercase tracking-widest text-slate-400 mb-2">Time Remaining</h2>
          <div className="text-6xl font-mono font-bold mb-8 text-white">
            {new Date(timeLeft * 1000).toISOString().substr(11, 8)}
          </div>
          <div className="mb-10 p-4 bg-slate-900 rounded-2xl">
            <p className="text-slate-400 text-sm">License Plate</p>
            <p className="text-xl font-bold">{details.plate || "N/A"}</p>
          </div>
          <button 
            onClick={handleLeave}
            className="w-full bg-slate-700 hover:bg-red-600 py-4 rounded-2xl font-bold transition-colors"
          >
            I am leaving the place
          </button>
        </div>
      )}
    </div>
  );
}