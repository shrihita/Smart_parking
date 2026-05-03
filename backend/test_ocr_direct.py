import requests
import base64
import cv2

# Test with a simple image creation
def create_test_image():
    from PIL import Image, ImageDraw, ImageFont
    
    # Create a test image with a license plate
    img = Image.new('RGB', (800, 400), color='white')
    draw = ImageDraw.Draw(img)
    
    # Draw plate rectangle
    draw.rectangle([(150, 150), (650, 250)], outline='black', width=3)
    draw.rectangle([(155, 155), (645, 245)], outline='blue', width=1)
    
    # Add text
    draw.text((200, 175), "MH 12 AB 1234", fill='black')
    
    # Save
    img.save('test_plate.png')
    print("Test image created: test_plate.png")
    return 'test_plate.png'

def test_ocr_with_image(image_path):
    """Test OCR server with an image file"""
    
    # Read image
    with open(image_path, 'rb') as f:
        img_bytes = f.read()
        img_base64 = base64.b64encode(img_bytes).decode('utf-8')
    
    # Prepare request
    payload = {
        'image': f'data:image/png;base64,{img_base64}'
    }
    
    print(f"Sending {image_path} to OCR server...")
    
    try:
        response = requests.post('http://localhost:5002/detect', json=payload, timeout=30)
        result = response.json()
        
        print("\n=== OCR Result ===")
        print(f"Success: {result.get('success')}")
        print(f"Plate: {result.get('plate')}")
        print(f"Confidence: {result.get('confidence')}%")
        print(f"Full Text: {result.get('full_text')}")
        print(f"Processing Time: {result.get('time')}ms")
        
        if result.get('debug_info'):
            print(f"Debug Info: {result.get('debug_info')}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    # Create test image
    test_image = create_test_image()
    
    # Test OCR
    test_ocr_with_image(test_image)
    
    print("\n" + "="*50)
    print("To test with your own image:")
    print("python test_ocr_direct.py your_image.jpg")
    print("="*50)