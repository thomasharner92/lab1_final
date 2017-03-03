/* Thomas Harner
main.js
2/27/2017
geoJSON data source: baseball-reference statistics
http://www.baseball-reference.com/leagues/MLB/2016-misc.shtml
style.css menu set-up per Mapbox Filter tutorial:
https://www.mapbox.com/mapbox.js/example/v1.0.0/filtering-markers/
*/

// Constructor for creation of popup object (OOP)
function Popup(properties, attribute, layer, radius) {
    this.properties = properties;
    this.layer = layer;
    this.year = attribute;
    this.attendance = properties[attribute];
    var attYear = attribute.split(" ");
    var year = attYear[0];
    this.content = "<p><b>Team:</b> " + this.properties['Team Name'] + "</p>" + "<p><b>Average Attendance in " + year + ":</b> " + this.attendance + " people</p>";
    
    this.bindToLayer = function() {
        this.layer.bindPopup(this.content, {
            offset: new L.Point(0,-radius)
        })
    };
};

function createMap() {
    // create map
    var map = L.map('mapid').setView(new L.LatLng(37.639018, -87.981940),4); 
    L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
    attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
    maxZoom: 18,
    id: 'mapbox.pirates',
    accessToken: 'pk.eyJ1IjoidGhvbWFzaGFybmVyIiwiYSI6ImNpc2c3cGNwcTAxczUyeW52bGo2bWc3c2cifQ.Nt2v3vP4lisWYxZ6hXgHyQ'
        
}).addTo(map);
    
    
    
    
    getData(map);
    
};

// Obtain the JSON
function getData(map) {
    $.ajax("data/attendance.geojson", {
        dataType: "json",
        success: function(response) {
         
            // Generate an array of attributes (years of attendance)
            var attributes = processData(response);
            
            /*
            Function calls for initial setup of the map based
            on geojson data and array of year attributes
            */
     
            // Set up proportional symbols
            updatePropSymbols(response,map,attributes);
            // Create interactive slider, buttons
            createSequenceControls(map,attributes);
            // Create menu to filter data by baseball division
            createFilterMenu(map,response,attributes);
            // Create the legend
            createLegend(map, attributes);
            // Update the legend to set it to the first year of data
            updateLegend(map, attributes[0]);
            
        }
    });
};


// Used to create and return an array of year attributes from the GEOJSON data
function processData(data) {
    
    // create an array for attributes
    var attributes = [];
    
    // work with the first record in the collection of features
    var properties = data.features[0].properties;
    
    // push each attribute name into the array
    for (var attribute in properties) {
        // Append to the attributes array if the attribute from the 
        // feature collection is for attendance figures
        if (attribute.indexOf("Avg") > -1) {
            attributes.push(attribute);
            
        };
    };
    
    // Return the relevant attributes as an array
    return attributes;
};


// Add circle markers for point features to the map
// Uses AJAX data, array of attributes, and the map object

// Set global variable (allowed for consolidation of update/create symbol functions)
var proportionalSymbols = null;

function updatePropSymbols(data,map,attribute){
    // If the proportional symbols are yet to be created, execute this
	if(proportionalSymbols == null){
			 proportionalSymbols = L.geoJson(data, {
			pointToLayer: function(feature, latlng) {
				return pointToLayer(feature, latlng, attribute); // CALL POINT TO LAYER
			}

		});
		proportionalSymbols.addTo(map);
        
    // If the symbols do exist, update them based on user input via the UI 
	} else{
		map.eachLayer(function(layer) {
		    if (layer.feature && layer.feature.properties[attribute]){
                
		        // Access Feature Properties
		        var props = layer.feature.properties;
		                    
		        // update radius based on the new year attribute
		        var radius = calcPropRadius(props[attribute]);
		        layer.setRadius(radius);
		        
		        // Create a new popup object to bind to the layer
		        var popup = new Popup(props, attribute, layer, radius)
		        
		        popup.bindToLayer();
                
                // Update legend to reflect changes
                updateLegend(map,attribute);
		        
		    };
		});
	}
};
    

// Called to create the initial proportional symbols and the filtered results
// from the user
function pointToLayer(feature, latlng, attributes) {

    // Assign the current attribute based on the first index of the attribute array
    var attribute = attributes[0];
    
    // Marker options
    var options = {
        radius: 8,
        fillColor: "#ff7800",
        color: "#000",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8
    };
    
    
    // For each feature, determine value for selected attribute
    var attValue = Number(feature.properties[attribute]);
    
    // Give each feature's circle marker a radius based on value
    options.radius = calcPropRadius(attValue);
    
    // Create circle marker layer
    var layer = L.circleMarker(latlng, options);
    
    // Function call for createPopup
    var popup = new Popup(feature.properties, attribute, layer, options.radius);
    
    // Bind popup object to the circle marker
    popup.bindToLayer();
    
    // Event listeners to show popup upon hovering
    layer.on({
        mouseover: function() {
            this.openPopup();
        },
        mouseout: function() {
            this.closePopup()
        }

    });
    
    // Return circle marker to L.geoJson pointToLayer option
    return layer;
    
};

// Calculate the radius of each proportional symbol
function calcPropRadius(attValue) {
    var scaleFactor = 2;
    
    // Area based on attribute, scale factor
    var area = attValue/100.0 * scaleFactor;
    
    // Radius calculated based on area
    var radius = Math.sqrt(area/Math.PI);
    
    return radius;
};


// Create sequence controls
function createSequenceControls(map, attributes) {
    
    var SequenceControl = L.Control.extend({
        options: {
            position: 'bottomleft'
        },
        
        onAdd: function(map) {
            //control container div with particular class name
            var container = L.DomUtil.create('div','sequence-control-container');
            
            // create range input element (slider bar)
            $(container).append('<input class="range-slider" type="range">');
            
            $(container).append('<button class="skip" id="reverse">Reverse</button>');
            $(container).append('<button class="skip" id="forward">Skip</button>');
            
            // Prevent panning of the map when clicking near the slider
            $(container).on('mousedown dblclick', function(e) {
                L.DomEvent.stopPropagation(e);
            });

            // return container object
            return container;
            
        }
    });
    
    // Add the sequence control to the map object
    map.addControl(new SequenceControl());
    
    
    // create range input element (slider bar)
    // slider attribution
    $('.range-slider').attr({
        max: 6,
        min: 0,
        value: 0,
        step: 1
    })

    // Images for the forward/backward icons on the slider
    $('#reverse').html('<img src="images/Backward-icon2.png">');
    $('#forward').html('<img src="images/Forward-icon2.png">');
    
    // Click listener for buttons
    $('.skip').click(function() {
        // get old index
        var index = $('.range-slider').val();
        
        // inc or dec depending on button pressed
        if ($(this).attr('id')== 'forward'){
            index++;
            // If past last attribute, wrap back around
            index = index > 6 ? 0 : index;
        } else if ($(this).attr('id') == 'reverse') {
            index--;
            // If at starting attribute, wrap to max index
            index = index < 0 ? 6 : index;
        };
        
        // update the slider
        $('.range-slider').val(index);
        
        // If the slider changed based on directional buttons, update symbols
        updatePropSymbols(null,map,attributes[index]);
    });
    
    // Create listener for slider
    $('.range-slider').on('input',function() {
        // Get the new index value
        var index = $(this).val();
        // Update proportional symbols if user manipulates the slider bar
        updatePropSymbols(null,map,attributes[index]);
    });
    
};

// Create the Control for filtering teams by the division they are in
function createFilterMenu(map, data,attributes) {

    // Get an array of attributes the user will be able to filter on
    var divisons = [];
    // call helper function to load the array
    divisions = getFilterOptions(data);
    
    
    var FilterControl = L.Control.extend({
        options: {
            position: 'topright'
        },
        
        onAdd: function(map) {
            var container = L.DomUtil.create('div','menu-ui');
            
            // Set the HTML for the menu interface
            container.innerHTML = "<b href = '#'>Filter by Division</b><a href='#' class='active' data-filter='all'>Show all</a> <a href='#' data-filter='NL West'>" + divisions[0] + "</a><a href='#' data-filter='NL East'>" + divisions[1] + "</a> <a href='#' data-filter='AL East'>" + divisions[2] + "</a> <a href = '#' data-filter='NL Central'>" + divisions[3] + "</a> <a href = '#' data-filter='AL Central'>" + divisions[4] + "</a> <a href = '#' data-filter='AL West'>" + divisions[5] + "</a>";
            return container;
        }
        
    });
    
    // Add the filter menu to the map
    map.addControl(new FilterControl);
    
    
    // Event listener for clicking within the menu
    $('.menu-ui a').on('click', function() {
        
        /*
        When the menu is clicked, remove the existing
        layer of data. It will be re-added with the filter
        later.
        */
        map.eachLayer(function(layer) {
            if (layer.feature) {
                map.removeLayer(layer);
            }
        });
        
        // Get the filter value selected by the user
        var selectedFilter = $(this).data('filter');
       
        // Highlight the newly selected filter, remove original highlight
        $(this).addClass('active').siblings().removeClass('active');
        
        // Create a geoJSON layer using the filter properties
        var features = L.geoJSON(data, {
            filter: function(feature, layer) {
                // If the filter is set to all, return everything
                if(selectedFilter == 'all') {
                    return feature.properties.Division;
                }
                // If the filter is set to a specific division, filter by division
                else{
                return feature.properties.Division == selectedFilter;
                }
            },
            // Call point to layer function to re-generate the symbols.
            pointToLayer: function(features, latlng){
                //re-set slider to 0 for the filtered data
                $('.range-slider').val(0);
                return pointToLayer(features,latlng,attributes);
 
                
            }
        });
        // Add your new data to the map
        features.addTo(map);
        // Update the legend (resetting to 0, like the slider)
        updateLegend(map, attributes[0])


    });
};

// Create the initial legend and place it within the map
function createLegend(map, attributes) {
    var LegendControl = L.Control.extend({
        options: {
            position: 'bottomright'
        },
        
        onAdd: function(map) {
            //create control container with a particular class name
            var container = L.DomUtil.create('div','legend-control-container');
            
            // Add temporal legend div to the container
            $(container).append('<div id="temporal-legend">');
            
            
            var svg = '<svg id="attribute-legend" width="160px" height="75px">';       
            
            // circle array of object properties to help design legend text
            var circles = {
            max: 30,
            mean: 45,
            min: 60
            };
            
            // Iterate through each circle object and set up circle and text output
            for (var circle in circles) {
                // circle string
                svg += '<circle class="legend-circle" id="' + circle + '" fill="#F47821" fill-opacity="0.8" stroke="#000000" cx="30"/>';

            //text string
            svg += '<text id="' + circle + '-text" x="65" y="' + circles[circle] + '"></text>';
            };
            
            // close string
            svg += "</svg>";
            
            // add attribute legend svg to container
            $(container).append(svg);
            
            // return legend container
            return container;
        }
    });
    
    // Add legend to the map object
    map.addControl(new LegendControl());


};

// Calculate max, mean, min values for given attribute
function getCircleValues(map, attribute) {
    // highest possible and max at lowest
    
    var min = Infinity;
    var max = -Infinity;
    
    // Find the layer on the map and calculate max/min/mean for the year
    map.eachLayer(function(layer) {
        // get attribute of the layer
        if (layer.feature){
            var attributeValue = Number(layer.feature.properties[attribute]);
            
            // test for min
            if (attributeValue < min) {
                min = attributeValue;
            };
        
            // test max
            if (attributeValue > max) {
                max = attributeValue;
            };
        };
    });
    
    // set the mean (round to prevent half a person)
    var mean = Math.round((max + min) / 2);
    
    // return the value as an object
    return {
        max: max,
        mean: mean,
        min: min
    };
};

// Return the six MLB divisions to filter on
function getFilterOptions(data) {
    
    var filterOptions = [];
    
    for (i = 0; i < data.features.length; i++) {
        var division = (data.features[i].properties.Division);
        // If the division name does not already exist in the division array, add it
        if (filterOptions.indexOf(division) == -1) {
            filterOptions.push(division);
        }; 
    };
    
    // Return array of division names
    return filterOptions;
}

// Update the legend to reflect data based on changes to the UI
function updateLegend(map, attribute) {

    // create text for title of the legend
    var yearSplit = attribute.split(' ');
    var year = yearSplit[0];
    
    var content = "<b>Average Attendance in " + year + "</b>";
    
    // replace legend content
    $('#temporal-legend').html(content);
    
    // Calculate the values of the circles by calling a helper method
    var circleValues = getCircleValues(map, attribute);
    
    // Calculate the radius for the circles in the legend based on circleValues
    for (var key in circleValues){
        //get the radius
        var radius = calcPropRadius(circleValues[key]);

        //Step 3: assign the cy and r attributes
        $('#'+key).attr({
            cy: 59 - radius,
            r: radius
        });
        
        // Append text to the circle svg graphic
        $('#'+key+'-text').text(Math.round(circleValues[key]*100)/100 + " people");
    };
};

$(document).ready(createMap);


