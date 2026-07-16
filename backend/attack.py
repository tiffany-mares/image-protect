"""PGD adversarial attack against ResNet-50 (ImageNet).

Usage:
    python attack.py <path-to-image>

Outputs before/after prediction dicts to stdout and writes test_protected.png
to the same directory as this script.
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
    steps: int = 8,
) -> tuple:
    """Apply PGD perturbation to *image* to mislead ResNet-50.

    PGD formula:
        x_{t+1} = Clip_{x,eps}( x_t + alpha * sign( grad_x L ) )

    Args:
        image:  PIL Image (any mode; converted to RGB internally).
        eps:    Maximum L-inf perturbation in [0, 1] pixel space.
        steps:  Number of PGD iterations.

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


# ---------------------------------------------------------------------------
# __main__ -- smoke-test from the command line
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python attack.py <path-to-image>")
        sys.exit(1)

    img_path = Path(sys.argv[1])
    if not img_path.exists():
        print(f"Error: file not found: {img_path}")
        sys.exit(1)

    print(f"Loading image: {img_path}")
    source_image = Image.open(img_path)

    print("Running PGD attack (eps=0.02, steps=8) ...")
    protected_image, predictions = pgd_attack(source_image, eps=0.02, steps=8)

    print("\n--- Original prediction ---")
    print(predictions["original"])

    print("\n--- Protected prediction ---")
    print(predictions["protected"])

    out_path = Path(__file__).parent / "test_protected.png"
    protected_image.save(out_path)
    print(f"\nSaved protected image -> {out_path}")
