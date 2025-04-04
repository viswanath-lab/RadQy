/**********************************************
 ****** RUN-TIME VARIABLES [DO NOT EDIT] ******
 ****** initialized before document ready *****
 **********************************************/

/******************** DATASET *****************/
var ORIGINAL_DATASET = [],
	columnInfo = {},
	CURRENT_MULTI_SELECTED = [],
	ORIGINAL_CASE_LIST = [],
	ORIGINAL_CASE_DICT = {},
	ORIGINAL_FEATURE_LIST = [];
	image_names = [];
	test_value = 0;
	participant_names = [];
var CURRENT_SELECTED = "";
// decide which attributes to keep in ORIGINAL_CASE_DICT
var FEATURES_TO_MAP = ["outdir"];
var FEATURES_TO_MAP = 3;
// current sorting attribute
var CURRENT_SORT_ATTRIBUTE;
// all possible views
var ORIGINAL_VIEWS = ["table", "table_meas", "chart", "image", "tsne", "umap"];
// current showing views
var CURRENT_DISPLAY_VIEWS = [];
var APP_INITIALIZED = false;
var FILE_NAME = "";
var FILE_HEADER = "";


/****************** TABLE VIEW ****************/
var TABLE;
var DATA_TABLE_CONFIG = {
	paging: true,
	scrollY: "165px",
	scrollX: true,
	scroller: true,
	// scrollCollapse: true,
	// colReorder: true,
	// select: true,
	dom: '<"table-content col-11"t><"table-control col-1"B>', //Blfrip
	keys: true,
	buttons: [
		{
			extend: 'copy',
			text: 'Copy',
			exportOptions: {
				columns: ':visible'
			}
		},
		{
			extend: 'csv',
			text: 'Save',
			fieldSeparator: "\t",
			fieldBoundary: "",
			filename: "result_revised_tags",
			extension: ".tsv",
			customize: function (csv) {
				console.log(csv);
				return FILE_HEADER + csv;
			}
		},
		{
			text: 'Delete',
			action: function(e, dt, node, config) {
				var indices = TABLE.rows('.selected').indexes();
				TABLE.rows('.selected').remove().draw(false);

				for (var i = 0; i < indices.length; i ++) {
					ORIGINAL_DATASET.splice(indices[i], 1);
				}
				exit_select_mode();
				update_views();
			}
		},
		{
			text: 'Deselect',
			action: function(e, dt, node, config) {
				exit_select_mode();
			}
		}
	]
};
var CURRENT_HIDDEN_COLUMNS = DEFAULT_HIDDEN_COLUMNS;





/****************** CHART VIEW ****************/
var CURRENT_CHART_ATTRIBUTE = DEFAULT_CHART_ATTRIBUTE;
var CURRENT_PARAC_ATTRIBUTES;
var $CHART = $("#chart-svg-container");
var $PARAC = $("#parac-svg-container");
var CURRENT_VIS_TYPE = DEFAULT_VIS_TYPE;
var CHART_SVG,
	PARAC_SVG,
	CHART_MARGIN,
	PARAC_MARGIN,
	TIP;

/****************** IMAGE VIEW ****************/
var SKIP_IMAGE_EXTENSIONS = [];
var CHECK_IMAGE_EXTENSIONS = DEFAULT_IMAGE_EXTENSIONS.map(function () {return false;});
var CURRENT_IMAGE_TYPE = 0,
	CURRENT_COMPARE_TYPE = -1;
var DETAIL_MODE_FLAG = false;



/****************** UMAP VIEW ****************/
var $UMAP= $("#umap-svg-container");
var UMAP_SVG,
	UMAP_MARGIN;


/****************** TABLE_CHRAT ****************/
var TABLE_CHART;
var DATA_TABLE_CONFIG_CHART;
