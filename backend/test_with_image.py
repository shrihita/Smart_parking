import requests
import base64
import sys

def test_ocr_with_image(image_path):
    """Test OCR server with an image file"""
    
    # Read and encode image
    with open(image_path, 'rb') as f:
        img_bytes = f.read()
        img_base64 = base64.b64encode(img_bytes).decode('utf-8')
    
    # Prepare request
    payload = {
        'image': f'data:image/jpeg;base64,{img_base64}',
        'debug': True  # Enable debug mode to save images
    }
    
    # Send to OCR server
    print(f"Sending image {image_path} to OCR server...")
    response = requests.post('http://localhost:5002/detect', json=payload)
    
    if response.status_code == 200:
        result = response.json()
        print("\n=== OCR Results ===")
        print(f"License Plate: {result.get('plate')}")
        print(f"Confidence: {result.get('confidence')}%")
        print(f"Processing Time: {result.get('time')}ms")
        print(f"Full Text: {result.get('full_text')}")
        print(f"Success: {result.get('success')}")
        
        if result.get('debug_image'):
            print(f"Debug image saved as: {result.get('debug_image')}")
    else:
        print(f"Error: {response.status_code}")
        print(response.text)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python test_with_image.py <image_path>")
        print("Example: python test_with_image.py license_plate.jpg")
    else:
        test_ocr_with_image(sys.argv[1])