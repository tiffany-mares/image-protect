"""TensorFlow MobileNetV2 module — loaded once at import time.

Exposes:
    tf_predict(pil_image) -> {"index": int, "label": str, "confidence": float}

Usage (smoke test):
    python tf_model.py <path-to-image>
"""

import sys
from pathlib import Path

import numpy as np
import tensorflow as tf
from PIL import Image

# ---------------------------------------------------------------------------
# Module-level model (loaded once)
# ---------------------------------------------------------------------------

_model = tf.keras.applications.MobileNetV2(weights="imagenet")
_model.trainable = False


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _preprocess(pil_image: Image.Image) -> np.ndarray:
    """Resize to 224x224, convert to float32, scale to [-1, 1]."""
    img = pil_image.convert("RGB").resize((224, 224), Image.BILINEAR)
    arr = np.array(img, dtype=np.float32)           # (224, 224, 3) in [0, 255]
    arr = np.expand_dims(arr, axis=0)               # (1, 224, 224, 3)
    arr = tf.keras.applications.mobilenet_v2.preprocess_input(arr)  # -> [-1, 1]
    return arr


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def tf_predict(pil_image: Image.Image) -> dict:
    """Return top-1 MobileNetV2 prediction for a PIL image.

    Returns:
        {"index": int, "label": str, "confidence": float}
    """
    arr = _preprocess(pil_image)
    preds = _model(arr, training=False)             # (1, 1000)
    decoded = tf.keras.applications.mobilenet_v2.decode_predictions(
        preds.numpy(), top=1
    )[0][0]
    # decoded = (class_id_str, label_str, prob_float)
    # Integer position in the softmax vector is used as the display index.
    class_idx = int(np.argmax(preds.numpy()[0]))
    label = decoded[1].replace("_", " ")
    confidence = round(float(decoded[2]), 6)
    return {"index": class_idx, "label": label, "confidence": confidence}


# ---------------------------------------------------------------------------
# __main__ -- smoke test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python tf_model.py <path-to-image>")
        sys.exit(1)

    img_path = Path(sys.argv[1])
    if not img_path.exists():
        print(f"Error: file not found: {img_path}")
        sys.exit(1)

    print(f"Loading image: {img_path}")
    img = Image.open(img_path)
    result = tf_predict(img)
    print(result)
