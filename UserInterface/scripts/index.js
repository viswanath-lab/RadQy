
$(document).ready(function () {
	console.log("[LOG] Document ready.")

	$("#upload-input").change(data_loading); // app entrance. func `data_loading` at data_load.js.
	$("#reset-button").click(function(){window.location.reload(); console.log("App reset.")}); // app exit. back to the uploading page, reset to the init structure.
	$(".view-mngmt-btn").click(function(){
		if ($(this).hasClass("view-enabled")) {
			hide_view($(this).attr("value"));
		} else {
			show_view($(this).attr("value"));
		}
	})
});


function reset_views_size () {
	if (!APP_INITIALIZED) {
		return;
	}

	// reset background color
	index = -1;
	for (var i = 0; i < ORIGINAL_VIEWS.length; i++) {
		var view_name = ORIGINAL_VIEWS[i];
		if (CURRENT_DISPLAY_VIEWS.indexOf(view_name) >= 0) {
			index++;
			if (index % 2 == 0) {
				$("#" + view_name + "-view").addClass("bg-light");
			} else {
				$("#" + view_name + "-view").removeClass("bg-light");
			}
		}
	}

	// update_chart_view("both", CURRENT_MULTI_SELECTED);
	// update_image_view_height();
}


function show_view (view_name) {
	$("#" + view_name + "-view").css("display", "block");
	$("#" + view_name + "-btn")
		.addClass("view-enabled")
		.removeClass("view-disabled");
	var index = CURRENT_DISPLAY_VIEWS.indexOf(view_name);
	if (index < 0) {
		CURRENT_DISPLAY_VIEWS.push(view_name);
	}
	reset_views_size();
}


function hide_view (view_name) {
	$("#" + view_name + "-view").css("display", "none");
	$("#" + view_name + "-btn")
		.addClass("view-disabled")
		.removeClass("view-enabled");
	var index = CURRENT_DISPLAY_VIEWS.indexOf(view_name);
	if (index > -1) {
		CURRENT_DISPLAY_VIEWS.splice(index, 1);
	}
	reset_views_size();
}