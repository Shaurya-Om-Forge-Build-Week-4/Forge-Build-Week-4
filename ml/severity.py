import cv2

def compute_severity(image_path, detections):
    """
    Computes severity score (0–1) based on detected object coverage.
    """
    if not detections:
        return 0.0

    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Could not read image at {image_path}")

    h, w, _ = img.shape
    image_area = h * w

    total_weighted_area = 0.0

    for det in detections:
        x1, y1, x2, y2 = det["bbox"]
        conf = det.get("confidence", 1.0)

        box_area = max(0, (x2 - x1)) * max(0, (y2 - y1))
        total_weighted_area += box_area * conf

    severity = total_weighted_area / image_area
    return min(severity, 1.0)
