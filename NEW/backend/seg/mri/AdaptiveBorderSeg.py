import numpy as np
from scipy.ndimage import binary_opening, binary_closing, binary_fill_holes, generate_binary_structure, label

def normalize_robust(a):
    a = a.astype(np.float32)
    p1, p99 = np.percentile(a, (1, 99))
    a = np.clip(a, p1, p99)
    a -= a.min()
    a /= (a.max() + 1e-8)
    return (a * 255).astype(np.uint8)

def default_segment(u8, border=12, min_area_frac=0.05):
    """Return binary mask: 1=foreground, 0=background for a single 2D image."""
    u8 = normalize_robust(u8)
    h, w = u8.shape

    # estimate background mean/std from border
    ring = np.concatenate([u8[:border, :].ravel(), u8[-border:, :].ravel(),
                           u8[:, :border].ravel(), u8[:, -border:].ravel()])
    ring = ring[ring > 0]
    if ring.size == 0:
        ring = u8.ravel()

    mu, sd = float(ring.mean()), float(ring.std())
    bg = u8 < (mu - 1.0 * sd)
    bg = binary_closing(bg, np.ones((5, 5)))
    bg = binary_opening(bg, np.ones((5, 5)))
    bg = binary_fill_holes(bg)

    fg = (~bg).astype(np.uint8)

    # keep largest connected component
    lab, n = label(fg, structure=generate_binary_structure(2, 2))
    if n > 0:
        sizes = np.bincount(lab.ravel())
        sizes[0] = 0
        fg = (lab == sizes.argmax()).astype(np.uint8)

    # fallback if too small
    if fg.sum() < min_area_frac * h * w:
        fg[:] = 1

    return fg

def make_masks(img, segmenter=None):
    """
    Input:  2D numpy array (image)
    Output: (foreground_mask, background_mask)
    """
    seg = segmenter if segmenter is not None else default_segment
    u8 = normalize_robust(img)
    fg = seg(u8).astype(np.uint8)
    bg = (1 - fg).astype(np.uint8)
    return fg, bg


