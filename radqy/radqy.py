import SimpleITK as sitk
import datetime
import time
import os
import sys
import re
import argparse
import yaml
import pydicom
import numpy as np
from itertools import accumulate
from collections import Counter
import matplotlib.pyplot as plt
import inspect
from skimage.filters import threshold_otsu
from skimage.morphology import convex_hull_image
from skimage.feature import local_binary_pattern
from skimage import exposure as ex
import pandas as pd
import matplotlib.cm as cm
from scipy.signal import convolve2d as conv2
from skimage.filters import median
from skimage.morphology import square
from pathlib import Path
# from scipy.io import loadmat
import warnings
warnings.filterwarnings("ignore")



# Utility functions
def clean_array(array, fallback=1e-6):
    """Replaces NaNs in an array with a fallback value."""
    array = np.nan_to_num(array, nan=fallback)
    if len(array) == 0:
        return np.array([fallback])
    return array

def psnr(img1, img2):
    mse = np.square(np.subtract(img1, img2)).mean()
    return 20 * np.log10(np.nanmax(img1) / np.sqrt(mse))

def patch(img, patch_size):
    h = int(np.floor(patch_size / 2))
    U = np.pad(img, pad_width=5, mode='constant')
    [a, b] = np.where(img == np.max(img))
    a = a[0]
    b = b[0]
    return U[a:a+2*h+1, b:b+2*h+1]

# Updated metric functions
def func1(F, B, c, f, b):
    name = 'MEAN'
    measure = np.mean(clean_array(f))
    return name, measure

def func2(F, B, c, f, b):
    name = 'RNG'
    f = clean_array(f)
    measure = np.ptp(f)
    return name, measure

def func3(F, B, c, f, b):
    name = 'VAR'
    f = clean_array(f)
    measure = np.var(f)
    return name, measure

def func4(F, B, c, f, b):
    name = 'CV'
    f = clean_array(f)
    measure = (np.std(f) / np.mean(f)) * 100 if np.mean(f) > 0 else 0
    return name, measure

def func5(F, B, c, f, b):
    name = 'CPP'
    filt = np.array([[-1/8, -1/8, -1/8], [-1/8, 1, -1/8], [-1/8, -1/8, -1/8]])
    I_hat = conv2(F, filt, mode='same')
    measure = np.mean(clean_array(I_hat))
    return name, measure

def func6(F, B, c, f, b):
    name = 'PSNR'
    F = clean_array(F)
    max_val = np.max(F)
    if max_val <= 0:
        measure = 0  # Fallback value for invalid data
    else:
        I_hat = median(F / max_val, square(5))
        mse = np.mean((F - I_hat) ** 2)
        measure = 20 * np.log10(max_val / (np.sqrt(mse) + 1e-9)) if mse > 0 else 0
    return name, measure

def func7(F, B, c, f, b):
    name = 'SNR1'
    f = clean_array(f)
    b = clean_array(b)
    bg_std = np.std(b)
    measure = np.std(f) / (bg_std + 1e-9)
    return name, measure

def func8(F, B, c, f, b):
    name = 'SNR2'
    b = clean_array(b)
    bg_std = np.std(b)
    measure = np.mean(patch(F, 5)) / (bg_std + 1e-9)
    return name, measure

def func9(F, B, c, f, b):
    name = 'SNR3'
    fore_patch = patch(F, 5)
    fore_patch = clean_array(fore_patch)
    std_diff = np.std(fore_patch - np.mean(fore_patch))
    std_diff = std_diff if std_diff > 0 else 1e-9
    measure = np.mean(fore_patch) / std_diff
    return name, measure

def func10(F, B, c, f, b):
    name = 'SNR4'
    fore_patch = patch(F, 5)
    back_patch = patch(B, 5)
    fore_patch = clean_array(fore_patch)
    back_patch = clean_array(back_patch)
    bg_std = np.std(back_patch)
    bg_std = bg_std if bg_std > 0 else 1e-9
    measure = np.mean(fore_patch) / bg_std
    return name, measure

def func11(F, B, c, f, b):
    name = 'SNR5'
    window_size = 5
    local_variance = conv2(F**2, np.ones((window_size, window_size)), mode='valid') / window_size**2 - \
                     (conv2(F, np.ones((window_size, window_size)), mode='valid') / window_size)**2
    local_variance = clean_array(local_variance)
    noise_estimate = np.sqrt(np.mean(local_variance))
    signal_estimate = np.mean(clean_array(f))
    measure = signal_estimate / (noise_estimate + 1e-9) if noise_estimate > 0 else 0
    return name, measure

def func15(F, B, c, f, b):
    name = 'SNR9'
    try:
        LBP_texture = local_binary_pattern(F, P=8, R=1)
        texture_regions = LBP_texture[(LBP_texture > np.percentile(LBP_texture, 95))]
        if len(texture_regions) == 0:
            noise_estimate = 1e-6
        else:
            noise_estimate = max(np.std(texture_regions), 1e-6)
        signal_estimate = np.mean(clean_array(f))
        measure = signal_estimate / noise_estimate
    except Exception:
        measure = 0  # Fallback for LBP errors
    return name, measure

def func16(F, B, c, f, b):
    name = 'CNR'
    fore_patch = patch(F, 5)
    back_patch = patch(B, 5)
    fore_patch = clean_array(fore_patch)
    back_patch = clean_array(back_patch)
    measure = np.mean(fore_patch - back_patch) / (np.std(back_patch) + 1e-6)
    return name, measure

def func17(F, B, c, f, b):
    name = 'CVP'
    fore_patch = patch(F, 5)
    fore_patch = clean_array(fore_patch)
    measure = np.std(fore_patch) / (np.mean(fore_patch) + 1e-6)
    return name, measure

def func18(F, B, c, f, b):
    name = 'CJV'
    f = clean_array(f)
    b = clean_array(b)
    measure = (np.std(f) + np.std(b)) / abs(np.mean(f) - np.mean(b))
    return name, measure

def func19(F, B, c, f, b):
    name = 'EFC'
    F = clean_array(F)
    n_vox = F.shape[0] * F.shape[1]
    if n_vox == 0:
        measure = 0  # Fallback for empty images
    else:
        efc_max = 1.0 * n_vox * (1.0 / np.sqrt(n_vox)) * np.log(1.0 / np.sqrt(n_vox))
        cc = (F**2).sum()
        b_max = np.sqrt(abs(cc)) if cc > 0 else 1e-6  # Prevent zero or negative square roots
        measure = (1.0 / abs(efc_max)) * np.sum((F / b_max) * np.log((F + 1e-16) / b_max))
    return name, measure

def func20(F, B, c, f, b):
    name = 'FBER'
    fg_mu = np.median(clean_array(f) ** 2)
    bg_mu = np.median(clean_array(b) ** 2)
    measure = fg_mu / (bg_mu + 1e-6) if bg_mu > 1.0e-3 else 0
    return name, measure

def clean_value(number):
    if isinstance(number, (int, float)):
        number = '{:.2f}'.format(number)
        if number.replace(".", "", 1).isdigit():
            number = float(number)
            if number % 1 == 0:
                number = int(number)
            else:
                number = round(number, 2)
    number = np.array(number)
    return number




def extract_tags(image, tag_data, file_type='dicom', image_shape=None):
    non_tag_value = 'NA'
    pre_tags = pd.DataFrame.from_dict(tag_data, orient='index', columns=['Tag Abbreviation']).reset_index()
    pre_tags = pre_tags.rename(columns={'index': 'Tag Name'})
    pre_tags['Tag Abbreviation'] = pre_tags['Tag Abbreviation'].apply(lambda x: ','.join(x) if isinstance(x, list) else x)
    tags = pd.DataFrame(columns=['Tag', 'Value'])

    available_tags = {}
    if file_type == 'dicom':
        available_tags = {tag: image.get(tag, non_tag_value) for tag in image.dir()}
    elif file_type == 'mha' or file_type == 'nifti':
        available_tags = {tag: image.GetMetaData(tag) for tag in image.GetMetaDataKeys()}
    elif file_type == 'mat':
        available_tags = {}  # Add MAT specific metadata extraction here if needed

    for i, row in pre_tags.iterrows():
        pre_tag = row['Tag Name']
        pre_tag = pre_tag.replace(" ", "")
        tag_value = available_tags.get(pre_tag, non_tag_value)

        # Handle specific tags for non-DICOM images
        if file_type in ['mha', 'nifti']:
            if pre_tag == "Rows":
                tag_value = image.GetSize()[1] if tag_value == non_tag_value else tag_value
            if pre_tag == "Columns":
                tag_value = image.GetSize()[0] if tag_value == non_tag_value else tag_value
            if pre_tag == "PixelSpacing":
                tag_value = list(image.GetSpacing()) if tag_value == non_tag_value else tag_value
            if pre_tag == "SliceThickness":
                tag_value = image.GetSpacing()[2] if tag_value == non_tag_value else tag_value

        if tag_value != non_tag_value:
            tag_value = clean_value(tag_value)
            tag = row['Tag Abbreviation']
            mul_tags = tag.split(',')
            for j, k in enumerate(mul_tags):
                if np.iterable(tag_value):
                    tag_value_j = tag_value[j] if j < len(tag_value) else non_tag_value
                else:
                    tag_value_j = tag_value
                new_row = {'Tag': k, 'Value': tag_value_j}
                tags = pd.concat([tags, pd.DataFrame([new_row])], ignore_index=True)
                
    return tags





def input_data(root):
    files = [str(Path(dirpath) / filename) for dirpath, _, filenames in os.walk(root)
             for filename in filenames
             if filename.endswith(('.dcm', '.mha', '.nii', '.gz', '.mat'))]

    dicom_files = [i for i in files if i.endswith('.dcm')]
    mha_files = [i for i in files if i.endswith('.mha')]
    nifti_files = [i for i in files if i.endswith('.nii') or i.endswith('.gz')]
    mat_files = [i for i in files if i.endswith('.mat')]

    def extract_subject_id(filename):
        subject_id = Path(filename).stem
        if subject_id.endswith('.nii'):  # For files like .nii.gz
            subject_id = subject_id[:-4]
        return subject_id.split('.')[0]

    # Extract PatientID and construct file-based unique identifier
    dicom_pre_subjects = []
    dicom_combined_subjects = []

    for dicom_file in dicom_files:
        try:
            dcm_data = pydicom.dcmread(dicom_file)
            patient_id = dcm_data.get("PatientID", "Unknown").strip()
            dicom_pre_subjects.append(patient_id)
            file_name = Path(dicom_file).stem
            dicom_combined_subjects.append(f"{file_name}_{patient_id}")
        except Exception as e:
            print(f"Could not read DICOM file: {dicom_file}. Error: {e}")
            dicom_pre_subjects.append("Unknown")
            dicom_combined_subjects.append(f"{Path(dicom_file).stem}_Unknown")

    mhas_subjects = [extract_subject_id(scan) for scan in mha_files]
    nifti_subjects = [extract_subject_id(scan) for scan in nifti_files]
    mat_subjects = [extract_subject_id(scan) for scan in mat_files]

    duplicateFrequencies_dicom = Counter(dicom_combined_subjects)
    dicom_subjects = list(duplicateFrequencies_dicom.keys())

    dicom_scan_numbers = list(duplicateFrequencies_dicom.values())
    ind = [0] + list(accumulate(dicom_scan_numbers))
    dicom_splits = [dicom_files[ind[i]:ind[i+1]] for i in range(len(ind)-1)]

    subjects_id = dicom_subjects + mhas_subjects + nifti_subjects + mat_subjects

    data = {'subject_id': subjects_id, 
            'subject_type': ['dicom' if subject in dicom_subjects 
                             else 'mha' if subject in mhas_subjects 
                             else 'nifti' if subject in nifti_subjects 
                             else 'mat' for subject in subjects_id]}
    df = pd.DataFrame(data)
    df['dicom_splits'] = [dicom_splits[dicom_subjects.index(subject)] if subject in dicom_subjects else None for subject in df['subject_id']]
    df['path'] = [path if subject_type == 'dicom' else
                  next((mha for mha in mha_files if extract_subject_id(mha) == subject), None) if subject_type == 'mha' else
                  next((nifti for nifti in nifti_files if extract_subject_id(nifti) == subject), None) if subject_type == 'nifti' else
                  next((mat for mat in mat_files if extract_subject_id(mat) == subject), None) if subject_type == 'mat' else
                  None
                  for path, subject, subject_type in zip(df['dicom_splits'], df['subject_id'], df['subject_type'])]
    df.drop('dicom_splits', axis=1, inplace=True)

    print(f'The number of participants is {len(df)}.')
    return df





def volume(name, scans, subject_type, tag_data, middle_size=100):
    volumes = []
    if subject_type == 'dicom':
        scans = scans[int(0.005 * len(scans) * (100 - middle_size)):int(0.005 * len(scans) * (100 + middle_size))]
        inf = pydicom.dcmread(scans[0])
        tags = extract_tags(inf, tag_data, file_type='dicom')
        
        # Convert tags to DataFrame if it's not already
        if isinstance(tags, dict):
            tags = pd.DataFrame.from_dict(tags, orient='index', columns=['Value']).reset_index()
            tags.rename(columns={'index': 'Tag'}, inplace=True)
        
        first_row = {'Tag': 'Participant ID', 'Value': f"{name}"}
        tags.loc[-1] = first_row
        tags.index = tags.index + 1
        tags = tags.sort_index()

        slices = [pydicom.read_file(s) for s in scans]
        slices.sort(key=lambda x: int(x.InstanceNumber) if x.InstanceNumber is not None else 0)
        images = np.stack([s.pixel_array for s in slices])
        images = images.astype(np.int64)
        volumes.append((images, tags))
    elif subject_type in ['mha', 'nifti']:
        image = sitk.ReadImage(scans)
        image_array = sitk.GetArrayFromImage(image)
        tags = extract_tags(image, tag_data, file_type=subject_type, image_shape=image_array.shape)
        
        # Convert tags to DataFrame if it's not already
        if isinstance(tags, dict):
            tags = pd.DataFrame.from_dict(tags, orient='index', columns=['Value']).reset_index()
            tags.rename(columns={'index': 'Tag'}, inplace=True)
        
        images = [image_array[i, :, :] for i in range(image_array.shape[0])]
        middle_index = len(images) // 2
        slices_to_include = int(middle_size * 0.01 * len(images) / 2)
        images = images[middle_index - slices_to_include: middle_index + slices_to_include]
        images = np.stack(images, axis=0)
        volumes.append((images, tags))
    elif subject_type == 'mat':
        images = loadmat(scans)['vol']
        tags = extract_tags(images, tag_data, file_type=subject_type, image_shape=images.shape)
        
        # Convert tags to DataFrame if it's not already
        if isinstance(tags, dict):
            tags = pd.DataFrame.from_dict(tags, orient='index', columns=['Value']).reset_index()
            tags.rename(columns={'index': 'Tag'}, inplace=True)
        
        middle_index = len(images) // 2
        slices_to_include = int(middle_size * 0.01 * len(images) / 2)
        images = images[middle_index - slices_to_include: middle_index + slices_to_include]
        images = np.transpose(images, (2, 0, 1))
        volumes.append((images, tags))
    return volumes


class IQM(dict):

    def __init__(self, v, participant, total_participants, participant_index, subject_type, total_tags):
        print(f'-------------- Participant {participant_index} out of {total_participants} with the {subject_type} type: {participant} --------------')
        dict.__init__(self)
        self["warnings"] = [] 
        self["output"] = []
        directory_path = Path(fname_outdir) / participant
        if save_masks_flag != False: 
            maskfolder = Path(fname_outdir / 'foreground_masks')
            (maskfolder / participant).mkdir(parents=True, exist_ok=True)
        directory_path.mkdir(parents=True, exist_ok=True)
        self.addToPrintList(0, participant, "Participant", participant, 25)
        count = 1
        for volume_data in v:
            if isinstance(volume_data, tuple) and len(volume_data) == 2:
                total_metrics = total_tags + len(functions) + 2  # + 1 for NUM + 1 for INS
                images = volume_data[0]
                tags = volume_data[1]
                for idx, row in tags.iterrows():
                    metric = row['Tag']
                    value = row['Value']
                    self.addToPrintList(count, participant, metric, value, total_metrics)
                    count += 1
            else:
                total_metrics = len(functions) + 1  # + 1 for NUM + 1 for INS
                images = volume_data
                count = 0

        participant_scan_number = int(np.ceil(images.shape[0] / sample_size))
        self["participant_scan_number"] = participant_scan_number 
        self["os_handle"] = images      
        outputs_list = []
        for j in range(0, images.shape[0], sample_size):
            I = images[j, :, :]
            folder = Path(fname_outdir)
            self.save_image(participant, I, j, folder)
            if scan_type == "CT": 
                I = I - np.min(I)  # Apply intensity adjustment only for CT scans 
            F, B, c, f, b = self.foreground(I)
            if save_masks_flag != False: 
                self.save_image(participant, c, j, maskfolder)
                
            outputs = {}
            for func in functions:
                name, measure = func(F, B, c, f, b)
                outputs[name] = measure
            outputs_list.append(outputs)
        print(f'The number of {participant_scan_number} scans were saved to {fname_outdir / participant} directory.')
        if save_masks_flag != False: 
            print(f'The number of {participant_scan_number} masks were also saved to {maskfolder / participant} directory.')
        
        self.addToPrintList(1, participant, "Name of Images", os.listdir(directory_path), 25)
        # count += 1
        self.addToPrintList(count, participant, "NUM", participant_scan_number, total_metrics)
        averages = {}
        for key in outputs_list[0].keys():
            values = [dic[key] for dic in outputs_list]
            averages[key] = np.mean(values) 
            count += 1
            self.addToPrintList(count, participant, key, averages[key], total_metrics)

    
    def save_image(self, participant, I, index, folder):
        # Ensure the folder exists
        participant_dir = folder / participant
        participant_dir.mkdir(parents=True, exist_ok=True)
    
        # Handle unexpected shapes
        if I.ndim == 3 and I.shape[0] > 1:  # Multi-channel or stacked images
            I = I[0, :, :]  # Select the first channel (or modify as needed)
        elif I.ndim != 2:
            raise ValueError(f"Unsupported image shape: {I.shape}. Expected 2D grayscale or 3D RGB/RGBA.")
    
        # Save the image
        filename = f"{participant}({index}).png"
        image_path = participant_dir / filename
        plt.imsave(image_path, I, cmap=cm.Greys_r)



    def foreground(self, img):
        try:
            h = ex.equalize_hist(img[:, :]) * 255
            oi = np.zeros_like(img, dtype=np.uint16)
            oi[(img > threshold_otsu(img)) == True] = 1
            oh = np.zeros_like(img, dtype=np.uint16)
            oh[(h > threshold_otsu(h)) == True] = 1
            nm = img.shape[0] * img.shape[1]
            w1 = np.sum(oi) / nm
            w2 = np.sum(oh) / nm
            ots = np.zeros_like(img, dtype=np.uint16)
            new = (w1 * img) + (w2 * h)
            ots[(new > threshold_otsu(new)) == True] = 1 
            conv_hull = convex_hull_image(ots)
            ch = np.multiply(conv_hull, 1)
            fore_image = ch * img
            back_image = (1 - ch) * img
        except Exception: 
            fore_image = img.copy()
            back_image = np.zeros_like(img, dtype=np.uint16)
            conv_hull = np.zeros_like(img, dtype=np.uint16)
            ch = np.multiply(conv_hull, 1)

        return fore_image, back_image, conv_hull, img[conv_hull], img[conv_hull == False]

    def addToPrintList(self, count, participant, metric, value, total_metrics):
        self[metric] = value
        self["output"].append(metric)
        if metric != 'Name of Images' and metric != 'Participant':
            print(f'{count}/{total_metrics-1}) The {metric} of the participant {participant} is {value}.')

    def get_participant_scan_number(self): 
        return self["participant_scan_number"]


    

def worker_callback(s, fname_outdir):
    global csv_report, first, nfiledone
    if nfiledone == 0:
        csv_report = open(Path(fname_outdir) / "results.tsv", overwrite_flag, buffering=1)
        first = True

    if first and overwrite_flag == "w":
        first = False
        csv_report.write("\n".join(["#" + s for s in headers]) + "\n")
        csv_report.write("#dataset:" + "\n")
        csv_report.write("\t".join(s["output"]) + "\n")

    csv_report.write("\t".join([str(s[field]) for field in s["output"]]) + "\n")
    csv_report.flush()
    nfiledone += 1

def print_msg_box(msg, indent=1, width=None, title=None):
    lines = msg.split('\n')
    space = " " * indent
    if not width:
        width = max(map(len, lines))
    box = f'╔{"═" * (width + indent * 2)}╗\n'  
    if title:
        box += f'║{space}{title:<{width}}{space}║\n'  
        box += f'║{space}{"-" * len(title):<{width}}{space}║\n'  
    box += ''.join([f'║{space}{line:<{width}}{space}║\n' for line in lines])
    box += f'╚{"═" * (width + indent * 2)}╝' 
    print(box)   

###############################################################################################

nfiledone = 0
csv_report = None
first = True
headers = []

if __name__ == '__main__':
    start_time = time.time() 
    headers.append(f"start_time:\t{datetime.datetime.now()}")
    parser = argparse.ArgumentParser(description='')
    parser.add_argument('output_folder_name',
                        help="the subfolder name on the '...\\UserInterface\\Data\\output_folder_name' directory.",
                        type=str)
    parser.add_argument('inputdir',
                        help="input foldername consists of *.dcm, *.mha, *.nii or *.mat files. For example: 'E:\\Data\\Rectal\\input_data_folder'",
                        type=str)
    parser.add_argument('modality',
        help="Image modality type can either be 'MRI' or 'CT'.",
        type=str,
        choices=['MRI', 'CT'])
    parser.add_argument('-s', help="save foreground masks", type=lambda x: False if x == '0' else x, default=False)
    parser.add_argument('-b', help="number of samples", type=int, default=1)
    parser.add_argument('-u', help="percent of middle images", type=int, default=100)
    args = parser.parse_args() 
    root = args.inputdir
    save_masks_flag = args.s
    sample_size = args.b
    middle_size = args.u
    scan_type = args.modality
    print(f'RadQy for the {scan_type} data is starting....')
    
    overwrite_flag = "w" 
    print_forlder_note = Path.cwd() / 'UserInterface'
    output_folder_name = args.output_folder_name
    fname_outdir = print_forlder_note / 'Data' / output_folder_name
    headers.append(f"outdir:\t{Path(fname_outdir).resolve()}")
    headers.append(f"scantype:\t{scan_type}")
    df = input_data(root)
    total_participants = len(df)
    
    functions = [func for name, func in inspect.getmembers(sys.modules[__name__]) if name.startswith('func')]
    functions = sorted(functions, key=lambda f: int(re.search(r'\d+', f.__name__).group()))

    
    if 'dicom' in df['subject_type'].values:
        tag_filename = "MRI_TAGS.yaml" if scan_type == "MRI" else "CT_TAGS.yaml"
        with open(tag_filename, 'rb') as file:
            tag_data = yaml.safe_load(file)
        total_tags = sum(len(value) if isinstance(value, list) else 1 for value in tag_data.values())
        print(f'For each participant with dicom files, {total_tags} tags will be extracted and {len(functions) + 2} metrics will be computed.')
    else:
        tag_filename = "MRI_TAGS.yaml" if scan_type == "MRI" else "CT_TAGS.yaml"
        with open(tag_filename, 'rb') as file:
            tag_data = yaml.safe_load(file)
        sample_image = sitk.ReadImage(df['path'][0]) if df['subject_type'][0] != 'dicom' else None
        sample_tags = extract_tags(sample_image, tag_data, file_type=df['subject_type'][0], image_shape=sitk.GetArrayFromImage(sample_image).shape)
        total_tags = len(sample_tags)
        print(f'For each participant with nondicom files, {total_tags} tags will be extracted and {len(functions) + 1} metrics will be computed.')


    time.sleep(3)

    total_scans = 0
    for i in range(total_participants):
        participant_index = i + 1
        name = df['subject_id'][i]
        scans = df['path'][i]
        subject_type = df['subject_type'][i]
        v = volume(name, scans, subject_type, tag_data)
        s = IQM(v, name, total_participants, participant_index, subject_type, total_tags)
        total_scans += s.get_participant_scan_number()
        worker_callback(s, fname_outdir)

    address = Path(fname_outdir) / "results.tsv"
    cf = pd.read_csv(address, sep='\t', skiprows=4, header=0)
    cf = cf.drop(['Name of Images'], axis=1)
    cf = cf.fillna('N/A')
    cf.to_csv(Path(fname_outdir) / 'IQM.csv', index=False)
    print(f"The IQMs data are saved in the {Path(fname_outdir) / 'IQM.csv'} file.")
    
    print("Done!")
    print("MRQy backend took", format((time.time() - start_time) / 60, '.2f'),
          "minutes for {} subjects and the overall {} {} scans to run.".format(total_participants, total_scans, scan_type))
    
    print_folder_path = Path(print_forlder_note)
    results_file_path = Path(fname_outdir) / "results.tsv"
    
    msg = (f"Please go to the '{print_folder_path}' directory and open up the 'index.html' file.\n"
           f"Click on 'View Results' and select '{results_file_path}' file.\n")
          
    print_msg_box(msg, indent=3, width=None, title="To view the final MRQy interface results:")
