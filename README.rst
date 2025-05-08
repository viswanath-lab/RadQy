RadQy
=====

RadQy is a quality assurance and evaluation tool for quantitative assessment of MRI and CT imaging data.

It computes a variety of image quality metrics (IQMs) to assist with downstream image analysis, machine learning, and radiomic studies.

----

Features:
- Computes over 30 image quality metrics
- Supports T1w, T2w, and CT modalities
- UMAP visualization of quality trends
- CLI for batch processing

----

Installation
------------

From GitHub (latest version):
::

    pip install git+https://github.com/viswanath-lab/RadQy.git

From PyPI (stable, may lag behind):
::

    pip install radqy

----

Usage
-----

Run from command line:

::

    radqy --modality T1w --input my_scan.nii.gz

----

Citation
--------

If you use this software, please cite the corresponding paper (coming soon).
