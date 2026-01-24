import json
from typing import Dict, List, Tuple, Literal, Optional
from dataclasses import dataclass
import cv2
import numpy as np
from pathlib import Path
from supabase import create_client, Client
import os
from datetime import datetime


# ========== SUPABASE CONFIGURATION ==========
SUPABASE_URL = "https://boocborspzmgivjqrahr.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvb2Nib3JzcHptZ2l2anFyYWhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwOTI2MzMsImV4cCI6MjA4NDY2ODYzM30.paJIHp7a5kvmHbSt43WednMKEKMkmMr3wC0l_yJZfi4"
# ============================================

# Try to import vision libraries
try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False
    print("Warning: ultralytics not installed. Install with: pip install ultralytics")


def extract_locality(image_path: str) -> str:
    """
    Extract locality from image path.

    Examples:
    dataset_mock/Sector 1/trash_p2.jpg -> Sector 1
    dataset_mock/Sector 3/waterlog_p4.jpg -> Sector 3
    """
    parts = image_path.replace("\\", "/").split("/")
    for part in parts:
        part_clean = part.strip()
        if part_clean.lower().startswith("sector"):
            return part_clean
    return None



@dataclass
class DetectedObject:
    """Represents an object detected by the vision model"""
    label: str
    confidence: float
    bbox: Tuple[int, int, int, int]  # x, y, width, height
    area_percentage: float  # percentage of image occupied


@dataclass
class ImageAnalysis:
    """Container for vision model output"""
    width: int
    height: int
    detected_objects: List[DetectedObject]


class VisionModelWrapper:
    """Wrapper for computer vision models to detect objects in images"""
    
    def __init__(self, model_type: str = "yolo"):
        """
        Initialize vision model.
        
        Args:
            model_type: Type of model to use ("yolo" or "mock")
        """
        self.model_type = model_type
        
        if model_type == "yolo" and YOLO_AVAILABLE:
            # Load YOLOv8 model (will download on first use)
            self.model = YOLO('yolov8n.pt')  # nano version for speed
        elif model_type == "mock":
            self.model = None
            print("Using mock detection for testing")
        else:
            raise ValueError(f"Model type '{model_type}' not available")
    
    def process_image(self, image_path: str) -> Tuple[ImageAnalysis, np.ndarray]:
        """
        Process image and return detected objects + raw image.
        
        Args:
            image_path: Path to image file
            
        Returns:
            Tuple of (ImageAnalysis object, raw image array)
        """
        # Load image
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"Could not load image: {image_path}")
        
        height, width = img.shape[:2]
        image_area = width * height
        
        if self.model_type == "yolo":
            analysis = self._process_with_yolo(img, width, height, image_area)
        else:
            analysis = self._process_with_mock(img, width, height, image_area)
        
        return analysis, img
    
    def _process_with_yolo(self, img, width, height, image_area) -> ImageAnalysis:
        """Process image with YOLO model"""
        results = self.model(img, verbose=False)[0]
        
        detected_objects = []
        
        for box in results.boxes:
            # Get box coordinates
            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
            bbox_width = x2 - x1
            bbox_height = y2 - y1
            bbox_area = bbox_width * bbox_height
            
            # Calculate area percentage
            area_percentage = (bbox_area / image_area) * 100
            
            # Get label and confidence
            class_id = int(box.cls[0])
            label = results.names[class_id]
            confidence = float(box.conf[0])
            
            detected_objects.append(DetectedObject(
                label=label,
                confidence=confidence,
                bbox=(int(x1), int(y1), int(bbox_width), int(bbox_height)),
                area_percentage=area_percentage
            ))
        
        return ImageAnalysis(
            width=width,
            height=height,
            detected_objects=detected_objects
        )
    
    def _process_with_mock(self, img, width, height, image_area) -> ImageAnalysis:
        """
        Mock detector for testing without a real vision model.
        Uses simple heuristics based on image colors/regions.
        """
        detected_objects = []
        
        # Convert to HSV for better color detection
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # 1. Detect dark regions (potential potholes)
        _, dark_regions = cv2.threshold(gray, 50, 255, cv2.THRESH_BINARY_INV)
        contours, _ = cv2.findContours(dark_regions, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        for contour in contours:
            area = cv2.contourArea(contour)
            if area > (image_area * 0.02):  # At least 2% of image
                x, y, w, h = cv2.boundingRect(contour)
                detected_objects.append(DetectedObject(
                    label="pothole",
                    confidence=0.7,
                    bbox=(x, y, w, h),
                    area_percentage=(area / image_area) * 100
                ))
        
        # 2. Detect road-like surfaces (gray/dark regions in lower half)
        lower_half = gray[height//2:, :]
        road_pixels = np.sum((lower_half > 30) & (lower_half < 150))
        road_percentage = (road_pixels / image_area) * 100
        
        if road_percentage > 30:
            detected_objects.append(DetectedObject(
                label="road",
                confidence=0.8,
                bbox=(0, height//2, width, height//2),
                area_percentage=road_percentage
            ))
        
        # 3. Detect colorful clutter (potential garbage)
        saturation = hsv[:, :, 1]
        high_sat = saturation > 100
        high_sat_percentage = (np.sum(high_sat) / image_area) * 100
        
        if high_sat_percentage > 5:
            high_sat_uint8 = high_sat.astype(np.uint8) * 255
            contours, _ = cv2.findContours(high_sat_uint8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            for contour in contours:
                area = cv2.contourArea(contour)
                if area > (image_area * 0.01):
                    x, y, w, h = cv2.boundingRect(contour)
                    detected_objects.append(DetectedObject(
                        label="clutter",
                        confidence=0.6,
                        bbox=(x, y, w, h),
                        area_percentage=(area / image_area) * 100
                    ))
        
        # 4. Detect bright objects in upper portion (potential street lights)
        upper_third = gray[:height//3, :]
        _, bright_regions = cv2.threshold(upper_third, 200, 255, cv2.THRESH_BINARY)
        contours, _ = cv2.findContours(bright_regions, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        for contour in contours:
            area = cv2.contourArea(contour)
            if area > (image_area * 0.001) and area < (image_area * 0.05):  # Small bright objects
                x, y, w, h = cv2.boundingRect(contour)
                detected_objects.append(DetectedObject(
                    label="light",
                    confidence=0.65,
                    bbox=(x, y, w, h),
                    area_percentage=(area / image_area) * 100
                ))
        
        # 5. Detect water-like regions (blue-ish, reflective areas on ground)
        lower_blue = np.array([90, 50, 50])
        upper_blue = np.array([130, 255, 255])
        water_mask = cv2.inRange(hsv, lower_blue, upper_blue)
        
        # Focus on lower half for water logging
        water_mask[:height//2, :] = 0
        water_pixels = np.sum(water_mask > 0)
        water_percentage = (water_pixels / image_area) * 100
        
        if water_percentage > 5:
            detected_objects.append(DetectedObject(
                label="water",
                confidence=0.7,
                bbox=(0, height//2, width, height//2),
                area_percentage=water_percentage
            ))
        
        # 6. Detect tree-like structures (brown/green vertical structures)
        # Look for brown tones
        lower_brown = np.array([10, 50, 20])
        upper_brown = np.array([20, 255, 200])
        brown_mask = cv2.inRange(hsv, lower_brown, upper_brown)
        
        # Look for green tones
        lower_green = np.array([35, 40, 40])
        upper_green = np.array([85, 255, 255])
        green_mask = cv2.inRange(hsv, lower_green, upper_green)
        
        tree_mask = cv2.bitwise_or(brown_mask, green_mask)
        contours, _ = cv2.findContours(tree_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        for contour in contours:
            area = cv2.contourArea(contour)
            if area > (image_area * 0.05):  # Significant tree presence
                x, y, w, h = cv2.boundingRect(contour)
                # Check if it's more vertical (h > w suggests tree)
                if h > w * 1.5:
                    detected_objects.append(DetectedObject(
                        label="tree",
                        confidence=0.6,
                        bbox=(x, y, w, h),
                        area_percentage=(area / image_area) * 100
                    ))
        
        return ImageAnalysis(
            width=width,
            height=height,
            detected_objects=detected_objects
        )


class EnhancedCivicIssueClassifier:
    """
    Extended classifier for multiple civic infrastructure issues:
    - Potholes (present/not present)
    - Garbage (overflowing/not overflowing)
    - Street lights (working/not working)
    - Waterlogging (issue/not issue)
    - Fallen trees (issue/not issue)
    """
    
    # Category indicators
    GARBAGE_INDICATORS = {
        'bag', 'bags', 'container', 'bin', 'trash', 'bottle', 'bottles',
        'can', 'cans', 'box', 'boxes', 'plastic', 'paper', 'waste',
        'debris', 'clutter', 'litter', 'pile', 'backpack', 'handbag',
        'suitcase', 'cup', 'garbage'
    }
    
    ROAD_INDICATORS = {
        'road', 'street', 'pavement', 'asphalt', 'lane', 'curb',
        'highway', 'path', 'surface', 'ground'
    }
    
    POTHOLE_INDICATORS = {
        'hole', 'pothole', 'crack', 'damage', 'depression',
        'void', 'break', 'damaged', 'broken', 'crater'
    }
    
    LIGHT_INDICATORS = {
        'light', 'lamp', 'streetlight', 'street light', 'bulb',
        'lighting', 'illumination', 'traffic light'
    }
    
    WATER_INDICATORS = {
        'water', 'puddle', 'flood', 'flooding', 'pool', 'waterlogging',
        'wet', 'rain', 'lake'
    }
    
    TREE_INDICATORS = {
        'tree', 'branch', 'trunk', 'log', 'wood', 'plant',
        'vegetation', 'leaves', 'foliage'
    }
    
    # Thresholds
    GARBAGE_OVERFLOW_THRESHOLD = 20.0
    POTHOLE_MIN_SIZE = 2.0
    WATER_LOGGING_THRESHOLD = 8.0
    FALLEN_TREE_THRESHOLD = 10.0
    
    def classify_all_issues(
        self, 
        image_analysis: ImageAnalysis,
        raw_image: np.ndarray
    ) -> Dict:
        """
        Classify all civic issues in the image.
        
        Returns:
            Dictionary with all issue classifications
        """
        result = {
            "potholes": self._classify_potholes(image_analysis),
            "garbage": self._classify_garbage(image_analysis),
            "street_lights": self._classify_street_lights(image_analysis, raw_image),
            "waterlogging": self._classify_waterlogging(image_analysis, raw_image),
            "fallen_trees": self._classify_fallen_trees(image_analysis, raw_image)
        }
        
        return result
    
    # ==================== POTHOLE DETECTION ====================
    
    def _classify_potholes(self, analysis: ImageAnalysis) -> Dict[str, str]:
        """
        Detect potholes in the image.
        
        Returns:
            {"status": "present" | "not_present"}
        """
        has_pothole = False
        
        for obj in analysis.detected_objects:
            label_lower = obj.label.lower()
            
            # Check for explicit pothole indicators
            for indicator in self.POTHOLE_INDICATORS:
                if indicator in label_lower:
                    if obj.area_percentage >= self.POTHOLE_MIN_SIZE:
                        has_pothole = True
                        break
            
            # Check for dark voids on road surface
            if 'dark' in label_lower or 'hole' in label_lower:
                if obj.area_percentage >= self.POTHOLE_MIN_SIZE:
                    # Check if in lower half (where roads typically are)
                    if obj.bbox[1] > analysis.height * 0.3:
                        has_pothole = True
                        break
        
        return {
            "status": "present" if has_pothole else "not_present"
        }
    
    # ==================== GARBAGE DETECTION ====================
    
    def _classify_garbage(self, analysis: ImageAnalysis) -> Dict[str, str]:
        """
        Detect garbage and classify if overflowing.
        
        Returns:
            {"status": "overflowing" | "normal" | "not_present"}
        """
        garbage_coverage = 0.0
        garbage_objects = []
        
        for obj in analysis.detected_objects:
            if self._is_garbage_indicator(obj):
                garbage_coverage += obj.area_percentage
                garbage_objects.append(obj)
        
        # Check for clustering effect
        if len(garbage_objects) >= 5:
            garbage_coverage *= 1.3
        
        # Determine status
        if garbage_coverage < 5.0:
            status = "not_present"
        elif garbage_coverage >= self.GARBAGE_OVERFLOW_THRESHOLD:
            status = "overflowing"
        elif self._has_scattered_distribution(analysis, garbage_objects):
            status = "overflowing"
        elif len(garbage_objects) >= 10:
            status = "overflowing"
        else:
            status = "normal"
        
        return {"status": status}
    
    def _is_garbage_indicator(self, obj: DetectedObject) -> bool:
        """Check if object is garbage-related"""
        label_lower = obj.label.lower()
        
        if label_lower in self.GARBAGE_INDICATORS:
            return True
        
        for indicator in self.GARBAGE_INDICATORS:
            if indicator in label_lower:
                return True
        
        if obj.area_percentage < 1.0 and obj.confidence > 0.5:
            return True
        
        return False
    
    def _has_scattered_distribution(
        self, 
        analysis: ImageAnalysis,
        garbage_objects: List[DetectedObject]
    ) -> bool:
        """Check if garbage is scattered"""
        if len(garbage_objects) < 3:
            return False
        
        x_positions = [obj.bbox[0] for obj in garbage_objects]
        x_spread = max(x_positions) - min(x_positions)
        spread_percentage = (x_spread / analysis.width) * 100
        
        return spread_percentage > 50
    
    # ==================== STREET LIGHT DETECTION ====================
    
    def _classify_street_lights(
        self, 
        analysis: ImageAnalysis,
        raw_image: np.ndarray
    ) -> Dict[str, str]:
        """
        Detect street lights and determine if working.
        
        Returns:
            {"status": "working" | "not_working" | "not_detected"}
        """
        light_objects = []
        
        for obj in analysis.detected_objects:
            label_lower = obj.label.lower()
            
            # Check for light indicators
            for indicator in self.LIGHT_INDICATORS:
                if indicator in label_lower:
                    light_objects.append(obj)
                    break
        
        if not light_objects:
            # Try to detect based on brightness in upper portion
            height, width = raw_image.shape[:2]
            gray = cv2.cvtColor(raw_image, cv2.COLOR_BGR2GRAY)
            upper_portion = gray[:height//3, :]
            
            # Check average brightness in upper portion
            avg_brightness = np.mean(upper_portion)
            
            # If very bright spots exist in upper portion
            bright_pixels = np.sum(upper_portion > 200)
            bright_percentage = (bright_pixels / upper_portion.size) * 100
            
            if bright_percentage > 1.0:
                # Likely has working street lights
                return {"status": "working"}
            else:
                return {"status": "not_detected"}
        
        # Analyze detected lights
        # Check if lights are emitting light (bright regions)
        working_lights = 0
        
        for light in light_objects:
            x, y, w, h = light.bbox
            
            # Extract region around light
            roi = raw_image[y:y+h, x:x+w]
            if roi.size == 0:
                continue
            
            gray_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
            avg_brightness = np.mean(gray_roi)
            
            # If bright enough, consider it working
            if avg_brightness > 150:
                working_lights += 1
        
        if working_lights > 0:
            return {"status": "working"}
        elif len(light_objects) > 0:
            return {"status": "not_working"}
        else:
            return {"status": "not_detected"}
    
    # ==================== WATERLOGGING DETECTION ====================
    
    def _classify_waterlogging(
        self, 
        analysis: ImageAnalysis,
        raw_image: np.ndarray
    ) -> Dict[str, str]:
        """
        Detect waterlogging issues.
        
        Returns:
            {"status": "issue" | "no_issue"}
        """
        water_coverage = 0.0
        
        # Check for detected water objects
        for obj in analysis.detected_objects:
            label_lower = obj.label.lower()
            
            for indicator in self.WATER_INDICATORS:
                if indicator in label_lower:
                    water_coverage += obj.area_percentage
                    break
        
        # Additional check: analyze image for water-like characteristics
        height, width = raw_image.shape[:2]
        hsv = cv2.cvtColor(raw_image, cv2.COLOR_BGR2HSV)
        
        # Focus on lower half (ground level)
        lower_half = hsv[height//2:, :, :]
        
        # Detect blue-ish colors (water)
        lower_blue = np.array([90, 30, 30])
        upper_blue = np.array([130, 255, 255])
        water_mask = cv2.inRange(lower_half, lower_blue, upper_blue)
        
        water_pixels = np.sum(water_mask > 0)
        lower_half_area = lower_half.shape[0] * lower_half.shape[1]
        additional_water_percentage = (water_pixels / lower_half_area) * 50  # Scale to image
        
        total_water_coverage = water_coverage + additional_water_percentage
        
        # Check for reflections (glossy surfaces suggest water)
        gray = cv2.cvtColor(raw_image, cv2.COLOR_BGR2GRAY)
        lower_gray = gray[height//2:, :]
        
        # High variance in small regions suggests reflections
        variance = np.var(lower_gray)
        
        has_issue = (
            total_water_coverage >= self.WATER_LOGGING_THRESHOLD or
            (variance > 2000 and additional_water_percentage > 3)
        )
        
        return {
            "status": "issue" if has_issue else "no_issue"
        }
    
    # ==================== FALLEN TREE DETECTION ====================
    
    def _classify_fallen_trees(
        self, 
        analysis: ImageAnalysis,
        raw_image: np.ndarray
    ) -> Dict[str, str]:
        """
        Detect fallen trees obstructing paths/roads.
        
        Returns:
            {"status": "issue" | "no_issue"}
        """
        tree_coverage = 0.0
        horizontal_trees = []
        
        # Check for detected tree objects
        for obj in analysis.detected_objects:
            label_lower = obj.label.lower()
            
            for indicator in self.TREE_INDICATORS:
                if indicator in label_lower:
                    tree_coverage += obj.area_percentage
                    
                    # Check if tree is horizontal (fallen)
                    x, y, w, h = obj.bbox
                    
                    # Fallen trees are typically more horizontal than vertical
                    if w > h * 1.2:  # Width > height suggests horizontal orientation
                        # Also check if in lower portion (blocking ground/road)
                        if y > analysis.height * 0.3:
                            horizontal_trees.append(obj)
                    break
        
        # Additional heuristic: large brown/woody objects on ground
        height, width = raw_image.shape[:2]
        hsv = cv2.cvtColor(raw_image, cv2.COLOR_BGR2HSV)
        
        # Detect brown tones in lower half
        lower_half = hsv[height//2:, :, :]
        lower_brown = np.array([10, 30, 30])
        upper_brown = np.array([25, 255, 200])
        brown_mask = cv2.inRange(lower_half, lower_brown, upper_brown)
        
        brown_pixels = np.sum(brown_mask > 0)
        brown_percentage = (brown_pixels / (lower_half.shape[0] * lower_half.shape[1])) * 50
        
        has_issue = (
            len(horizontal_trees) > 0 or
            (tree_coverage >= self.FALLEN_TREE_THRESHOLD and brown_percentage > 10)
        )
        
        return {
            "status": "issue" if has_issue else "no_issue"
        }


class CompleteCivicIssueDetectionSystem:
    """Complete end-to-end system for multi-category civic issue detection"""
    
    def __init__(self, use_yolo: bool = True):
        """
        Initialize the detection system.
        
        Args:
            use_yolo: If True, use YOLO model. If False, use mock detector.
        """
        model_type = "yolo" if (use_yolo and YOLO_AVAILABLE) else "mock"
        self.vision_model = VisionModelWrapper(model_type=model_type)
        self.classifier = EnhancedCivicIssueClassifier()
    
    def process_image(self, image_path: str, verbose: bool = True) -> Dict:
        """
        Process an image and classify all civic issues.
        
        Args:
            image_path: Path to the image file
            verbose: If True, print detection details
            
        Returns:
            Dictionary with all classification results
        """
        # Check if file exists
        if not Path(image_path).exists():
            raise FileNotFoundError(f"Image not found: {image_path}")
        
        if verbose:
            print(f"Processing image: {image_path}")
            print("="*60)
        
        # Step 1: Detect objects
        image_analysis, raw_image = self.vision_model.process_image(image_path)
        
        # Step 2: Classify all civic issues
        result = self.classifier.classify_all_issues(image_analysis, raw_image)

        # ADD IMAGE PATH TO RESULT
        result['image_path'] = image_path
        
        if verbose:
            print("\nClassification Results:")
            print("-"*60)
            print(f"🕳️  Potholes: {result['potholes']['status']}")
            print(f"🗑️  Garbage: {result['garbage']['status']}")
            print(f"💡 Street Lights: {result['street_lights']['status']}")
            print(f"💧 Waterlogging: {result['waterlogging']['status']}")
            print(f"🌳 Fallen Trees: {result['fallen_trees']['status']}")
            print("="*60)
        
        return result
    
    def process_batch(self, image_paths: List[str]) -> List[Dict]:
        """
        Process multiple images.
        
        Args:
            image_paths: List of image file paths
            
        Returns:
            List of classification results
        """
        results = []
        for path in image_paths:
            try:
                result = self.process_image(path, verbose=False)
                results.append({
                    "image": path,
                    **result
                })
            except Exception as e:
                results.append({
                    "image": path,
                    "error": str(e)
                })
        
        return results
    
    def generate_report(self, image_path: str, output_path: Optional[str] = None) -> str:
        """
        Generate a detailed report for an image.
        
        Args:
            image_path: Path to the image file
            output_path: Optional path to save report JSON
            
        Returns:
            JSON string of the report
        """
        result = self.process_image(image_path, verbose=False)
        
        # Create detailed report
        report = {
            "image_path": image_path,
            "analysis_date": "2026-01-24",  # You can use datetime.now() for real timestamp
            "issues_detected": [],
            "summary": {
                "total_issues": 0,
                "critical_issues": 0,
                "warnings": 0
            },
            "detailed_results": result
        }
        
        # Analyze results and categorize issues
        if result['potholes']['status'] == 'present':
            report['issues_detected'].append("Potholes detected")
            report['summary']['critical_issues'] += 1
        
        if result['garbage']['status'] == 'overflowing':
            report['issues_detected'].append("Overflowing garbage")
            report['summary']['critical_issues'] += 1
        elif result['garbage']['status'] == 'normal':
            report['issues_detected'].append("Normal garbage levels")
            report['summary']['warnings'] += 1
        
        if result['street_lights']['status'] == 'not_working':
            report['issues_detected'].append("Street lights not working")
            report['summary']['critical_issues'] += 1
        
        if result['waterlogging']['status'] == 'issue':
            report['issues_detected'].append("Waterlogging detected")
            report['summary']['critical_issues'] += 1
        
        if result['fallen_trees']['status'] == 'issue':
            report['issues_detected'].append("Fallen trees obstructing path")
            report['summary']['critical_issues'] += 1
        
        report['summary']['total_issues'] = len(report['issues_detected'])
        
        # Save to file if requested
        if output_path:
            with open(output_path, 'w') as f:
                json.dump(report, f, indent=2)
            print(f"Report saved to: {output_path}")
        
        return json.dumps(report, indent=2)

class SupabaseConnector:
    """Handle Supabase database operations"""
    
    def __init__(self, url: str, key: str):
        """Initialize Supabase client"""
        self.supabase: Client = create_client(url, key)
        print("✅ Connected to Supabase")
    
    def generate_title_and_description(self, result: Dict) -> List[Dict]:
        """
        Generate title and description for each detected issue.
        Returns list of issues found in the image.
        """
        issues = []
        image_path = result.get("image_path", "")
        
        # Check each issue type and create entries
        
        # 1. Potholes
        if result.get("potholes", {}).get("status") == "present":
            issues.append({
                "title": "Potholes",
                "description": "Potholes have increased and clogging water drainage",
                "image_url": image_path
            })
        
        # Alternative pothole title
        pothole_alt_titles = ["Open Manholes", "Road Damage"]
        if result.get("potholes", {}).get("status") == "present" and len(issues) > 0:
            # You can randomize or use context to pick title
            pass
        
        # 2. Garbage
        garbage_status = result.get("garbage", {}).get("status")
        if garbage_status == "overflowing":
            issues.append({
                "title": "Garbage Overflow",
                "description": "Garbage has exceeded limit and overflow into the streets",
                "image_url": image_path
            })
        elif garbage_status == "normal":
            issues.append({
                "title": "Garbage Collection Needed",
                "description": "Garbage bins are filling up and need attention",
                "image_url": image_path
            })
        
        # 3. Street Lights
        light_status = result.get("street_lights", {}).get("status")
        if light_status == "not_working":
            issues.append({
                "title": "Faulty Streetlights",
                "description": "Many street lights are faulty and flicker at night",
                "image_url": image_path
            })
        
        # 4. Waterlogging
        if result.get("waterlogging", {}).get("status") == "issue":
            issues.append({
                "title": "Drains Clogging",
                "description": "Drains have clogged and their water is entering homes",
                "image_url": image_path
            })
        
        # 5. Fallen Trees
        if result.get("fallen_trees", {}).get("status") == "issue":
            issues.append({
                "title": "Fallen Trees",
                "description": "Trees have fallen and blocking the road",
                "image_url": image_path
            })
        
        return issues
    
    def insert_civic_issue(self, issue_data: Dict) -> Dict:
        """Insert a single civic issue into Supabase."""
        try:
            image_path = issue_data.get("image_url") or issue_data.get("image_path", "")
            locality = extract_locality(image_path)

            issue_data["locality"] = locality
            issue_data["status"] = "draft"

            response = self.supabase.table("civic_issues").insert(issue_data).execute()
            return {"success": True, "data": response.data}
        except Exception as e:
            return {"success": False, "error": str(e)}

    
    def insert_batch(self, results: List[Dict]) -> Dict:
        """
        Process detection results and insert all issues into Supabase.
        Each image can generate multiple issue entries.
        """
        successful = 0
        failed = 0
        errors = []
        total_issues = 0
        
        for result in results:
            # Generate all issues for this image
            issues = self.generate_title_and_description(result)
            total_issues += len(issues)
            
            # Insert each issue
            for issue in issues:
                response = self.insert_civic_issue(issue)
                if response["success"]:
                    successful += 1
                else:
                    failed += 1
                    errors.append({
                        "image_path": result.get("image_path", "unknown"),
                        "title": issue["title"],
                        "error": response["error"]
                    })
        
        return {
            "total_images": len(results),
            "total_issues": total_issues,
            "successful": successful,
            "failed": failed,
            "errors": errors
        }
    
    def get_all_issues(self, limit: int = 100) -> List[Dict]:
        """Retrieve all civic issues from database"""
        try:
            response = self.supabase.table("civic_issues").select("*").order("created_at", desc=True).limit(limit).execute()
            return response.data
        except Exception as e:
            print(f"Error fetching data: {e}")
            return []
    
    def get_issues_by_title(self, title: str) -> List[Dict]:
        """Get issues filtered by title."""
        try:
            response = self.supabase.table("civic_issues").select("*").eq("title", title).execute()
            return response.data
        except Exception as e:
            print(f"Error fetching data: {e}")
            return []

# ==================== MAIN ENTRY POINT ====================

def main():
    """Main function - Process all civic infrastructure images"""
    
    # ========== CONFIGURE YOUR IMAGE PATHS HERE ==========

    IMAGE_PATHS = [
    # Sector 1
    "dataset_mock/Sector 1/pothole_p2.jpg",
    "dataset_mock/Sector 1/traffic_p4.jpg",
    "dataset_mock/Sector 1/trash_p2.jpg",
    "dataset_mock/Sector 1/waterlog_p2.jpg",

    # Sector 2
    "dataset_mock/Sector 2/pothole_p1.jpg",
    "dataset_mock/Sector 2/traffic_p1.jpg",
    "dataset_mock/Sector 2/trash_p1.jpg",
    "dataset_mock/Sector 2/tree_p1.jpg",
    "dataset_mock/Sector 2/waterlog_p1.jpg",

    # Sector 3
    "dataset_mock/Sector 3/traffic_p2.jpg",
    "dataset_mock/Sector 3/trash_p3.jpg",
    "dataset_mock/Sector 3/waterlog_p4.jpg",

    # Sector 4
    "dataset_mock/Sector 4/traffic_p3.jpg",
    "dataset_mock/Sector 4/trash_p5.jpg",
    "dataset_mock/Sector 4/tree_p2.jpg",
    "dataset_mock/Sector 4/waterlog_p3.jpg",

    # Sector 5
    "dataset_mock/Sector 5/traffic_p6.jpg",
    "dataset_mock/Sector 5/trash_p6.jpg",
    "dataset_mock/Sector 5/waterlog_p4.jpg"
]

    # ====================================================
    
    system = CompleteCivicIssueDetectionSystem(use_yolo=YOLO_AVAILABLE)
    
    print("\n" + "🏙️  CIVIC INFRASTRUCTURE MONITORING SYSTEM 🏙️".center(60))
    print("="*60 + "\n")
    
    # Process ALL images in batch
    print("📁 PROCESSING ALL IMAGES...")
    print("-"*60)
    
    all_results = []
    
    for i, image_path in enumerate(IMAGE_PATHS, 1):
        print(f"\n[{i}/{len(IMAGE_PATHS)}] Processing: {image_path}")
        try:
            result = system.process_image(image_path, verbose=False)
            all_results.append(result)
            print(f"✅ Success")
        except Exception as e:
            print(f"❌ Error: {e}")
            all_results.append({
                "image_path": image_path,
                "error": str(e)
            })
    
    print("\n" + "="*60)
    print(f"✅ Processed {len(all_results)} images")
    

    # Save all results to ONE JSON file
    output_file = "all_civic_results.json"
    with open(output_file, "w") as f:
        json.dump(all_results, f, indent=2)
    
    print(f"💾 All results saved to: {output_file}")

    # Save to JSON file (backup)
    output_file = "all_civic_results.json"
    with open(output_file, "w") as f:
        json.dump(all_results, f, indent=2)
    
    print(f"💾 Results saved to: {output_file}")


    # Convert results to title/description format for JSON
    formatted_results = []
    for result in all_results:
        issues = []
        image_path = result.get("image_path", "")
        
        if result.get("potholes", {}).get("status") == "present":
            issues.append({
                "title": "Potholes",
                "description": "Potholes have increased and clogging water drainage",
                "image_url": image_path
            })
        
        if result.get("garbage", {}).get("status") == "overflowing":
            issues.append({
                "title": "Garbage Overflow",
                "description": "Garbage has exceeded limit and overflow into the streets",
                "image_url": image_path
            })
        
        if result.get("street_lights", {}).get("status") == "not_working":
            issues.append({
                "title": "Faulty Streetlights",
                "description": "Many street lights are faulty and flicker at night",
                "image_url": image_path
            })
        
        if result.get("waterlogging", {}).get("status") == "issue":
            issues.append({
                "title": "Drains Clogging",
                "description": "Drains have clogged and their water is entering homes",
                "image_url": image_path
            })
        
        if result.get("fallen_trees", {}).get("status") == "issue":
            issues.append({
                "title": "Fallen Trees",
                "description": "Trees have fallen and blocking the road",
                "image_url": image_path
            })
        
        formatted_results.extend(issues)
    
    # Save formatted results to JSON
    formatted_output_file = "civic_issues_formatted.json"
    with open(formatted_output_file, "w") as f:
        json.dump(formatted_results, f, indent=2)
    
    print(f"💾 Formatted results saved to: {formatted_output_file}")
    
    # ========== ADD THESE LINES FOR SUPABASE ==========
    # ========== UPLOAD TO SUPABASE ==========
    print("\n" + "="*60)
    print("📤 UPLOADING TO SUPABASE...")
    print("-"*60)
    
    try:
        # Initialize Supabase connection
        supabase_conn = SupabaseConnector(SUPABASE_URL, SUPABASE_KEY)
        
        # Upload all results (will create multiple entries per image if multiple issues found)
        upload_summary = supabase_conn.insert_batch(all_results)
        
        print(f"\n📊 Upload Summary:")
        print(f"   Images Processed: {upload_summary['total_images']}")
        print(f"   Total Issues Found: {upload_summary['total_issues']}")
        print(f"   ✅ Successfully Uploaded: {upload_summary['successful']}")
        print(f"   ❌ Failed: {upload_summary['failed']}")
        
        if upload_summary['errors']:
            print(f"\n⚠️ Errors:")
            for error in upload_summary['errors']:
                print(f"   - {error['image_path']} ({error['title']}): {error['error']}")
        
        # Verify by fetching data
        print("\n" + "="*60)
        print("🔍 VERIFYING DATA IN SUPABASE...")
        print("-"*60)
        
        all_issues = supabase_conn.get_all_issues()
        print(f"✅ Found {len(all_issues)} total issue records in database")
        
        # Count by issue type
        potholes = supabase_conn.get_issues_by_title("Potholes")
        garbage = supabase_conn.get_issues_by_title("Garbage Overflow")
        lights = supabase_conn.get_issues_by_title("Faulty Streetlights")
        drains = supabase_conn.get_issues_by_title("Drains Clogging")
        trees = supabase_conn.get_issues_by_title("Fallen Trees")
        
        print(f"\n📋 Issues by Type:")
        print(f"   🕳️  Potholes: {len(potholes)}")
        print(f"   🗑️  Garbage Overflow: {len(garbage)}")
        print(f"   💡 Faulty Streetlights: {len(lights)}")
        print(f"   💧 Drains Clogging: {len(drains)}")
        print(f"   🌳 Fallen Trees: {len(trees)}")
        
        # Display sample entries
        print(f"\n📄 Sample Entries:")
        print("-"*60)
        for issue in all_issues[:5]:  # Show first 5
            print(f"   Title: {issue['title']}")
            print(f"   Description: {issue['description'][:60]}...")
            print(f"   Image: {issue['image_url']}")
            print("-"*60)
        
    except Exception as e:
        print(f"\n❌ Error connecting to Supabase: {e}")
        print("   Make sure you've set SUPABASE_URL and SUPABASE_KEY correctly")
    
    print("\n" + "="*60)
    print("✅ PROCESS COMPLETE!")
    print("="*60)
    # ========== END SUPABASE INTEGRATION ==========
    
    # Print the complete JSON output
    print("\n📊 COMPLETE RESULTS (JSON):")
    print("="*60)
    print(json.dumps(all_results, indent=2))
    
    print("\n" + "="*60)


if __name__ == "__main__":
    main()