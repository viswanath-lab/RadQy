import sys
import argparse
import datetime

from .radqy import main

from .ui_handlers import ui_download, ui_unzip, ui_run

def run_cli():
    headers = []
    headers.append(f"start_time:\t{datetime.datetime.now()}")

    parser = argparse.ArgumentParser(description='')

    # UI arguments
    parser.add_argument('--ui-download', action='store_true', help='Download the UserInterface.zip file')
    parser.add_argument('--ui-run', action='store_true', help='Run the User Interface')

   # Required arguments
    parser.add_argument('output_folder_name', nargs='?', type=str, help="The subfolder name in the '...\\UserInterface\\Data\\output_folder_name' directory.")
    parser.add_argument('inputdir', nargs='*', help="Input folder name consisting of *.dcm, *.mha, *.nii or *.mat files. For example: 'E:\\Data\\Rectal\\input_data_folder'")
   
    # Optional arguments
    parser.add_argument('-s', help="save foreground masks", type=lambda x: False if x == '0' else x, default=False)
    parser.add_argument('-b', help="number of samples", type=int, default=1)
    parser.add_argument('-u', help="percent of middle images", type=int, default=100)
    parser.add_argument('-t', help="type of scan (MRI or CT)", default='MRI', choices=['MRI', 'CT'])


    args = parser.parse_args() 

    if args.ui_download:
        ui_download()
        ui_unzip()
        sys.exit(0)
           
    if args.ui_run:
        ui_run()
        sys.exit(0) 

    if not args.output_folder_name or not args.inputdir:
        parser.error("The following arguments are required: output_folder_name, inputdir")
    else:
        main(args)




