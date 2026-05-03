import qrcode
import os

# Create a folder for the images
if not os.path.exists('qr_codes'):
    os.makedirs('qr_codes')

# List of parking spots to generate
parking_spots = ["SLOT_A1", "SLOT_A2", "SLOT_B1", "SLOT_B2"]

def generate_parking_qrs():
    for spot in parking_spots:
        # The QR stores the ID of the ground space
        qr = qrcode.QRCode(version=1, box_size=10, border=4)
        qr.add_data(spot)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")
        file_path = f"qr_codes/{spot}.png"
        img.save(file_path)
        print(f"Generated QR for {spot} at {file_path}")

if __name__ == "__main__":
    generate_parking_qrs()