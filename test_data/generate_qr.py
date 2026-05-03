import qrcode

base_url = "https://monday-kilobyte-chili.ngrok-free.dev/"

def generate_single_qr():
    img = qrcode.make(base_url)
    filename = "parking-app2.png"
    img.save(filename)
    print(f"Single QR code generated: {base_url} → {filename}")

generate_single_qr()