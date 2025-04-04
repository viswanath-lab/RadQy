
var columnClicked = false;
var selectedCaseName = null;

function initializeUmapView(dataset = ORIGINAL_DATASET, colorColumn = 'MFR') {
  var style = document.createElement('style');
    style.innerHTML = `
      .horizontal-line {
        width: 100%;
        height: 1px;
        background-color: black;
        position: relative;
        top: -10px;
      }
      .umap-text {
        font-weight: bold;
        text-align: center;
        font-size: 16px;
        position: relative;
        top: -15px;
      }
    `;
  document.head.appendChild(style);
  var umapControlContainer = d3.select("#umap-control-container").append("div");
  umapControlContainer.append("div")
      .attr("class", "umap-text")
      .text("UMAP Hyperparameters");
  umapControlContainer.append("div").attr("class", "horizontal-line");




  var umapSvgContainer = d3.select("umap-svg-container").append("div")
  var umapContainer = d3.select("#umap-selection-container").append("div")


  var labelAndButtonContainer = umapContainer.append("div")
    .style("display", "flex")
    .style("margin-left", "-20px")
    .style("position", "relative");

  labelAndButtonContainer.append("div")
      .attr("class", "umap-text")
      .style("top", "2px") 
      .text("Categorical IQMs");



  var inputContainer = umapContainer.append("div")
    .style("display", "flex")
    .style("margin-top", "10px") 
    .style("margin-left", "-20px")
    .style("position", "relative");
  inputContainer.append("div")
      .attr("class", "umap-text")
      .style("top", "2px") 
      .text("Custom Selection");

  var inputBox = inputContainer.append("input")
      .attr("type", "text")
      .attr("id", "customInputBox")
      .style("width", "300px")
      .style("height", "30px")  
      .style("margin-left", "10px")  
      .style("font-size", "13px");



  var filteredData = dataset;

  var applyButton = inputContainer.append("button")
      .text("Apply")
      .style("margin-left", "10px")  
      .style("height", "25px")  
      .style("margin-top", "2px")
      .style("font-size", "14px");

  applyButton.on("click", function() {
    var inputValue = d3.select("#customInputBox").property("value");
    console.log("Input:", inputValue);

    if (!inputValue) {
      console.error("Error: No input provided");
      alert("Error: Please enter a value in the input field.");
      return;
    }

    var parts = inputValue.split(/\b(and|or)\b/);
    var expressions = [];
    for (var i = 0; i < parts.length; i += 2) {
      var value = parts[i].trim();
      var operator = parts[i + 1];

      expressions.push({
        value: value,
        operator: operator ? operator.trim() : null
      });
    }

    filteredData = dataset;

    for (var i = 0; i < expressions.length; i++) {
      var expression = expressions[i];

      var [field, condition, val] = expression.value.split(/(>=|<=|>|<|=)/);
      field = field.trim();
      condition = condition.trim();
      val = val.trim();

      val = isNaN(val) ? val.replace(/['"]+/g, '') : +val;

      if (expression.operator === 'and' || !expression.operator) {
        filteredData = filteredData.filter(row => {
          switch (condition) {
            case '=': return row[field] === val;
            case '>': return row[field] > val;
            case '<': return row[field] < val;
            // More conditions can be added here...
            default: return true;
          }
        });
      } else if (expression.operator === 'or') {
        console.warn("Handling 'or' logic is more complex and not implemented in this snippet");
      }

      // Check if filteredData is an empty array before using reduce
      if (filteredData.length > 0) {
        var max = filteredData.reduce((a, b) => a[field] > b[field] ? a : b)[field];
        var min = filteredData.reduce((a, b) => a[field] < b[field] ? a : b)[field];
      }

      if (filteredData.length < 2) {
        console.error("Error: At least 2 data points are required for UMAP embeddings");
        alert("Error: Please select at least 2 data points.");
      return;
    }
  }


    console.log("Filtered data:", filteredData);
    updateUmap(
      filteredData,
      nComponentsInput.property("value"),
      nNeighborsInput.property("value"),
      distanceFnSelect.property("value"),
      minDistInput.property("value"),
      spreadInput.property("value")
    );
    setlegendHTML('')
  });


  var resetUMAPButton = inputContainer.append("button")
      .text("Reset UMAP")
      .style("margin-left", "10px")  
      .style("height", "25px")  
      .style("margin-top", "2px")
      .style("font-size", "14px");

  resetUMAPButton.on("click", function() {
    d3.select("#customInputBox").property("value", "");
    resetUmapView();
    setlegendHTML('')
  });




  var saveIQMsContainer = inputContainer.append("div")
    .style("display", "flex")
    .style("height", "25px")  
    .style("margin-bottom", "10px")
    .style("margin-left", "300px") 
    .style("position", "relative");

  var saveIQMsButton = saveIQMsContainer.append("button")
      .text("Save IQMs")
      .style("margin-left", "10px")  
      .style("height", "25px")  
      .style("margin-top", "2px")
      .style("font-size", "14px");

  saveIQMsButton.on("click", function() {
    var csvContent;
    try {
      csvContent = "data:text/csv;charset=utf-8," + d3.csvFormat(filteredData);
    } catch (e) {
      console.error("Error while saving IQMs:", e);
      alert("Error while saving IQMs. Please check console for details.");
      return;
    }
    var encodedUri = encodeURI(csvContent);
    var link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "filtered_data.csv");
    document.body.appendChild(link); // Required for FF
    link.click(); // This will download the data file named "filtered_data.csv".
  });



  const nonNumericalColumns = Object.entries(columnInfo).filter(([key, value]) => value === 'non-numerical').map(([key]) => key);

  nonNumericalColumns.forEach(column => {
    if (column === 'Participant' || column === 'Name of Images') {
      return;
    }

    let columnClicked = false;
    const columnBtn = labelAndButtonContainer.append("button")
      .text(column)
      .attr("id", `${column}-btn`)
      .style("margin-left", "15px")
      .on('click', function () {
        columnClicked = !columnClicked;
        if (columnClicked) {
          updateLegend(dataset, column);
        } else {
          resetUmapView();
          setlegendHTML('')
        }
      });
  });





  var nComponentsContainer = umapControlContainer.append("div")
    .style("display", "flex") 
    // .style("align-items", "left")
    .style("width", "220px");
  var nComponentsLabel = nComponentsContainer.append("label")
    .attr("for", "nComponentsInput")
    .text("nComponents")
    .style("font-size", "15px");
  var nComponentsInput = nComponentsContainer.append("input")
    .attr("type", "number")
    .attr("id", "nComponentsInput")
    .attr("value", "2")
    .style("width", "70px")
    .style("margin-left", "13px")
    .style("font-size", "14px");
  var nNeighborsContainer = umapControlContainer.append("div")
    .style("display", "flex")
    .style("align-items", "center")
    .style("width", "100px");
  var nNeighborsLabel = nNeighborsContainer.append("label")
    .attr("for", "nNeighborsInput")
    .text("nNeighbors")
    .style("font-size", "15px");
  var nNeighborsInput = nNeighborsContainer.append("input")
    .attr("type", "number")
    .attr("id", "nNeighborsInput")
    .attr("value", "15")
    .style("width", "70px")
    .style("margin-left", "28px")
    .style("font-size", "14px");
  var distanceFnContainer = umapControlContainer.append("div")
    .style("display", "flex")
    .style("align-items", "center")
    .style("width", "200px");
  var distanceFnLabel = distanceFnContainer.append("label")
    .attr("for", "distanceFnSelect")
    .text("distanceFn")
    .style("font-size", "15px");
  var distanceFnSelect = distanceFnContainer.append("select")
    .attr("id", "distanceFnSelect")
    .style("width", "150px")
    .style("margin-left", "32px")
    .style("font-size", "14px");
  const distanceFunctions = [
    "euclidean", "manhattan", "chebyshev", "minkowski", "canberra",
    "brayCurtis", "cosine", "correlation", "hamming", "jaccard", "dice",
    "kulsinski", "rogersTanimoto", "russellRao", "sokalSneath", "sokalMichener", "yule"
  ];
  distanceFunctions.forEach(function (distanceFn) {
    distanceFnSelect.append("option")
      .attr("value", distanceFn)
      .text(distanceFn.charAt(0).toUpperCase() + distanceFn.slice(1))
      .style("font-size", "14px");
  });
  var minDistContainer = umapControlContainer.append("div")
    .style("display", "flex")
    .style("align-items", "center")
    .style("width", "100px");
  var minDistLabel = minDistContainer.append("label")
    .attr("for", "minDistInput")
    .text("minDist")
    .style("font-size", "15px");
  var minDistInput = minDistContainer.append("input")
    .attr("type", "number")
    .attr("id", "minDistInput")
    .attr("value", "0.1")
    .style("width", "70px")
    .style("margin-left", "52px")
    .style("font-size", "14px");
  var spreadContainer = umapControlContainer.append("div")
    .style("display", "flex")
    .style("align-items", "center")
    .style("width", "100px");
  var spreadLabel = spreadContainer.append("label")
    .attr("for", "spreadInput")
    .text("Spread")
    .style("font-size", "15px");
  var spreadInput = spreadContainer.append("input")
    .attr("type", "number")
    .attr("id", "spreadInput")
    .attr("value", "1")
    .style("width", "70px")
    .style("margin-left", "57px")
    .style("font-size", "14px");


  const umap = initUmap(dataset, nComponentsInput.property("value"), nNeighborsInput.property("value"));
  // console.log(umap)
  colors = Array(ORIGINAL_DATASET.length).fill('#00304e');
  const containerWidth = umapSvgContainer.clientWidth;
  const data = {
    x: umap.uAxis,
    y: umap.vAxis,
    mode: 'markers',
    type: 'scatter',
    hoverinfo: 'text',
    text: umap.participantNumbers,
    marker: { size: 10, color: colors }
  };
  const layout = {
    height: containerWidth,
    xaxis: {
      autorange: true,
      showgrid: false,
      zeroline: false,
      showline: false,
      autotick: false,
      showticklabels: false,
    },
    yaxis: {
      autorange: true,
      showgrid: false,
      zeroline: false,
      showline: false,
      autotick: false,
      showticklabels: false,
    },
    title: { text: '<b>UMAP Plot</b>', font: { family: 'Titillium Web', size: 18, color: 'black' } },
  };
  const config = { displayModeBar: true, scrollZoom: true, responsive: true };
  Plotly.newPlot('umap-svg-container', [data], layout, config);
  

  nComponentsInput.on("input", function() {
    var selectedValue = d3.select(this).property("value");
    updateUmap(dataset, selectedValue, nNeighborsInput.property("value"));
  });
 
  nNeighborsInput.on("input", function() {
    var selectedValue = d3.select(this).property("value");
    updateUmap(dataset, nComponentsInput.property("value"), selectedValue);
  });



  distanceFnSelect.on("change", function () {
    var selectedValue = d3.select(this).property("value");
    updateUmap(
      dataset,
      nComponentsInput.property("value"),
      nNeighborsInput.property("value"),
      selectedValue
    );
  });

  minDistInput.on("input", function() {
    var selectedValue = d3.select(this).property("value");
    updateUmap(
      dataset,
      nComponentsInput.property("value"),
      nNeighborsInput.property("value"),
      distanceFnSelect.property("value"),
      selectedValue
    );
  });


  spreadInput.on("input", function() {
    var selectedValue = d3.select(this).property("value");
    updateUmap(
      dataset,
      nComponentsInput.property("value"),
      nNeighborsInput.property("value"),
      distanceFnSelect.property("value"),
      minDistInput.property("value"),
      selectedValue
    );
  });

  return { fourth: { marker: { color: colors, size: 10 } } };
}



function initUmap(dataset, nComponents = 2, nNeighbors = 15, distanceFn = 'euclidean', minDist = 0.1, spread = 1, seed) {
  Math.seedrandom(seed);
  const distanceFunction = UMAP[distanceFn] || UMAP.euclidean;
  const umap = new UMAP({
    nComponents: nComponents,
    distanceFn: distanceFunction,
    nNeighbors: 6,
    // nNeighbors: Math.min(dataset.length - 1, nNeighbors),
    minDist: minDist,
    spread: spread
  });
  const numericalDataset = dataset.map(obj => {
    const newObj = {};
    for (const prop in obj) {
      newObj[prop] = !isNaN(parseFloat(obj[prop])) ? parseFloat(obj[prop]) : obj[prop];
    }
    return newObj;
  });
  // const umapValues = numericalDataset.map(d => Object.values(d));
  // const umapVariables = Object.keys(numericalDataset[0]).filter(prop => typeof numericalDataset[0][prop] === 'number');


  // Filter out non-numeric properties from the dataset
  const numericProperties = Object.keys(numericalDataset[0]).filter(prop => {
    // Check if the first data point's property value is a number
    return typeof numericalDataset[0][prop] === 'number';
  });

  // Extract only the numeric values from the dataset
  const umapValues = numericalDataset.map(d => {
    const numericData = {};
    numericProperties.forEach(prop => {
      numericData[prop] = d[prop];
    });
    return Object.values(numericData);
  });

  // Now umapValues contains only numeric values
  // console.log('umapValues:', umapValues);
  
  // console.log('hi') console.log(umapValues)
  const embedding = umap.fit(umapValues)
  // console.log('hio')
  const uAxis = embedding.map(d => d[0]);
  const vAxis = embedding.map(d => d[1]);
  const participantNumbers = dataset.map(d => d['Participant']);
  return { uAxis, vAxis, participantNumbers, nNeighbors};
}



function updateLegend(dataset, colorColumn) {
  const colorValues = dataset.map(obj => obj[colorColumn]);
  const uniqueColors = [...new Set(colorValues)];
  const colorMap = {};
  uniqueColors.forEach((color, index) => {
    colorMap[color] = index;
  });


  const legendItems = uniqueColors.map(color => {
  const index = colorMap[color];
  const markerStyle = `background-color: hsl(${(index * 360 / uniqueColors.length)}, 100%, 50%);`;
  return `<div style="display: flex; align-items: center; margin: 2px;">
            <div style="${markerStyle} width: 12px; height: 12px; border-radius: 50%;"></div>
            <button style="margin-left: 6px;" onclick="updatePlotByColor('${colorColumn}', '${color}')">${color}</button>
          </div>`;
  });

  const legendHtml = `<div style="display: flex; flex-direction: column;">
                      <div style="font-weight: bold; text-align: center; font-size: 18px;">${colorColumn}</div>
                      <hr style="width: 90%; height: 2px; margin: 0 auto 5px auto; border: 0; background-color: black;">
                      <div style="display: flex; flex-direction: column; justify-content: center;">
                        ${legendItems.join('')}
                      </div>
                    </div>`;              

  const legendContainer = document.getElementById('umap-legend-container');
  setlegendHTML(legendHtml)
  const colors = colorValues.map(color => `hsl(${(colorMap[color] * 360 / uniqueColors.length)}, 100%, 50%)`);
  const update = { marker: { color: colors, size: 10 } };

  const layout = {
        title: { text: `<b>UMAP Plot for the ${colorColumn} IQM</b>`, font: { family: 'Titillium Web', size: 18, color: 'black' } },
  };


  Plotly.restyle('umap-svg-container', update);
  Plotly.relayout('umap-svg-container', layout);
}


function resetUmapView() {
    const updatedDataset = ORIGINAL_DATASET;
    const umap = initUmap(updatedDataset);
    // const umap = initUmap(updatedDataset, nComponents = 2, nNeighbors = 15, distanceFn = 'euclidean', minDist = 0.1, spread = 1);
    const colors = Array(updatedDataset.length).fill('#00304e');

    const data = {
      x: umap.uAxis,
      y: umap.vAxis,
      mode: 'markers',
      type: 'scatter',
      hoverinfo: 'text',
      text: umap.participantNumbers,
      marker: { size: 10, color: colors }
    };

    const update = {
      x: [data.x],
      y: [data.y],
      'marker.color': [data.marker.color],
      'marker.size': [data.marker.size]
    };

    Plotly.restyle('umap-svg-container', update);

    const layout = {
        title: { text: `<b>UMAP Plot</b>`, font: { family: 'Titillium Web', size: 18, color: 'black' } },
    };

    Plotly.relayout('umap-svg-container', layout);
  }



function setlegendHTML(legendHtml) {
  const legendContainer = document.getElementById('umap-legend-container');
  if (legendContainer) {
    legendContainer.innerHTML = legendHtml;
  }
}


function updatePlotByColor(colorColumn, color) {
  const colorValues = ORIGINAL_DATASET.map(obj => obj[colorColumn]);
  const uniqueColors = [...new Set(colorValues)];
  const colorMap = {};
  uniqueColors.forEach((color, index) => {
    colorMap[color] = index;
  });
  const colors = colorValues.map(c => c === color ? `hsl(${(colorMap[color] * 360 / uniqueColors.length)}, 100%, 50%)` : 'rgba(0,0,0,0)');
  const update = { marker: { color: colors, size: 10 } };

  const layout = {
    title: { text: `<b>UMAP Plot for the ${color} class of ${colorColumn} metric</b>`, font: { family: 'Titillium Web', size: 18, color: 'black' } },
  };

  Plotly.restyle('umap-svg-container', update);
  Plotly.relayout('umap-svg-container', layout);
}

function updateUmap(dataset, nComponents, nNeighbors, distanceFn, minDist, spread, colorColumn = 'MFR') {
  const legendContainer = document.getElementById('umap-legend-container');
  const umap = initUmap(dataset, nComponents, nNeighbors, distanceFn, minDist, spread);
  const update = {
    x: [umap.uAxis],
    y: [umap.vAxis]
  };

  const layout = {
    title: { text: `<b>UMAP Plot</b>`, font: { family: 'Titillium Web', size: 18, color: 'black' } },
  };

  if (legendContainer.innerHTML.trim() !== '') {
    updateLegend(dataset, colorColumn);
  } else {
    update.marker = { color: Array(ORIGINAL_DATASET.length).fill('#00304e'), size: 10 };
  }

  Plotly.update('umap-svg-container', update);
  Plotly.relayout('umap-svg-container', layout);

  if (selectedCaseName !== null) {
        enter_select_umap_view(selectedCaseName);
    }
}


function handleExpression(expression) {
  // Parse the expression and do something with it
  var parts = expression.split(' and ');
  for (var i = 0; i < parts.length; i++) {
    var subParts = parts[i].split(' or ');
    for (var j = 0; j < subParts.length; j++) {
      console.log(subParts[j]);
    }
  }
}




function enter_select_umap_view (case_name) {
  selectedCaseName = case_name;
    // exit_select_umap_view();

   var myPlott = document.getElementById('umap-svg-container');
    var datagraph = myPlott.data;

    for (var j = 0; j < datagraph[0].text.length; j ++) {
        if (datagraph[0].text[j] == case_name) {
                var test_value = 1;
                    colors3 = Array(ORIGINAL_DATASET.length).fill('#00304e');
                    colors3[j] = '#ffc000';
                    var update3 = {'marker':{color: colors3, size:10}};
                    Plotly.restyle('umap-svg-container', update3);
            } else {
                var test_value = 0;
            }
    };



}

