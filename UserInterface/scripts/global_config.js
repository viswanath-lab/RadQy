/**********************************************
 ********* PRE-DEFINED CONFIGURATIONS *********
 **********************************************/

/***************** SYSTEM CONFIG **************/
var DATA_PATH = "./Data/";
var OPEN_WITH_TABLE = true,
    OPEN_WITH_TABLE_meas = true,
	OPEN_WITH_CHART = true,
	OPEN_WITH_IMAGE = true;
    OPEN_WITH_TSNE = true;
    OPEN_WITH_UMAP = true;

/****************** TABLE VIEW ****************/
var DEFAULT_HIDDEN_COLUMNS = [
	"outdir",
	"comment",
	"type"
];

/****************** CHART VIEW ****************/
// Initialize the bar chart on this attribute.
var DEFAULT_CHART_ATTRIBUTE = "NUM";

// Initialize the parallel coordinate on these attributes.
// Temporarily DEPRECATED. 
// var DEFAULT_PARAC_ATTRIBUTES = [];

// "bar_chart" | "parallel_coordinate"
var DEFAULT_VIS_TYPE = "parallel_coordinate";

/****************** IMAGE VIEW ****************/
// full set of possible image format identifiers. 
var DEFAULT_IMAGE_EXTENSIONS = [
    "_thumb.png"
];

