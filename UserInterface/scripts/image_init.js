
function initialize_image_view (case_list) {

	show_view("image");
	// update_image_view_height();

	var $div = $("#overview-gallery");
	$div.empty();

	CURRENT_CASE_LIST = ORIGINAL_CASE_LIST;

	// for (var i = 0; i < case_list.length; i++) {
	// 	$div.append(generate_img_block("overview-image-block", case_list[i], CURRENT_IMAGE_TYPE, CURRENT_COMPARE_TYPE, case_list[i]));
	// }
 
	$div.children("div").children("img").click(function(){
		src_list = this.src.split('/');
		enter_select_mode(src_list[src_list.length-2]);
	});

	// console.log($div)

	// init_image_selector();
}

// function update_image_view (case_list) {
// 	// TODO: rewrite update function.

// 	// update_image_view_height();

// 	var $div = $("#overview-gallery");
// 	// console.log($div)
// 	$div.empty();

// 	// for (var i = 0; i < ORIGINAL_CASE_LIST.length; i++) {
// 	// 	$div.append(generate_img_block("overview-image-block", ORIGINAL_CASE_LIST[i], CURRENT_IMAGE_TYPE, CURRENT_COMPARE_TYPE, ORIGINAL_CASE_LIST[i]));
// 	// }
 
// 	$div.children("div").children("img").click(function(){
// 		src_list = this.src.split('/');
// 		enter_select_mode(src_list[src_list.length-2]);
// 	});

// 	// console.log($div)


// 	// update_multi_selected_image_view(case_list);
// }


function update_image_view_height () {
	$("#image-view").outerHeight(
			$(window).height() - 
			$("header").outerHeight(includeMargin=true) - 
			$("#table-view").outerHeight(includeMargin=true) - 
			$("#table_meas-view").outerHeight(includeMargin=true) - 
			$("#chart-view").outerHeight(includeMargin=true) 
		);
}


function enter_select_image_view (dir) {
	$("#overview-gallery").css("display", "none");
	$("#img-select-button").css("display", "none");
	$("#exit-image-select-view-btn").css("display", "block");

	$("#select-candidate-container > *").remove();
	$("#select-image-container > *").remove();
	$("#select-image-view").css("display", "flex");

	var $div = $("#select-image-container");
	// image_name = image_names[0][1];
	// console.log(image_names);

	var re = /\s*(?:',\s'|$)\s*|\['|'\]/;
	// var image_names_new = image_names[0].split(re);
	// delete image_names_new[0]
	// console.log(image_names_new);


	
	for (var j = 0; j < ORIGINAL_DATASET.length; j ++) {
		if (participant_names[j] == dir){
			var image_names_new = image_names[j].split(re);
			var collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});
			var myArray = image_names_new;
			const image_names_new2 = myArray.reverse(myArray.sort(collator.compare));
			// console.log(image_names_new2);
			for (var i = 0; i < ORIGINAL_DATASET[j]["NUM"]; i++) {
				// console.log(i, ORIGINAL_DATASET[j]["Participant"])
				$div.append("<img id='exibit-img' src='" + generate_img_src(dir, CURRENT_IMAGE_TYPE,image_names_new2[i])+ "'/>");
			}
		}
	}

	

	$div = $("#select-candidate-container");


	$("#select-candidate-container > div > img").dblclick(function(){
		enter_detail_image_view($(this).attr("file_name"), $(this).attr("img_type"), this.src);
	});

	$("#select-candidate-container > div > img").click(function(){
		$("#exibit-img").attr("src", this.src)
						.attr("img_type", $(this).attr("img_type"));
	});

	$("#exibit-img").click(function(){
		enter_detail_image_view($(this).attr("file_name"), $(this).attr("img_type"), this.src);
	});
}


function exit_select_image_view () {
	$("#select-candidate-container > *").remove();
	$("#select-image-container > *").remove();
	$("#select-image-view").css("display", "none");
	$("#exit-image-select-view-btn").css("display", "none");

	$("#overview-gallery").css("display", "flex");
	$("#img-select-button").css("display", "block");
}


function update_multi_selected_image_view (file_names) {
	ORIGINAL_CASE_LIST.forEach(function (d) {
		if (file_names.indexOf(d) == -1) {
			$("#" + ORIGINAL_CASE_DICT[d]["dom_id"]).css("display", "none");
		} else {
			$("#" + ORIGINAL_CASE_DICT[d]["dom_id"]).css("display", "flex");
		}
	});
}


function calculate_height ($div) {
	var num_thumbs = DEFAULT_IMAGE_EXTENSIONS.length;
	var max_width = Math.floor($div.width() / Math.ceil(num_thumbs / 2)) - 5;
	var cor_height = Math.floor(max_width / $("#exibit-img").width() * $("#exibit-img").height());
	var max_height = Math.floor($div.height() / 2) - 20;

	return Math.min(max_height, cor_height);
}


function generate_img_src (file_name, img_type_index, image_name) {
	var image_extension = DEFAULT_IMAGE_EXTENSIONS[img_type_index];
	// if (use_small && SMALL_IMAGE_EXTENSIONS.indexOf(image_extension) >= 0) {
	// 	image_extension = image_extension.split(".")[0] + "_small.png";
	// }
	// return DATA_PATH + file_name + "/" + file_name + image_extension
	// image_name = '000001';
	// return [DATA_PATH + file_name + "/" +  image_name  + image_extension];
	return [DATA_PATH + file_name + "/" +  image_name ];

}

function enter_detail_image_view (file_name, img_type, src) {
	$("#detail-image-name > span").text(file_name);
	$("#overlay-image > figure").css("width", "auto")
		.css("background-image", "url(" + src + ")");
	$("#overlay-image > figure > img").attr("src", src);
	$("#overlay-container").css("pointer-events", "all")
		.css("opacity", 1);
	var figure_height = $("#overlay-image > figure").height(),
		figure_width = $("#overlay-image > figure").width(),
		img_height = $("#overlay-image > figure > img").height(),
		img_width = $("#overlay-image > figure > img").width();
	if (figure_height < img_height) {
		$("#overlay-image > figure").width(img_width * (figure_height / img_height));
	}
}


