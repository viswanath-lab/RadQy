"""
Reusable shallow U-Net inference (CPU) for 2D masks, plus a simple CLI.

Exports:
    load_unet_model(ckpt_path) -> torch.nn.Module
    make_masks(img2d, model=None, threshold=0.5) -> (fg, bg)

CLI:
    python seg/Unet.py --image path/to/image.npy --out-dir output_masks --ckpt model/unet_shallow.pt
"""

from __future__ import annotations

import argparse
from functools import lru_cache
from pathlib import Path
from typing import Tuple

import numpy as np
from PIL import Image
import torch
from monai.networks.nets import UNet


DEFAULT_CKPT = Path("model/unet_shallow.pt")
DEFAULT_THRESHOLD = 0.5


def load_image(path: Path) -> np.ndarray:
    if path.suffix.lower() == ".npy":
        arr = np.load(path)
    elif path.suffix.lower() == ".npz":
        data = np.load(path)
        key = list(data.files)[0]
        arr = data[key]
    else:
        img = Image.open(path).convert("L")
        arr = np.array(img, dtype=np.float32)
    if arr.ndim == 3 and arr.shape[2] == 1:
        arr = arr[..., 0]
    if arr.ndim != 2:
        raise ValueError(f"Expected 2D array, got shape {arr.shape}")
    arr = arr.astype(np.float32)
    mn, mx = float(arr.min()), float(arr.max())
    if mx > mn:
        arr = (arr - mn) / (mx - mn)
    else:
        arr = np.zeros_like(arr, dtype=np.float32)
    return arr


def _to_tensor(img: np.ndarray) -> torch.Tensor:
    return torch.from_numpy(img[None, None, ...])  # 1 x 1 x H x W


@lru_cache(maxsize=1)
def load_unet_model(ckpt_path: Path = DEFAULT_CKPT) -> torch.nn.Module:
    ckpt_path = Path(ckpt_path)
    if not ckpt_path.exists():
        raise FileNotFoundError(f"Missing checkpoint: {ckpt_path}")
    model = UNet(
        spatial_dims=2,
        in_channels=1,
        out_channels=1,
        channels=(16, 32, 64),
        strides=(2, 2),
        num_res_units=1,
    )
    state = torch.load(ckpt_path, map_location="cpu")
    if "model_state" in state:
        state = state["model_state"]
    model.load_state_dict(state, strict=True)
    model.eval()
    return model


def make_masks(img: np.ndarray, model: torch.nn.Module | None = None, threshold: float = DEFAULT_THRESHOLD) -> Tuple[np.ndarray, np.ndarray]:
    """
    img: 2D float32 array
    model: optional UNet; if None, loads cached model
    returns: (fg, bg) uint8 masks in {0,1}
    """
    if img.ndim != 2:
        raise ValueError(f"Expected 2D array, got shape {img.shape}")

    if model is None:
        model = load_unet_model()

    # pad to be divisible by network stride (2 downsamples -> 4)
    h, w = img.shape
    pad_h = (4 - h % 4) % 4
    pad_w = (4 - w % 4) % 4
    if pad_h or pad_w:
        img_in = np.pad(img, ((0, pad_h), (0, pad_w)), mode="reflect")
    else:
        img_in = img

    with torch.no_grad():
        logits = model(_to_tensor(img_in))
        probs = torch.sigmoid(logits)[0, 0].cpu().numpy()

    # crop back to original size if padded
    probs = probs[:h, :w]

    fg = (probs >= threshold).astype(np.uint8)
    bg = (fg == 0).astype(np.uint8)
    return fg, bg


def save_mask(mask: np.ndarray, path: Path) -> None:
    Image.fromarray((mask * 255).astype(np.uint8), mode="L").save(path)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run shallow U-Net on a single 2D image (CPU).")
    parser.add_argument("--image", type=Path, required=True, help="Path to input image (.npy, .npz, or standard image).")
    parser.add_argument("--out-dir", type=Path, default=Path("output_masks"), help="Directory to save masks.")
    parser.add_argument("--ckpt", type=Path, default=DEFAULT_CKPT, help="Path to checkpoint (default: model/unet_shallow.pt).")
    parser.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD, help="Foreground threshold (default: 0.5).")
    args = parser.parse_args()

    img = load_image(args.image)
    model = load_unet_model(args.ckpt)
    fg, bg = make_masks(img, model=model, threshold=args.threshold)

    args.out_dir.mkdir(parents=True, exist_ok=True)
    base = args.image.stem
    fg_path = args.out_dir / f"{base}_fg.png"
    bg_path = args.out_dir / f"{base}_bg.png"
    save_mask(fg, fg_path)
    save_mask(bg, bg_path)
    print(f"Saved foreground: {fg_path}")
    print(f"Saved background: {bg_path}")


if __name__ == "__main__":
    main()
