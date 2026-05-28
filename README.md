<p align="center">
  <img src="https://github.com/user-attachments/assets/98bb587b-2c54-4d56-a240-3e4665674d2f" width="900"/>
</p>

## RadQy

RadQy is a quality assurance and evaluation platform for MRI and CT imaging datasets. It extracts DICOM metadata, computes image quality metrics, generates scan thumbnails, supports foreground/background mask generation, and provides an interactive front-end interface for visual quality review, cohort exploration, and reporting.

## RadQy Demo

Full demo video:
https://youtu.be/pzJUZovFlT0?si=PcMnU4Dhdkh_qTX8


## Front-end View
<img width="800" height="430" alt="radqy_readme_fastx15" src="https://github.com/user-attachments/assets/b6b9fecc-832f-4700-84b1-24a907d9ff20" />



## Backend View
<img width="850" height="457" alt="radqy_readme_1to38_10x" src="https://github.com/user-attachments/assets/152188de-9e67-42c5-b799-07d8abab9271" />



## Key Features

- MRI and CT quality assessment
- DICOM metadata/tag extraction
- Image quality metric computation
- Thumbnail generation for participant-level review
- Optional foreground/background mask export
- Interactive front-end visualization
- Parallel coordinate plots for quality metric exploration
- Subject/table filtering and cohort review
- Support for multiple segmentation options including `otsuhull`, `adaptiveborder`, and `unet`

## Repository Structure

```text
RadQy/
├── backend/          # Processing, IQM, segmentation, and CLI logic
├── frontend/         # Web-based RadQy interface
├── docs/             # Documentation and figures
├── tests/            # Test files
├── tools/            # Utility scripts
├── README.md
├── requirements.txt
└── pyproject.toml


## Installation

Clone the repository:

```bash
git clone https://github.com/viswanath-lab/RadQy.git
cd RadQy
```

Create an environment:

```bash
conda create -n radqy python=3.10
conda activate radqy
```

Install requirements:

```bash
pip install -r requirements.txt
```

## Running RadQy

Basic command:

```bash
python backend/main.py --inputdir "PATH_TO_DICOM_DATASET" --scantype mri
```

For CT data:

```bash
python backend/main.py --inputdir "PATH_TO_DICOM_DATASET" --scantype ct
```

Example with options:

```bash
python backend/main.py ^
  --inputdir "E:\Data\Rectal\input_data_folder" ^
  --scantype mri ^
  --middle-percent 50 ^
  --num-samples 2 ^
  --save-fgbg ^
  --segmenter otsuhull
```

## Main Options

```text
--inputdir          Root folder containing participant DICOM files
--scantype          Scan type: mri or ct
--middle-percent    Percent of middle slices to process
--num-samples       Slice sampling stride
--save-fgbg         Save foreground/background masks
--segmenter         Segmentation method: adaptiveborder, otsuhull, regiongrowing, unet, fcn, mobilenet
--verbose           Print detailed per-file processing progress
```

## Output

RadQy creates an output folder under:

```text
frontend/Data/<dataset_name>/
```

The main output file is:

```text
results.tsv
```

The output includes:

* participant-level metadata
* number of slices
* extracted DICOM tags
* image quality metrics
* thumbnail image filenames
* optional foreground/background mask outputs

## Front-End Interface

After generating `results.tsv`, open the RadQy front-end from the `frontend` folder and load the generated dataset output.



## Feedback and usage

Please report and issues, bugfixes, ideas for enhancements via the "[Issues](https://github.com/ccipd/MRQy/issues)" tab.

Detailed usage instructions and an example of using MRQy to analyze TCIA datasets are in the [Wiki](https://github.com/ccipd/MRQy/wiki).

You can cite this in any associated publication as:  
Sadri, AR, Janowczyk, A, Zou, R, Verma, R, Beig, N, Antunes, J, Madabhushi, A, Tiwari, P, Viswanath, SE, "Technical Note: MRQy — An open-source tool for quality control of MR imaging data", Med. Phys., 2020, 47: 6029-6038. https://doi.org/10.1002/mp.14593

ArXiv: https://arxiv.org/abs/2004.04871

If you do use the tool in your own work, please drop us a line to let us know.
