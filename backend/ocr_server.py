from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import base64
import re
import easyocr
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

print("=" * 60)
print("Starting OCR Server on Port 5002...")
print("=" * 60)

try:
    reader = easyocr.Reader(['en'], gpu=False)
    print("✓ OCR Engine loaded successfully!")
except Exception as e:
    print(f"✗ Error loading OCR: {e}")
    exit(1)

def extract_license_plate(text):
    patterns = [
        r'[A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{4}',
        r'[A-Z]{2}[0-9]{2}[A-Z]{1}[0-9]{4}',
        r'[A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{3}',
        r'[A-Z]{1}[0-9]{2}[A-Z]{2}[0-9]{4}',
        r'[A-Z]{2}[0-9]{2}[0-9]{4}[A-Z]{2}',
    ]
    
    text = text.upper().replace(' ', '').replace('-', '').replace('.', '')
    
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(0)
    
    fallback = re.search(r'[A-Z0-9]{8,10}', text)
    return fallback.group(0) if fallback else None

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'service': 'OCR Server', 'timestamp': datetime.now().isoformat()})

@app.route('/detect', methods=['POST'])
def detect_plate():
    try:
        start_time = datetime.now()
        
        data = request.json
        if not data or 'image' not in data:
            return jsonify({'plate': None, 'success': False, 'error': 'No image provided'})
        
        image_data = data['image']
        
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        img_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return jsonify({'plate': None, 'success': False, 'error': 'Failed to decode image'})
        
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        results = reader.readtext(gray)
        
        if results:
            all_text = ' '.join([result[1] for result in results])
            plate = extract_license_plate(all_text)
            
            if plate:
                processing_time = int((datetime.now() - start_time).total_seconds() * 1000)
                return jsonify({
                    'plate': plate,
                    'confidence': 85,
                    'time': processing_time,
                    'full_text': all_text[:200],
                    'success': True
                })
        
        return jsonify({'plate': None, 'success': False})
        
    except Exception as e:
        logger.error(f"Detection error: {e}")
        return jsonify({'plate': None, 'success': False, 'error': str(e)})

if __name__ == '__main__':
    print("\n" + "="*50)
    print("OCR Server Running on port 5002!")
    print("="*50)
    print("Health check: GET http://localhost:5002/health")
    print("Detection: POST http://localhost:5002/detect")
    print("="*50 + "\n")
    app.run(host='0.0.0.0', port=5002, debug=False, threaded=True)