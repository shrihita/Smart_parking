import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SlotBooking from './components/SlotBooking';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SlotBooking />} />
        <Route path="/slot/:id" element={<SlotBooking />} />
      </Routes>
    </Router>
  );
}

export default App;