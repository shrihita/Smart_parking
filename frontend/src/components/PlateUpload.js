import React, { useState } from 'react';
import axios from 'axios';

export default function PlateUpload({ slot }) {
  const [result, setResult] = useState(null);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("plateImage", file);
    formData.append("slot", slot);

    const { data } = await axios.post("http://localhost:5000/booking/reserve", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });

    setResult(data);
  };

  return (
    <div>
      <input type="file" onChange={handleUpload} />
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}