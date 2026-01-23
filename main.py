from detection import detect_objects
from severity import compute_severity

try:
    from geminioverflow import classify_overflow
    GEMINI_ENABLED = True
except ImportError:
    GEMINI_ENABLED = False

IMAGE_PATH = "ml/dataset_mock/nbd1/img2.jpg"
SEVERITY_THRESHOLD = 0.10   # lower = more sensitive

# Step 1: Run YOLO (broad perception)
detections = detect_objects(IMAGE_PATH)

# Step 2: If YOLO sees NOTHING at all, safe to say no issue
if not detections:
    result = {
        "problem": None,
        "status": "no_issue"
    }

else:
    # Step 3: Compute severity on ALL suspicious detections
    severity = compute_severity(IMAGE_PATH, detections)

    if severity <= SEVERITY_THRESHOLD:
        # Something exists, but looks harmless
        result = {
            "problem": "garbage",
            "status": "normal",
            "severity": round(severity, 3)
        }

    else:
        # Step 4: Potential problem → semantic check
        result = {
            "problem": "garbage",
            "status": "potential_overflow",
            "severity": round(severity, 3)
        }

        if GEMINI_ENABLED:
            try:
                gemini_result = classify_overflow(IMAGE_PATH)
                result["status"] = gemini_result.get(
                    "status", "potential_overflow"
                )
            except Exception as e:
                print("Gemini error:", e)

print(result)
