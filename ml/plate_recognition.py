import cv2
import pytesseract
import sys

def extract_plate_text(image_path):
    img = cv2.imread(image_path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    text = pytesseract.image_to_string(gray, config='--psm 8')
    return text.strip()

if __name__ == "__main__":
    image_path = sys.argv[1]
    plate = extract_plate_text(image_path)
    print(plate)