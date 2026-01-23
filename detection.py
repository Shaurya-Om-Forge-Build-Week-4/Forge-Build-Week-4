from ultralytics import YOLO
import os

model = YOLO("yolov8n.pt")

PROBLEM_CLASS_MAP = {
    "garbage": {
    "trash can",
    "vase",
    "cup",
    "bottle",
    "bowl",
    "container"
}

    # future:
    # "pothole": {"road"},
    # "waterlogging": {"road"}
}

def detect_objects(image_path):
    results = model(image_path, conf=0.1)
    detections = []

    r = results[0]
    for box in r.boxes:
        cls = int(box.cls)
        label = model.names[cls]
        conf = float(box.conf)
        x1, y1, x2, y2 = map(float, box.xyxy[0])

        for problem_type, labels in PROBLEM_CLASS_MAP.items():
            if label in labels:
                detections.append({
                    "problem_type": problem_type,
                    "label": label,
                    "confidence": conf,
                    "bbox": [x1, y1, x2, y2]
                })

    return detections
