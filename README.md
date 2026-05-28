<!-- ![Picture1](https://user-images.githubusercontent.com/50635618/77593997-b1492a00-6ecb-11ea-939c-c8962f371e5a.png) -->

![alt text](image.png)

## Front-end View
![gbm_mrqy](https://user-images.githubusercontent.com/50635618/77496601-b6519f00-6e21-11ea-8f52-16f33d4c66cc.gif)

## Backend View
![gbm_mrqy](https://user-images.githubusercontent.com/50635618/77506445-43095680-6e3c-11ea-9376-7be6f7cdc5d8.gif)
 


# Table of Contents






## Description


This tool takes **MRI** or **CT** datasets in the file formats as the input. \
A CLI command is used to generate several tags and noise/information measurements for quality assessment. These scripts save the calculated measures in a  _.tsv_ file as well as generate _.png_ thumbnails for all images in a subject volume. These are then fed to _.js_ scripts to create the user interface (_index.html_) output. A schematic illustrating the framework of the tool is as follows.



![Picture1](https://user-images.githubusercontent.com/50635618/76675455-07df6b80-6590-11ea-85f7-13b71a9a1ec3.png)




## Installation

RadQy can be installed via `pip` or `conda`.

### Using pip

```bash
pip install radqy
```

### Using conda

```bash
conda create -n radqy python=3.10
conda activate radqy
pip install radqy
```

## Running

Display the help message:
  
```bash
radqy --help
```
Expected Output:

```
usage: radqy [-h] [--ui-download] [--ui-run] [-s S] [-b B] [-u U] [-t {MRI,CT}]
             output_folder_name inputdir [inputdir ...]

positional arguments:
  output_folder_name    The subfolder name in the '...\UserInterface\Data\output_folder_name' directory.
  inputdir              Input folder(s) containing *.dcm, *.mha, *.nii, or *.mat files.
                        Example: 'E:\Data\Rectal\input_data_folder'

optional arguments:
  -h, --help            Show this help message and exit
  --ui-download         Download the UserInterface.zip file
  --ui-run              Run the User Interface
  -s S                  Save foreground masks (default: False)
  -b B                  Number of samples (default: 1)
  -u U                  Percent of middle images to process (default: 100)
  -t {MRI,CT}           Type of scan (MRI or CT) 
```



### Running the Quality Control Script

Run the **radqy** command using the following syntax:

```bash
radqy output_folder_name "input_directory" [options]
```

Example:

```bash
radqy output_results "E:\Data\Rectal\input_data_folder" -s True -b 5 -u 50 -t CT
```

Arguments:

- **output_folder_name (required)**: The subfolder name in the `...\UserInterface\Data\output_folder_name` directory.
- **input_directory (required)**: Path to the input directory containing image files.

Options:

- **-s**: Save foreground masks (`True` or `False`). Default is `False`.
- **-b**: Number of samples. Default is `1`.
- **-u**: Percent of middle images to process. Default is `100`.
- **-t** (required): Type of scan (`MRI` or `CT`). 

Notes:

- There is no need to manually create a subfolder in the Data directory; specifying its name in the command is sufficient.
- All actions will be printed in the output console for transparency.
- Thumbnail images in .png format will be saved in `...\UserInterface\Data\output_folder_name`, with each original filename as a subfolder name.

### Running the User Interface

#### Download the User Interface

To download the User Interface, run the following command:

```bash
radqy --ui-download
```

This command will download and unzip the User Interface into the appropriate directory.


#### Run the User Interface
To run the User Interface, execute:
  
```bash
radqy --ui-run
```

If the User Interface is not already downloaded, this command will download it automatically before launching.

#### Accessing the Front-End Interface Manually
If you prefer to access the User Interface without using the **--ui-run** command:

1. Open the Interface:
Navigate to the UserInterface directory (e.g., `C:\Users\YourUserName\.radqy\UserInterface`).
Double-click on `index.html` to open the front-end user interface.

2. Load Results:

In the interface, select the appropriate **results.tsv** file from the `...\UserInterface\Data\output_folder_name directory`.


### Measurements

The measures of the MRQy tool are listed in the following table.

![Picture1](https://user-images.githubusercontent.com/50635618/76733243-cb9a3f80-6736-11ea-8100-a1bdb6f60d3f.png)


### User Interface

The following figures show the user interface of the tool (index.html). 

![C1](https://user-images.githubusercontent.com/50635618/78467306-3ce76580-76d9-11ea-8dbd-d43f82cd29a6.PNG)
![C2](https://user-images.githubusercontent.com/50635618/78467302-3bb63880-76d9-11ea-84ff-ce44f5f8a822.PNG)
![C3](https://user-images.githubusercontent.com/50635618/78467305-3ce76580-76d9-11ea-96a8-7574042c14c6.PNG)

## Feedback and usage

Please report and issues, bugfixes, ideas for enhancements via the "[Issues](https://github.com/ccipd/MRQy/issues)" tab.

Detailed usage instructions and an example of using MRQy to analyze TCIA datasets are in the [Wiki](https://github.com/ccipd/MRQy/wiki).

You can cite this in any associated publication as:  
Sadri, AR, Janowczyk, A, Zou, R, Verma, R, Beig, N, Antunes, J, Madabhushi, A, Tiwari, P, Viswanath, SE, "Technical Note: MRQy — An open-source tool for quality control of MR imaging data", Med. Phys., 2020, 47: 6029-6038. https://doi.org/10.1002/mp.14593

ArXiv: https://arxiv.org/abs/2004.04871

If you do use the tool in your own work, please drop us a line to let us know.
