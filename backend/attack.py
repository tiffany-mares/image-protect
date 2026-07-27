"""PGD adversarial attack against ResNet-50 (ImageNet).
Ensemble variant also attacks TF MobileNetV2 simultaneously.

Usage:
    python attack.py <path-to-image>
    python attack.py <path-to-image> --ensemble
"""

import sys
from pathlib import Path

import torch
import torchvision.transforms as T
from torchvision.models import resnet50, ResNet50_Weights
from PIL import Image

from labels import get_label

# ---------------------------------------------------------------------------
# Module-level model + transforms (loaded once at import time)
# ---------------------------------------------------------------------------

_WEIGHTS = ResNet50_Weights.IMAGENET1K_V2
_DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

model = resnet50(weights=_WEIGHTS)
model.eval()
model.to(_DEVICE)

# Resize -> CenterCrop -> ToTensor  (no normalisation -- kept separate so PGD
# can operate in [0, 1] pixel space before normalising at inference time)
preprocess = T.Compose([
    T.Resize(256),
    T.CenterCrop(224),
    T.ToTensor(),          # -> [0, 1] float32 CHW
])

_MEAN = torch.tensor([0.485, 0.456, 0.406], device=_DEVICE).view(3, 1, 1)
_STD  = torch.tensor([0.229, 0.224, 0.225], device=_DEVICE).view(3, 1, 1)


def _normalize(x: torch.Tensor) -> torch.Tensor:
    """Apply ImageNet mean/std normalisation to a [0,1] CHW tensor."""
    return (x - _MEAN) / _STD


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def predict(tensor: torch.Tensor) -> dict:
    """Return top-1 prediction for a [0,1] CHW float tensor.

    Args:
        tensor: shape (3, H, W) or (1, 3, H, W), values in [0, 1].

    Returns:
        {"index": int, "label": str, "confidence": float}
    """
    if tensor.dim() == 3:
        tensor = tensor.unsqueeze(0)
    tensor = tensor.to(_DEVICE)
    with torch.no_grad():
        logits = model(_normalize(tensor))
        probs = torch.softmax(logits, dim=1)
        confidence, idx = probs.max(dim=1)
    idx = int(idx.item())
    return {
        "index": idx,
        "label": get_label(idx),
        "confidence": round(float(confidence.item()), 6),
    }


def pgd_attack(
    image: Image.Image,
    eps: float = 0.02,
    steps: int = 4,
) -> tuple:
    """Apply PGD perturbation to *image* to mislead ResNet-50.

    PGD formula:
        x_{t+1} = Clip_{x,eps}( x_t + alpha * sign( grad_x L ) )

    Args:
        image:  PIL Image (any mode; converted to RGB internally).
        eps:    Maximum L-inf perturbation in [0, 1] pixel space.
        steps:  Number of PGD iterations. Default 4 (fast); use 8 for
                stronger protection at ~2x latency cost.

    Returns:
        (protected_image, predictions) where predictions is
        {"original": predict_dict, "protected": predict_dict}.
    """
    alpha = eps / steps * 2.5

    # Preprocess to [0,1] CHW tensor
    x_orig = preprocess(image.convert("RGB")).to(_DEVICE)  # (3, 224, 224)

    original_pred = predict(x_orig)

    # PGD loop -- operate on a copy that requires grad
    x_adv = x_orig.clone().detach()

    for _ in range(steps):
        x_adv.requires_grad_(True)

        logits = model(_normalize(x_adv.unsqueeze(0)))
        # Maximise cross-entropy loss to mislead the model
        loss = torch.nn.functional.cross_entropy(
            logits,
            torch.tensor([original_pred["index"]], device=_DEVICE),
        )
        loss.backward()

        with torch.no_grad():
            grad_sign = x_adv.grad.sign()
            x_adv = x_adv + alpha * grad_sign
            # Project back into epsilon-ball around original
            x_adv = torch.max(torch.min(x_adv, x_orig + eps), x_orig - eps)
            # Clamp to valid pixel range
            x_adv = x_adv.clamp(0.0, 1.0)

    protected_pred = predict(x_adv)

    # Convert back to PIL Image
    protected_image = T.ToPILImage()(x_adv.cpu())

    predictions = {
        "original":  original_pred,
        "protected": protected_pred,
    }
    return protected_image, predictions


def ensemble_pgd_attack(
    image: Image.Image,
    eps: float = 0.02,
    steps: int = 4,
) -> tuple:
    """PGD attack that alternates gradient steps between ResNet-50 and MobileNetV2.

    On each iteration:
        1. Compute ResNet-50 cross-entropy gradient and apply a sign step.
        2. Convert the intermediate adversarial image to a PIL image, run
           tf.GradientTape on MobileNetV2, convert the numpy gradient back to
           a torch tensor, and apply a second sign step.
        3. Clip to epsilon-ball and clamp to [0, 1].

    Args:
        image:  PIL Image.
        eps:    Maximum L-inf perturbation in [0, 1] pixel space.
        steps:  Number of PGD iterations (each iteration does two sub-steps).

    Returns:
        (protected_image, predictions) where predictions is:
        {
            "resnet50":  {"original": predict_dict, "protected": predict_dict},
            "mobilenet": {"original": predict_dict, "protected": predict_dict},
        }
    """
    import numpy as np
    import tensorflow as tf
    from tf_model import tf_predict, _model as tf_mobilenet, _preprocess as tf_preprocess

    alpha = eps / steps * 2.5

    x_orig = preprocess(image.convert("RGB")).to(_DEVICE)  # (3, 224, 224)

    # Record original predictions from both models
    orig_pil = T.ToPILImage()(x_orig.cpu())
    resnet_orig = predict(x_orig)
    mobile_orig = tf_predict(orig_pil)

    x_adv = x_orig.clone().detach()

    for _ in range(steps):
        # --- Step A: ResNet-50 gradient ---
        x_adv.requires_grad_(True)
        logits = model(_normalize(x_adv.unsqueeze(0)))
        loss = torch.nn.functional.cross_entropy(
            logits,
            torch.tensor([resnet_orig["index"]], device=_DEVICE),
        )
        loss.backward()

        with torch.no_grad():
            x_adv = x_adv + alpha * x_adv.grad.sign()
            x_adv = torch.max(torch.min(x_adv, x_orig + eps), x_orig - eps)
            x_adv = x_adv.clamp(0.0, 1.0)

        # --- Step B: MobileNetV2 gradient via tf.GradientTape ---
        # Convert current x_adv ([0,1] CHW) to PIL, then to TF input ([-1,1] NHWC)
        adv_pil = T.ToPILImage()(x_adv.cpu())
        tf_input = tf.constant(tf_preprocess(adv_pil))  # (1, 224, 224, 3) float32

        with tf.GradientTape() as tape:
            tape.watch(tf_input)
            tf_preds = tf_mobilenet(tf_input, training=False)
            # Keras 3 requires y_true to be a tensor (a plain list has no .shape)
            tf_loss = tf.keras.losses.sparse_categorical_crossentropy(
                tf.constant([mobile_orig["index"]], dtype=tf.int32), tf_preds
            )

        tf_grad = tape.gradient(tf_loss, tf_input)  # (1, 224, 224, 3)
        if tf_grad is not None:
            # Convert TF gradient (NHWC, [-1,1] scale) to torch CHW [0,1] sign
            grad_np = tf_grad.numpy()[0]               # (224, 224, 3)
            # grad_np is in the preprocess_input space; we only need the sign
            grad_np_chw = np.transpose(grad_np, (2, 0, 1))  # (3, 224, 224)
            grad_torch = torch.from_numpy(grad_np_chw).to(_DEVICE)

            with torch.no_grad():
                x_adv = x_adv + alpha * grad_torch.sign()
                x_adv = torch.max(torch.min(x_adv, x_orig + eps), x_orig - eps)
                x_adv = x_adv.clamp(0.0, 1.0)

    # Record protected predictions from both models
    prot_pil = T.ToPILImage()(x_adv.cpu())
    resnet_prot = predict(x_adv)
    mobile_prot = tf_predict(prot_pil)

    predictions = {
        "resnet50": {
            "original":  resnet_orig,
            "protected": resnet_prot,
        },
        "mobilenet": {
            "original":  mobile_orig,
            "protected": mobile_prot,
        },
    }
    return prot_pil, predictions


# ---------------------------------------------------------------------------
# __main__ -- smoke-test from the command line
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    use_ensemble = "--ensemble" in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith("--")]

    if not args:
        print("Usage: python attack.py <path-to-image> [--ensemble]")
        sys.exit(1)

    img_path = Path(args[0])
    if not img_path.exists():
        print(f"Error: file not found: {img_path}")
        sys.exit(1)

    print(f"Loading image: {img_path}")
    source_image = Image.open(img_path)

    if use_ensemble:
        print("Running ensemble PGD attack (eps=0.02, steps=4) ...")
        protected_image, predictions = ensemble_pgd_attack(source_image, eps=0.02, steps=4)
        print("\n--- ResNet-50 original ---")
        print(predictions["resnet50"]["original"])
        print("\n--- ResNet-50 protected ---")
        print(predictions["resnet50"]["protected"])
        print("\n--- MobileNetV2 original ---")
        print(predictions["mobilenet"]["original"])
        print("\n--- MobileNetV2 protected ---")
        print(predictions["mobilenet"]["protected"])
    else:
        print("Running PGD attack (eps=0.02, steps=8) ...")
        protected_image, predictions = pgd_attack(source_image, eps=0.02, steps=8)
        print("\n--- Original prediction ---")
        print(predictions["original"])
        print("\n--- Protected prediction ---")
        print(predictions["protected"])

    out_path = Path(__file__).parent / "test_protected.png"
    protected_image.save(out_path)
    print(f"\nSaved protected image -> {out_path}")
