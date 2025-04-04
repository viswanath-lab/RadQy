function initialize_data_table (dataset) {

	show_view("table");
	var $table = $("#result-table");
	var $table_chart = $("#result-table_chart");

	generate_table(dataset, $table);
	generate_config(dataset);                  // for Cols

	TABLE = $table.DataTable(DATA_TABLE_CONFIG);

	TABLE_CHART = $table_chart.DataTable(DATA_TABLE_CONFIG_CHART);

	init_visibility();
	// init_editability();
	init_button_style();




	CURRENT_SORT_ATTRIBUTE = ORIGINAL_FEATURE_LIST[TABLE.order()[0][0]];

	$table.find("tbody").on("click", 'td', function () {

		if ($(TABLE.column($(this).index() + ":visIdx").header()).text().trim() != "comments") {
			var case_name = $(this).parent().find("td:first-child").text();
			enter_select_mode(case_name, true);
		} else {
			$("tr.selected").removeClass("selected");
		}

	});

	$(".dataTables_scrollHeadInner > table > thead > tr > th").on("click", function () {
		data_sorting($(this).text(), (TABLE.order()[0][1] == 'desc'));
		update_views();
	});
}


function generate_table(dataset, table) {
    var thead_content = "<tr>";
    ORIGINAL_FEATURE_LIST.forEach(function(d, i) {
        thead_content += ("<th>" + d + "</th>");
    });
    thead_content += "</tr>";

    var tbody_content = "";
    for (var i = 0; i < dataset.length; i++) {
        tbody_content += "<tr>";
        for (var j = 0; j < ORIGINAL_FEATURE_LIST.length; j++) {
            var cellContent = dataset[i][ORIGINAL_FEATURE_LIST[j]];
            if (typeof cellContent === 'number') {
                if (Math.abs(cellContent) >= 1e5) { // Adjust the threshold as needed
                    cellContent = cellContent.toExponential(2);
                } else {
                    cellContent = cellContent.toFixed(2);
                }
            } else if (cellContent === undefined || cellContent === null || cellContent === '') {
                cellContent = 'N/A';
            }
            tbody_content += ("<td>" + cellContent + "</td>");
        }
        tbody_content += "</tr>";
    }
    table.children("thead").empty().html(thead_content);
    table.children("tbody").empty().html(tbody_content);
}



function generate_config (dataset) {

	// 1. named column
	// 2. customized colvis

	var colvis_action = function (e, dt, node, config) {
		var column_name = node[0].text;
		if (this.active()) {
			// update the table column
			this.active(false);
			TABLE.column(column_name + ":name").visible(false);
			
			CURRENT_HIDDEN_COLUMNS.push(column_name);
			
			// update parallel coordinate -> delete from CURRENT_PARAC_ATTRIBUTES
			CURRENT_PARAC_ATTRIBUTES = generate_current_parac_attributes();
			update_chart_view("parallel_coordinate", CURRENT_MULTI_SELECTED);

		} else {
			// update the table column
			this.active(true);
			TABLE.column(column_name + ":name").visible(true);
			
			var index = CURRENT_HIDDEN_COLUMNS.indexOf(column_name);
			if (index > -1) {
				CURRENT_HIDDEN_COLUMNS.splice(index, 1);
			} else {
				console.log("[DEBUG] " + column_name + " is not in CURRENT_HIDDEN_COLUMNS.")
			}

			// update parallel coordinate
			CURRENT_PARAC_ATTRIBUTES = generate_current_parac_attributes();
			update_chart_view("parallel_coordinate", CURRENT_MULTI_SELECTED);

		}
	};

	DATA_TABLE_CONFIG["columns"] = [];
	var colvis_buttons_config = []; // customized colvis buttons list (every header) 

	ORIGINAL_FEATURE_LIST.forEach(function (header) {
		DATA_TABLE_CONFIG["columns"].push({
			name: header
		});
		colvis_buttons_config.push({
			text: header,
			// display: none,
			className: DEFAULT_HIDDEN_COLUMNS.indexOf(header) == -1 ? 'active' : null,
			action: colvis_action
		});

	});

	var colvis_config = {
		extend: 'collection',
		text: 'Metrics',
		buttons: colvis_buttons_config,
		fade: 500
	};

	DATA_TABLE_CONFIG["buttons"].push(colvis_config);
}


function init_visibility () {
	DEFAULT_HIDDEN_COLUMNS.forEach(function (hidden_header) {
		TABLE.column(hidden_header + ":name").visible(false);
	});
}

function init_button_style() {
  // Select the button container and change its class to vertical button group
  $(".table-control > div.dt-buttons").removeClass("btn-group").addClass("btn-group-vertical");
  
  // Select the buttons, change their class, and add some additional styling
  $(".table-control > div.dt-buttons > button").removeClass("btn-secondary").addClass("btn-outline-secondary").css({
    "margin-bottom": "5px",
    "color": "red"
  });
}


// function init_button_style () {
// 	$(".table-control > div.dt-buttons").removeClass("btn-group").addClass("btn-group-vertical");
// 	$(".table-control > div.dt-buttons > button").removeClass("btn-secondary").addClass("btn-outline-secondary");
// }





function select_row_in_table (case_name, from_table) {
	if (from_table) return;

	var offset = 0;

	TABLE.$("tr.selected").removeClass("selected");
	var target_index = TABLE.row(function(idx, data, node) {
		if (data[0] == case_name) {
			return true;
		} else {
			return false;
		}
	}).select().index();

	TABLE.row(target_index + offset).scrollTo();
}


function update_multi_selected_table_view (case_names) {
	TABLE.clear();
	TABLE.rows.add(CURRENT_MULTI_SELECTED.map(function(d) {return Object.values(d);})).draw();
}


function data_sorting (keyword, desc=false) {
	var compare = function (a, b) {
		if (a[keyword] < b[keyword]) {
			if (desc) {
				return 1;
			} else {
				return -1;
			}
		} else if (a[keyword] > b[keyword]) {
			if (desc) {
				return -1;
			} else {
				return 1;
			}
		} else {
			return 0;
		}
	}

	CURRENT_SORT_ATTRIBUTE = keyword;
	ORIGINAL_DATASET.sort(compare);
	// ORIGINAL_CASE_LIST = ORIGINAL_DATASET.map(function (d) {return d["Participant"];});
	CURRENT_MULTI_SELECTED.sort(compare);
	CURRENT_CASE_LIST = CURRENT_MULTI_SELECTED.map(function (d) {return d["Participant"];});
}