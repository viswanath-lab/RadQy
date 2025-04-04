function data_loading() {
	var $this = $(this);
    var cur_file = null;

    if ($this.val() == "") {
        return;
    } else {
        cur_file = $this.get(0).files[0];
    }

    $("#upload-button").css("display", "none");

    // read dataset from the file
    FILE_NAME = cur_file.name.split(".")[0];
    console.log("[LOG] Read in file: " + FILE_NAME);
    var fileReader = new FileReader();
    fileReader.readAsText(cur_file);
    fileReader.onload = function () {
        console.log("[LOG] App initializing...");
        var file_text = fileReader.result;

        var absdirRe = /#outdir:?\s*([^\s]*)\s*\n/;
        var abs_outdir = absdirRe.exec(file_text)[1];
        var reldirRe = /([^\\\/]*)$/;
        var rel_outdir = reldirRe.exec(abs_outdir)[1];
        DATA_PATH = DATA_PATH + rel_outdir + "/";

		var scantypeRe = /#scantype:?\s*([^\s]*)\s*\n/;
		var scantypeMatch = scantypeRe.exec(file_text);
		if (scantypeMatch && scantypeMatch[1]) {
		    var scantype = scantypeMatch[1];
		    console.log("[LOG] Scantype: " + scantype);
		    $('#scantype-display').text('(' + scantype + ' Data)');
		} else {
		    console.error("[ERROR] Scantype not found in the file");
		    $('#scantype-display').text('(Scantype not found)');
		}

        
        var fileParts = file_text.split(/#dataset:\s*/);
        FILE_HEADER = fileParts[0] + "#dataset:\n";
        dataset_text = fileParts[1];

        ORIGINAL_DATASET = d3.tsv.parse(dataset_text, function (d) {
		    if (d.hasOwnProperty("")) delete d[""];
		    for (var key in d) {
		        if (d[key].toLowerCase() === 'nan' || d[key] === "") {
		            d[key] = 'N/A';
		            columnInfo[key] = columnInfo[key] || { hasNA: true, isNumerical: true };
		        } else if ($.isNumeric(d[key])) {
		            d[key] = +d[key];
		            columnInfo[key] = columnInfo[key] || { isNumerical: true, hasNA: false };
		        } else {
		            columnInfo[key] = columnInfo[key] || { isNumerical: false, hasNA: false };
		            columnInfo[key].isNumerical = false;
		        }
		    }
		    return d;
		});

		var sortedKeys = Object.keys(columnInfo).sort(function (a, b) {
		    if (a === "Participant") return -1;
		    if (b === "Participant") return 1;
		    if (columnInfo[a].isNumerical && !columnInfo[b].isNumerical) return 1;
		    if (!columnInfo[a].isNumerical && columnInfo[b].isNumerical) return -1;
		    return 0;
		});

		ORIGINAL_DATASET = ORIGINAL_DATASET.map(function (row) {
		    var newRow = {};
		    sortedKeys.forEach(function (key) {
		        newRow[key] = row[key];
		    });
		    return newRow;
		}).map(function (row, j) {
		    image_names[j] = row["Name of Images"];
		    participant_names[j] = row["Participant"];
		    delete row["Name of Images"];
		    return row;
		});

		$("#dataset-tag").css("display", "inline")
						 .text("Dataset: " + rel_outdir + ",  N= " + ORIGINAL_DATASET.length + " ");

		// $("#dataset-tag").css("display", "inline")
		// 				 .text("Data: " + cur_file.name + " | N= " + ORIGINAL_DATASET.length + ", " + rel_outdir);

		ORIGINAL_CASE_LIST = ORIGINAL_DATASET.map(function(d){return d["Participant"];});
		

		for (var i = 0; i < ORIGINAL_DATASET.length; i ++) {
			var cur_file_name = ORIGINAL_DATASET[i]["Participant"];
			ORIGINAL_CASE_DICT[cur_file_name] = {};
			for (var index in FEATURES_TO_MAP) {
				ORIGINAL_CASE_DICT[cur_file_name][FEATURES_TO_MAP[index]] = ORIGINAL_DATASET[i][FEATURES_TO_MAP[index]];
			}
			ORIGINAL_CASE_DICT[cur_file_name]["dom_id"] = cur_file_name.replace(/\.|\#/g, "-");
		}
		

	


		var img = new Image();
		img.typeidx = 0;
		img.onerror = (function () {
			CHECK_IMAGE_EXTENSIONS[this.typeidx] = true;
		});
		img.src = "";




		ORIGINAL_FEATURE_LIST = Object.keys(ORIGINAL_DATASET[0]);





		CURRENT_MULTI_SELECTED = ORIGINAL_DATASET;

		var image_check_interval = setInterval (function () {
			var check_sum = 0;
			for (var ck_index = 0; ck_index < CHECK_IMAGE_EXTENSIONS.length; ck_index ++) {
				check_sum += CHECK_IMAGE_EXTENSIONS[ck_index];
			}
			if (check_sum == CHECK_IMAGE_EXTENSIONS.length) {
				clearInterval (image_check_interval);


				initialize_data_table(ORIGINAL_DATASET);
				if (!OPEN_WITH_TABLE) {
					hide_view("table");
				}
				d3.select("#table-btn")
					.classed("view-mngmt-btn-hidden", false)
					.classed("view-enabled", OPEN_WITH_TABLE)
					.classed("view-disabled", !OPEN_WITH_TABLE);



				initialize_chart_view(ORIGINAL_DATASET, CURRENT_VIS_TYPE);
				if (!OPEN_WITH_CHART) {
					hide_view("chart");
				}
				d3.select("#chart-btn")
					.classed("view-mngmt-btn-hidden", false)
					.classed("view-enabled", OPEN_WITH_CHART)
					.classed("view-disabled", !OPEN_WITH_CHART);


				initialize_image_view(ORIGINAL_CASE_LIST);
				if (!OPEN_WITH_IMAGE) {
					hide_view("image");
				}
				d3.select("#image-btn")
					.classed("view-mngmt-btn-hidden", false)
					.classed("view-enabled", OPEN_WITH_IMAGE)
					.classed("view-disabled", !OPEN_WITH_IMAGE);


				initializeUmapView(ORIGINAL_DATASET);
				if (!OPEN_WITH_UMAP) {
					hide_view("umap");
				}
				d3.select("#umap-btn")
					.classed("view-mngmt-btn-hidden", false)
					.classed("view-enabled", OPEN_WITH_UMAP)
					.classed("view-disabled", !OPEN_WITH_UMAP);


				$("#view-mngmt-btn-group").css("display", "block");
				d3.select("#page-title")
					.classed("mr-md-auto", false)
					.classed("mr-md-3", true);


				console.log("[LOG] App initialized.");
				APP_INITIALIZED = true;
			} else {
				console.log("waiting for image type checking ...");
			}
		}, 500);
	}
}

