import argparse
import os
import datetime
from pathlib import Path
import sys
import time
import re
from collections import defaultdict
from typing import List
import importlib.util
import importlib
import warnings

# Ensure repo root is on sys.path when executed as a script
THIS_DIR = Path(__file__).resolve().parent
REPO_ROOT = THIS_DIR.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import numpy as np
import pandas as pd
import pydicom
import yaml
from PIL import Image as PILImage
from pydicom.multival import MultiValue
from pydicom.errors import InvalidDicomError
from backend.iqm.mri import get_iqm_registry, compute_fail_fraction
warnings.filterwarnings("ignore", message=".*maximum length of 16 allowed for VR SH.*")
warnings.filterwarnings("ignore", category=FutureWarning)

def _norm(p): return str(Path(p).resolve())

def first_nonempty_for_col(df_group,col):
    if col not in df_group.columns:
        return ""
    for x in \
    df_group[
        col].astype(
            str):
        if x and x.lower() not in {
            "",
            "none",
            "nan"}:
            return x
    return ""

def load_segmenter_from_file(path: str):
    """
    Dynamically load a segmentation function `make_masks` or `segment`
    from a .py file such as 'amir.py'.
    Returns a callable (img -> (fg,bg)).
    """
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Segmenter file not found: {path}")

    spec = importlib.util.spec_from_file_location(p.stem, str(p))
    mod = importlib.util.module_from_spec(spec)
    sys.modules[p.stem] = mod
    spec.loader.exec_module(mod)

    # The module must expose either make_masks() or segment()
    if hasattr(mod, "make_masks"):
        return mod.make_masks
    elif hasattr(mod, "segment"):
        fn = getattr(mod, "segment")
        def wrapper(img):  # unify interface to return (fg,bg)
            fg = fn(img)
            bg = (1 - fg).astype(np.uint8)
            return fg, bg
        return wrapper
    else:
        raise AttributeError(f"{path} does not define make_masks() or segment().")

def load_default_segmenter():
    """
    Load the default MRI segmentation function from backend/seg/mri.
    Returns a callable and a human-readable name.
    """
    try:
        from backend.seg.mri.AdaptiveBorderSeg import make_masks as default_masks
    except ImportError:
        from seg.mri.AdaptiveBorderSeg import make_masks as default_masks  # type: ignore
    return default_masks, "Default: AdaptiveBorderSeg"

def _read_float32_slice(ds):
    """Convert DICOM pixel data to float32 array with RescaleSlope/Intercept applied."""
    arr = ds.pixel_array.astype(np.float32)
    slope = float(getattr(ds, "RescaleSlope", 1.0) or 1.0)
    inter = float(getattr(ds, "RescaleIntercept", 0.0) or 0.0)
    return arr * slope + inter

def safe_name(s: str) -> str:
    """Filesystem-safe participant folder name."""
    return re.sub(r'[<>:"/\\|?*\n\r\t ]+', "_", str(s))[:200]

def participant_label(top: str, sub: str, pid: str) -> str:
    return f"{top}--{sub}--{pid}"

def ensure_dir(p: Path):
    p.mkdir(parents=True, exist_ok=True)

def dcm_to_uint8(ds):
    """Convert a DICOM dataset to a uint8 grayscale PNG with basic windowing."""
    try:
        arr = ds.pixel_array.astype(np.float32)
    except Exception:
        return None

    slope = float(getattr(ds, "RescaleSlope", 1.0) or 1.0)
    inter = float(getattr(ds, "RescaleIntercept", 0.0) or 0.0)
    arr = arr * slope + inter

    wc = getattr(ds, "WindowCenter", None)
    ww = getattr(ds, "WindowWidth", None)
    try:
        if isinstance(wc, (list, tuple, MultiValue)): wc = float(wc[0])
        elif wc is not None: wc = float(wc)
        if isinstance(ww, (list, tuple, MultiValue)): ww = float(ww[0])
        elif ww is not None: ww = float(ww)
    except Exception:
        wc, ww = None, None

    if wc is not None and ww is not None and ww > 0:
        lo, hi = wc - ww/2.0, wc + ww/2.0
    else:
        lo, hi = np.percentile(arr, 0.5), np.percentile(arr, 99.5)

    arr = np.clip((arr - lo) / max(hi - lo, 1e-6), 0, 1) * 255.0

    if str(getattr(ds, "PhotometricInterpretation", "")).upper() == "MONOCHROME1":
        arr = 255.0 - arr

    return arr.astype(np.uint8)

def export_pngs_for_participants(df_source: pd.DataFrame, out_root: Path):
    """
    Save PNG slices for each participant from df_source (either full or pruned set).
    Creates: <out_root>/<Participant (topfolder:subfolder:patient ID)>/*.png
    """
    if df_source.empty:
        return

    group_cols = ["TopFolder", "SubFolder", "PatientID"]

    for (top, sub, pid), g in df_source.groupby(group_cols, dropna=False):
        part_dir_name = safe_name(participant_label(top, sub, pid))
        part_dir = out_root / part_dir_name
        ensure_dir(part_dir)

        g_sorted = g.sort_values(
            by=["StudyInstanceUID", "SeriesInstanceUID", "InstanceNumber", "Path"],
            kind="mergesort"
        ).reset_index(drop=True)

        for idx, row in enumerate(g_sorted.itertuples(index=False), start=1):
            dcm_path = Path(row.Path)
            try:
                ds = pydicom.dcmread(dcm_path, stop_before_pixels=False, force=True)
            except Exception:
                continue

            img = dcm_to_uint8(ds)
            if img is None:
                continue

            # Build filename
            study = str(getattr(row, "StudyInstanceUID", ""))[-6:] or "study"
            series = str(getattr(row, "SeriesInstanceUID", ""))[-6:] or "series"
            inst = f"{getattr(row, 'InstanceNumber', 0) or 0:05d}"
            fname = f"{idx:04d}_{study}_{series}_{inst}.png"

            try:
                PILImage.fromarray(img).save(part_dir / fname)
            except Exception:
                # skip silently if save fails
                pass

def starting_banner(scantype: str, cycles: int = 3, delay: float = 0.4):
    """Animate: 'RadQy for <TYPE> data is starting...' with pulsing dots."""
    base = f"RadQy for {scantype.strip().upper()} data is starting"
    for _ in range(cycles):
        for dots in ("", ".", "..", "..."):
            sys.stdout.write("\r" + base + dots)
            sys.stdout.flush()
            time.sleep(delay)
    print("\r" + base + "...")

def status_print(msg, blink=False, delay=0.25, repeat=3):
    """Print formatted status messages; only blink if requested."""
    if blink:
        for _ in range(repeat):
            sys.stdout.write(f"\r{msg}")
            sys.stdout.flush()
            time.sleep(delay)
            sys.stdout.write("\r" + " " * len(msg))
            sys.stdout.flush()
            time.sleep(delay)
        print(f"\r{msg}")
    else:
        print(msg)

def is_dicom(path: Path) -> bool:
    try:
        with path.open("rb") as f:
            pre = f.read(132)
    except (OSError, PermissionError):
        return False
    # DICOM magic is DICM at bytes 128-131
    return pre[128:132] == b"DICM" or path.suffix.lower() in {".dcm", ".dicom"}

def s(v):
    return "" if v is None else str(v)

def to_int_or_none(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return None

def top_folder_under_root(root: Path, file_path: Path) -> str:
    rel = file_path.resolve().relative_to(root.resolve())
    parts = rel.parts[:-1]
    return parts[0] if parts else ""

# ---------------- YAML handling ----------------
def read_yaml(yaml_path: Path):
    """
    Returns:
      flat: dict {abbr -> full tag name}
      abbr_order: list of abbr in YAML order (including VRX/VRY if present)
    """
    with open(yaml_path, 'r', encoding='utf-8') as f:
        tags = yaml.safe_load(f)

    flat = {}
    abbr_order = []
    for _, content in tags.items():
        for full_name, abbr in content.items():
            if isinstance(abbr, list):  # e.g., Pixel Spacing -> [VRX, VRY]
                for a in abbr:
                    flat[a] = full_name
                    abbr_order.append(a)
            else:
                flat[abbr] = full_name
                abbr_order.append(abbr)
    return flat, abbr_order

# ---------------- Metadata extraction ----------------
def extract_metadata(ds, tag_dict):
    """Return {abbr: value} based on DICOM keyword names (not numbers)."""
    info = {}
    for abbr, tag_name in tag_dict.items():
        try:
            kw = tag_name.replace(" ", "")  # e.g., "Patient Sex" -> "PatientSex"
            val = getattr(ds, kw, "")
            if isinstance(val, (list, MultiValue)):
                vals = [str(v) for v in val]
                if abbr == "VRX":
                    info[abbr] = vals[0] if len(vals) > 0 else ""
                elif abbr == "VRY":
                    info[abbr] = vals[1] if len(vals) > 1 else ""
                else:
                    info[abbr] = "|".join(vals)
            else:
                info[abbr] = str(val)
        except (AttributeError, KeyError, InvalidDicomError, TypeError, ValueError):
            info[abbr] = ""
    return info

# ---------------- Read DICOM headers ----------------
def read_headers(root: Path, tag_dict):
    rows = []
    count = 0
    for dp, _, files in os.walk(root):
        for name in files:
            p = Path(dp) / name
            if not is_dicom(p):
                continue
            try:
                ds = pydicom.dcmread(p, stop_before_pixels=True, force=True)
            except (InvalidDicomError, OSError, PermissionError):
                continue
            count += 1
            if getattr(read_headers, "_verbose", False):
                status_print(f"[headers] {count}: {p}")
            meta = extract_metadata(ds, tag_dict)
            study_uid = s(getattr(ds, "StudyInstanceUID", ""))
            series_uid = s(getattr(ds, "SeriesInstanceUID", ""))
            inst_num = to_int_or_none(getattr(ds, "InstanceNumber", None))
            rows.append({
                "TopFolder": top_folder_under_root(root, p),
                "SubFolder": p.parent.name,
                "PatientID": s(getattr(ds, "PatientID", "")),
                "StudyInstanceUID": study_uid,
                "SeriesInstanceUID": series_uid,
                "InstanceNumber": inst_num,
                **meta,
                "Path": str(p),
            })
    return pd.DataFrame(rows), count

# ---------------- Middle-% selection ----------------
def keep_middle_percent(df: pd.DataFrame, percent: int) -> pd.DataFrame:
    if df.empty or percent >= 100:
        return df
    groups = []
    for _, g in df.groupby(["TopFolder", "SubFolder", "PatientID"], dropna=False):
        g_sorted = g.sort_values(
            by=["StudyInstanceUID", "SeriesInstanceUID", "InstanceNumber", "Path"],
            kind="mergesort"
        ).reset_index(drop=True)
        n = len(g_sorted)
        k = max(1, round(n * (percent / 100.0)))
        start = max(0, (n - k) // 2)
        end = start + k
        groups.append(g_sorted.iloc[start:end])
    return pd.concat(groups, ignore_index=True) if groups else df

# ---------------- Build participant table ----------------
def build_table(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame(columns=["#", "Participant (topfolder--subfolder--patient ID)", "NSL"])
    group_cols = ["TopFolder", "SubFolder", "PatientID"]
    exclude = set(group_cols + ["StudyInstanceUID", "SeriesInstanceUID", "InstanceNumber", "Path"])
    meta_cols = [c for c in df.columns if c not in exclude]
    agg_spec = {m: "first" for m in meta_cols}
    agg_spec["Path"] = "count"
    g = (
        df.groupby(group_cols, dropna=False)
          .agg(agg_spec)
          .reset_index()
          .rename(columns={"Path": "NSL"})
    )
    g["Participant"] = g["TopFolder"].astype(str) + "--" + g["SubFolder"].astype(str) + "--" + g["PatientID"].astype(str)
    cols = ["Participant", "NSL"] + meta_cols
    g = g[cols].sort_values("Participant").reset_index(drop=True)
    g.insert(0, "#", range(1, len(g) + 1))
    g.rename(columns={"Participant": "Participant (topfolder--subfolder--patient ID)"}, inplace=True)
    return g

# ---------------- Main ----------------
def main():
    start_time = time.time()
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    ap = argparse.ArgumentParser(description="Generate participant TSV with DICOM metadata and middle-% slice selection.")
    ap.add_argument("--inputdir", required=True, type=str)
    ap.add_argument("--scantype", required=True, type=str)
    ap.add_argument("--middle-percent", type=int, default=100)
    ap.add_argument("--num-samples", type=int, default=1)
    ap.add_argument("--save-fgbg", action="store_true",help="If set, save per-participant foreground/background masks.")
    ap.add_argument("--segmenter", type=str, default="", help="Optional: path to a .py segmentation file (e.g. 'amir.py').")
    ap.add_argument("--verbose", action="store_true", help="Print per-file processing progress.")

    args = ap.parse_args()

    # Determine which segmentation method to use
    if args.segmenter:
        segmenter_fn = load_segmenter_from_file(args.segmenter)
        segmenter_name = Path(args.segmenter).stem
    else:
        segmenter_fn, segmenter_name = load_default_segmenter()

    # Start print
    starting_banner(args.scantype)

    script_dir = Path(__file__).parent
    config_dir = script_dir / "config"
    tag_files = {
        "mri": "mri-tags.yaml",
        "ct": "ct-tags.yaml",
    }
    yaml_filename = tag_files.get(args.scantype.strip().lower(), "mri-tags.yaml")
    yaml_path = config_dir / yaml_filename
    if not yaml_path.exists():
        raise FileNotFoundError(f"{yaml_filename} not found under {config_dir}")

    root = Path(args.inputdir).expanduser().resolve()
    folder_name = root.name

    # Place outputs under the top-level frontend/Data/<dataset>
    out_dir = REPO_ROOT / "frontend" / "Data" / folder_name
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "results.tsv"

    # Load YAML and data
    tag_dict, abbr_order = read_yaml(yaml_path)
    # configure header scan verbosity
    read_headers._verbose = args.verbose  # type: ignore[attr-defined]
    read_headers._progress_every = 200 if not args.verbose else 0  # type: ignore[attr-defined]
    df, _ = read_headers(root, tag_dict)

    iqm_registry = get_iqm_registry()
    iqm_funcs = [entry["func"] for entry in iqm_registry]  # per-slice IQMs
    iqm_names = [entry["name"] for entry in iqm_registry]
    total_iqms_per_participant = len(iqm_names) + 1  # +1 for FAIL_FRAC

    # we will build the final table incrementally, one row per participant
    table_rows = []
    # global counters
    total_participants_processed = 0
    total_thumbs_saved = 0
    total_fg_saved = 0
    total_bg_saved = 0



    # number of metrics
    total_tags_per_participant = len(abbr_order) + 1  # +1 for NSL
    total_iqms_per_participant = len(iqm_funcs)  # number of IQMs (func1, func2, ...)
    total_metrics_per_participant = total_tags_per_participant + total_iqms_per_participant

    # Unique participant count
    participants = df.groupby(["TopFolder", "SubFolder", "PatientID"], dropna=False).ngroups
    status_print(f"The number of participants in the input dataset {folder_name} is {participants}.")

    # Tell user how many tags will be computed per participant (YAML tags + NSL)
    total_tags_per_participant = len(abbr_order) + 1  # +1 for NSL
    status_print(
        f"For each participant, {total_tags_per_participant} TAGs, "
        f"{total_iqms_per_participant} IQMs, totaling {total_metrics_per_participant} metrics will be extracted."
    )

    # Apply middle-% & sampling
    df_kept = keep_middle_percent(df, args.middle_percent)
    if args.num_samples > 1:
        group_cols = ["TopFolder", "SubFolder", "PatientID"]
        df_kept = (
            df_kept
            .sort_values(by=["StudyInstanceUID", "SeriesInstanceUID", "InstanceNumber", "Path"], kind="mergesort")
            .groupby(group_cols, group_keys=False)
            .apply(lambda g: g.iloc[::args.num_samples].copy())
            .reset_index(drop=True)
        )




    # Per-participant
    group_cols = ["TopFolder", "SubFolder", "PatientID"]
    iqm_rows = []  # holds one dict per participant with {Participant..., "MEAN": ..., "RNG": ...}
    for idx, ((top, sub, pid), g) in enumerate(df_kept.groupby(group_cols, dropna=False), start=1):
        status_print(f"------ Participant {idx} of {participants} ------", blink=True)

        outputs_list = []   # for iqms

        # Participant directories
        participant_dirname = safe_name(f"{top}--{sub}--{pid}")
        participant_dir = out_dir / participant_dirname
        participant_dir.mkdir(parents=True, exist_ok=True)

        participant_label_for_name = safe_name(str(pid))
        # List to track saved thumbnail filenames
        image_filenames: List[str] = []

        # Build original (UNpruned) order mapping for filenames
        orig_g = df[(df["TopFolder"] == top) & (df["SubFolder"] == sub) & (df["PatientID"] == pid)].copy()
        orig_sorted = orig_g.sort_values(by=["Path"], kind="mergesort").reset_index(drop=True)
        orig_index = {_norm(p): i for i, p in enumerate(orig_sorted["Path"].tolist(), start=1)}

        # Sort PRUNED set by Path only
        g_sorted = g.sort_values(by=["Path"], kind="mergesort").reset_index(drop=True)

        # Optional FG/BG output dirs
        if args.save_fgbg:
            fg_dir = participant_dir / "foreground"
            bg_dir = participant_dir / "background"
            fg_dir.mkdir(parents=True, exist_ok=True)
            bg_dir.mkdir(parents=True, exist_ok=True)

        # Single pass: save thumbnail + (optional) 2D FG/BG masks
        saved_thumbs = 0
        saved_fg = 0
        saved_bg = 0

        # running accumulators for IQMs: name -> (sum, count)
        iqm_sum = defaultdict(float)
        iqm_n = defaultdict(int)

        # collect tag values once per participant (like build_table would)
        tag_values = {}  # abbr -> value

        for row in g_sorted.itertuples(index=False):
            dcm_path = Path(row.Path)
            try:
                ds = pydicom.dcmread(dcm_path, stop_before_pixels=False, force=True)
            except Exception:
                continue
            if args.verbose:
                status_print(f"[slice] {dcm_path}")

            # Thumbnail (uint8) from DICOM
            img_u8 = dcm_to_uint8(ds)
            if img_u8 is None:
                continue

            # Filename index = original volume index (by Path)
            orig_idx = orig_index.get(_norm(row.Path), saved_thumbs + 1)
            fname = f"{participant_label_for_name}_{orig_idx}.png"

            # Save thumbnail
            try:
                PILImage.fromarray(img_u8).save(participant_dir / fname)
                saved_thumbs += 1
                image_filenames.append(fname)

            except Exception:
                pass

            # 2D FG/BG on this slice using make_masks (no 3D stacking)
            try:
                sl = _read_float32_slice(ds)   # float32 HxW
                fg, bg = segmenter_fn(sl)      # returns HxW binary masks

                fg_vals = sl[fg.astype(bool)]
                bg_vals = sl[bg.astype(bool)]

                # IQMs
                # Online update of IQMs (sum & count), no per-slice list kept
                for fn in iqm_funcs:
                    name, measure = fn(fg_vals, bg_vals)
                    try:
                        m = float(measure)
                    except Exception:
                        m = float("nan")
                    if np.isfinite(m):
                        iqm_sum[name] += m
                        iqm_n[name]   += 1



                if args.save_fgbg:
                    try:
                        PILImage.fromarray((fg.astype(np.uint8) * 255)).save(fg_dir / fname)
                        saved_fg += 1
                    except Exception:
                        pass
                    try:
                        PILImage.fromarray((bg.astype(np.uint8) * 255)).save(bg_dir / fname)
                        saved_bg += 1
                    except Exception:
                        pass
            except Exception:
                # Skip FG/BG if segmentation failed for this slice
                continue

        # Inform BEFORE the first tag line
        status_print(f"{saved_thumbs} thumbnails of participant {pid} have been saved to the output directory.")
        if args.save_fgbg:
            status_print(f"{saved_fg} foreground and {saved_bg} background mask slices of participant {pid} have been saved to the output directory.")
        else:
            status_print(f"Foreground/background masks computed (2D) for participant {top}:{sub}:{pid} (NSL={saved_thumbs}).")



        # NSL
        tag_idx = 1
        nsl = len(g)
        status_print(f"{tag_idx:>{len(str(total_tags_per_participant))}}/{total_metrics_per_participant} TAG {tag_idx:<2} for participant {pid}: NSL= {nsl}")
        tag_idx += 1

        # YAML tags
        for abbr in abbr_order:
            val = first_nonempty_for_col(g, abbr)
            status_print(f"{tag_idx:>{len(str(total_tags_per_participant))}}/{total_metrics_per_participant} TAG {tag_idx:<2} for participant {pid}: {abbr}= {val}")
            tag_values[abbr] = val
            tag_idx += 1

        # IQMs from online accumulators
    iq_idx = 1
    for name in iqm_names:
        n = iqm_n.get(name, 0)
        avg_val = (iqm_sum[name] / n) if n > 0 else float("nan")
        status_print(f"{tag_idx:>{len(str(total_metrics_per_participant))}}/{total_metrics_per_participant} IQM {iq_idx:<2} for participant {pid}: {name}= {avg_val}")
        tag_idx += 1
        iq_idx += 1
    if all(iqm_n.get(name, 0) == 0 for name in iqm_names):
        status_print(f"[warning] No finite IQM values for participant {pid}; all IQMs set to NaN.")

    # finalize and append row to final table
    row_key = f"{top}--{sub}--{pid}"
        row = {
            "#": idx,
            "Participant (topfolder--subfolder--patient ID)": row_key,
            "NSL": nsl,
            "Images": ", ".join(image_filenames),
        }
        for abbr in abbr_order:
            row[abbr] = tag_values.get(abbr, "")
        for name in iqm_names:
            n = iqm_n.get(name, 0)
            row[name] = (iqm_sum[name] / n) if n > 0 else float("nan")
        # Participant-level FAIL_FRAC across IQMs
        fail_name, fail_val = compute_fail_fraction(row, iqm_names)
        fail_display = int(fail_val) if np.isfinite(fail_val) else fail_val
        status_print(f"{tag_idx:>{len(str(total_metrics_per_participant))}}/{total_metrics_per_participant} IQM {iq_idx:<2} for participant {pid}: {fail_name}= {fail_display}")
        row[fail_name] = fail_display
        table_rows.append(row)
        total_participants_processed += 1
        total_thumbs_saved += saved_thumbs
        total_fg_saved += saved_fg
        total_bg_saved += saved_bg




    # Build final table & save
    # Build final DataFrame from the rows we assembled incrementally
    # Stable column order: #, Participant, NSL, YAML tags..., IQMs...
    cols = (
        ["#", "Participant (topfolder--subfolder--patient ID)", "NSL"]
        + list(abbr_order)
        + list(iqm_names)
        + ["FAIL_FRAC", "Images"]
    )
    table = pd.DataFrame(table_rows)
    # ensure all expected columns exist (in case some IQMs/tags missing for some participants)
    for c in cols:
        if c not in table.columns:
            table[c] = np.nan if c in iqm_names else ""
    table = table[cols]
    # cast FAIL_FRAC to int-like string (no decimals) for output
    if "FAIL_FRAC" in table.columns:
        table["FAIL_FRAC"] = table["FAIL_FRAC"].apply(
            lambda x: "" if pd.isna(x) else int(x)
        )
    # prepend 'P' before the patient number in the first column
    table.rename(columns={"#": "P#"}, inplace=True)
    table["P#"] = table["P#"].apply(lambda x: f"P{x}")

    end_time = time.time()
    elapsed = int(end_time - start_time)
    hours = elapsed // 3600
    minutes = (elapsed % 3600) // 60
    seconds = elapsed % 60
    if hours > 0:
        elapsed_str = f"{hours} hours {minutes} mins and {seconds} seconds"
    elif minutes > 0:
        elapsed_str = f"{minutes} mins and {seconds} seconds"
    else:
        elapsed_str = f"{seconds} seconds"


    # create header lines for tags and IQMs
    tag_names_list = ["NSL"] + abbr_order
    iqm_names_list = iqm_names + ["FAIL_FRAC"]
    tag_line = f"#tags ({total_tags_per_participant}): " + ", ".join(f"{i+1}. {name}" for i, name in enumerate(tag_names_list))
    iqm_line = f"#iqms ({total_iqms_per_participant}): " + ", ".join(f"{i+1}. {name}" for i, name in enumerate(iqm_names_list))
    header_lines = [
        f"#start_time: {now}",
        f"#elapsed_time: {elapsed_str}",
        f"#outdir: {out_dir}",
        f"#scantype: {args.scantype.strip().upper()}",
        f"#dataset: {folder_name}",
        f"#settings: inputdir={root} | middle_percent={args.middle_percent} | num_samples={args.num_samples} | segmenter={segmenter_name} | save_fgbg={args.save_fgbg}",
        tag_line,
        iqm_line,
        "#Quality Metrics:",
        ""
    ]

    with open(out_path, "w", encoding="utf-8") as f:
        for line in header_lines:
            f.write(line + "\n")
        table.to_csv(f, sep="\t", index=False)

    print(table.drop(columns=["Images"]).to_string(index=False))
    print(f"\nSaved: {out_path}")

    status_print(
        f"Summary: participants processed={total_participants_processed}, "
        f"thumbnails saved={total_thumbs_saved}, "
        f"foreground masks saved={total_fg_saved}, "
        f"background masks saved={total_bg_saved}"
    )
    status_print(f"\nRadQy took {elapsed_str} to run.")

if __name__ == "__main__":
    main()
