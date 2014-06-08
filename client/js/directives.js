'use strict';

var app = angular.module('myApp');

app.directive('menuContainer', function() {

	return {
		restrict: 'AE',
		replace: 'true',
		templateUrl: 'partials/menu'
	};

}); 

app.directive('touchNode', function() {

	return {
		restrict: 'AE',
		replace: 'true',
		templateUrl: 'partials/touch-node'
	};

});

app.directive('touchChart', function () {

  // Define constants and helpers used for the directive
	var n = 40,
		random = d3.random.normal(0, 0),
		data = d3.range(n).map(random);

	var margin = {top: -2, right: 0, bottom: 20, left: 0},
		width = 540 - margin.left - margin.right,
		height = 200 - margin.top - margin.bottom;

	var x = d3.scale.linear()
		.domain([0, n - 1])
		.range([0, width]);

	var y = d3.scale.linear()
		.domain([0, 1])
		.range([height, 0]);

	var line = d3.svg.line()
		.x(function(d, i) { return x(i); })
		.y(function(d, i) { return y(d); });

  return {

	restrict: 'AE',
	scope: { 
		point: '='
	},

	link: function (scope, element, attrs) {

		var vis = d3.select(element[0])
			.append("svg")
			.attr("width", width)
			.attr("height", height)
			.append("g")
			.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

		vis.append("defs").append("clipPath")
			.attr("id", "clip")
			.append("rect")
			.attr("width", width)
			.attr("height", height);

		var path = vis.append("g")
			.attr("clip-path", "url(#clip)")
			.append("path")
			.datum(data)
			.attr("class", "line")
			.attr("d", line)
			.style("stroke", "#0F0F1E")
			.style("stroke-width", "3"); 

		var that = this; 

		scope.$watch('point', function (newVal, oldVal) {

			// push a new data point onto the back

			if (newVal.value != oldVal.value ) {

				data.push(newVal.value);

				path
					.attr("d", line)
					.attr("transform", null)
					.transition()
					.duration(500)
					.ease("linear")
					.attr("transform", "translate(" + x(-1) + ",0)")
					.each("end", that);

				// pop the old data point off the front
				data.shift();

			}

		}, true);


	}};

});

app.directive('colorVisualizer', function () {

	var canvasElem; 	// The DOM node element of the <canvas>
	var canvasCtx; 		// The 2D context of the <canvas>
	var circleRadius;   // size of the wheel 

	function drawColorsOnWheel (colors) {

		_.forEach(colors, function(colorMarker, index){

			if (colorMarker.H === 0) return; 

			// 0 to circle Radius
			var rad = (colorMarker.S * circleRadius);//  / 2; 

			var denormalizedHue = colorMarker.H * (Math.PI * 2); 

			var theta = rad_to_deg(denormalizedHue) * Math.PI / 180; 
			var dX = rad * Math.cos(theta);
			var dY = rad * Math.sin(theta); 

			var updatedColor = new RGBAColor();
			updatedColor.setFromHSV(rad_to_deg(denormalizedHue) % 360, 1.0 / 2, 1.0, 1.0); 

			var rgbString = "rgb(" + updatedColor.r + "," + updatedColor.g + "," + updatedColor.b + ")"; 

			//console.log(rgbString);
			var myLayer = $('canvas').getLayer("circle-" + index);

			if ( myLayer === undefined ) {
				$('canvas').drawArc({
					layer: true,
					name: "circle-" + index, 
					strokeStyle: "#5e5b5e",
					strokeWidth: 1 + index,
					fillStyle: rgbString, 
					x: circleRadius + dX, y: circleRadius + dY,
					radius: 32, 
				});
			} else {

				myLayer.x = circleRadius + dX;
				myLayer.y = circleRadius + dY;
				myLayer.fillStyle = rgbString; 
			}

			$('canvas').drawLayers(); // ("circle-" + index);

		});

	}; 

	return {

		restrict: 'AE',
		scope: {
			model: '='
		},

		template: '<canvas id="visualizer-canvas"> </canvas>', 

		link: function (scope, element, attrs) {

			canvasElem = document.getElementById("visualizer-canvas");
			canvasCtx = canvasElem.getContext("2d");

			canvasElem.width = 600;
			canvasElem.height = 600;

			var centerX = canvasElem.width / 2;
			var centerY = canvasElem.height / 2;

			circleRadius = Math.floor(Math.min(canvasElem.width, canvasElem.height) / 2) - 2;

			/* 

			var imgData = canvasCtx.getImageData(0, 0, canvasElem.width, canvasElem.height);
			var pix = imgData.data;

			var centerX = canvasElem.width / 2;
			var centerY = canvasElem.height / 2;

			circleRadius = Math.floor(Math.min(canvasElem.width, canvasElem.height) / 2) - 2;

			var color = new RGBAColor();

			for (var y = 0; y < canvasElem.height; y++) {

				for (var x = 0; x < canvasElem.width; x++) {

					var dx = x - centerX;
					var dy = y - centerY;

					var pointRadius = Math.sqrt(square(dx) + square(dy));   // Radius of the point (len)
					var pointAngle = 180 * Math.atan2(dy, dx) / Math.PI;    // Angle of the point (in degree)

					if (pointRadius <= circleRadius + 1) {

						var h = pointAngle;
						var s, alpha;

						if (pointRadius <= circleRadius) {
							// The point is in the circle, the saturation
							// depends on the radius of the point.
							s = pointRadius / circleRadius;
							alpha = 255;
						} else {
							// The point is out of the circle by 1 unit.
							// This is used for the "antialias" effect.
							s = 1;
							alpha = (1 - (pointRadius - circleRadius)) * 255;
						}

						color.setFromHSV(h, s, 1.0, alpha);

					} else {
						// Point is completely out of the circle; used to draw a fully transparent pixel.
						color.setRGBA(0, 0, 0, 0);
					}

					var pixIdx = (y * canvasElem.width + x) * 4;

					pix[pixIdx+0] = color.r;
					pix[pixIdx+1] = color.g;
					pix[pixIdx+2] = color.b;
					pix[pixIdx+3] = color.alpha;

				}
			}
	
			*/ 

			// Manually saved this to the asssets directory 
			// canvasCtx.putImageData(imgData, 0, 0);

			//var dataUrl = canvasElem.toDataURL();
		 	//canvasElem.style.background='url('+dataUrl+')'

			scope.$watch('model', function (newVal, oldVal) {
				
				if (newVal !== oldVal) {
					// canvasCtx.putImageData(imgData, 0, 0);
					drawColorsOnWheel(newVal); 
				}

			}, true);


		}

	};

});

app.directive('lightVisualizer', function () {

	return {

		restrict: 'AE',
		scope: {
			model: '='
		},

		templateUrl: "partials/light-visualizer", 

		link: function (scope, element, attrs) {

			/* 
			scope.$watch('model', function (newVal, oldVal) {

				// console.log(newVal); 
				
			}, true);

			*/ 

		}

	};

});