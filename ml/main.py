from detection import detect_objects
from severity import compute_severity

IMAGE_PATH = "dataset_mock/nbd1/img6.jpg"

# Tunable thresholds (based on what you observed)
NOISE_THRESHOLD = 0.05       # ignore tiny detections
OVERFLOW_THRESHOLD = 0.30    # >= this is likely overflow

# Step 1: Run YOLO
detections = detect_objects(IMAGE_PATH)

# Step 2: No detections → no issue
if not detections:
    result = {
        "problem": None,
        "status": "no_issue",
        "severity": 0.0
    }

else:
    # Step 3: Compute severity
    severity = compute_severity(IMAGE_PATH, detections)

    # Step 4: Decide status
    if severity < NOISE_THRESHOLD:
        result = {
            "problem": "garbage",
            "status": "normal",
            "severity": round(severity, 3)
        }

    elif severity < OVERFLOW_THRESHOLD:
        result = {
            "problem": "garbage",
            "status": "partial_overflow",
            "severity": round(severity, 3)
        }

    else:
        result = {
            "problem": "garbage",
            "status": "potential_overflow",
            "severity": round(severity, 3)
        }

print(result)
