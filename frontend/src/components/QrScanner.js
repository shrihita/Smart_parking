import React from 'react';
import { QrReader } from 'react-qr-reader';

export default function QrScannerComponent({ onScan }) {
  return (
    <div>
      <h3>Scan Slot QR</h3>
      <QrReader
        constraints={{ facingMode: 'environment' }}
        onResult={(result, error) => {
          if (!!result) {
            onScan(result?.text);
          }
          if (!!error) {
            console.error(error);
          }
        }}
        style={{ width: '300px' }}
      />
    </div>
  );
}