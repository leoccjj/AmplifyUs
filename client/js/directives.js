'use strict';

function RGBAColor(r, g, b, alpha) {
	this.r = r;
	this.g = g;
	this.b = b;
	this.alpha = alpha;
}

RGBAColor.prototype.setFromHSV = function(h, s, v, alpha) {

	h = h % 360;

	if (h < 0) {
		h += 360;
	}

	var c = v * s;
	var h1 = h / 60;
	var x = c * (1 - Math.abs(h1%2 - 1));
	var r1 = 0, g1 = 0, b1 = 0;

	switch (Math.floor(h1)) {
		case 0: r1 = c; g1 = x; b1 = 0; break;
		case 1: r1 = x; g1 = c; b1 = 0; break;
		case 2: r1 = 0; g1 = c; b1 = x; break;
		case 3: r1 = 0; g1 = x; b1 = c; break;
		case 4: r1 = x; g1 = 0; b1 = c; break;
		case 5: r1 = c; g1 = 0; b1 = x; break;
	}

	var m = v - c;

	this.r = Math.floor((r1 + m) * 255);
	this.g = Math.floor((g1 + m) * 255);
	this.b = Math.floor((b1 + m) * 255);
	this.alpha = alpha;
	
};

RGBAColor.prototype.setRGBA = function(r, g, b, alpha) {
	this.r = r;
	this.g = g;
	this.b = b;
	this.alpha = alpha;
};

function square(n) {
	return n*n;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

var app = angular.module('myApp');

app.directive('menuContainer', function() {

	return {
		restrict: 'AE',
		replace: 'true',
		templateUrl: 'partials/menu'
	};

}); 

app.directive('colorVisualizer', function() {

	return {
		restrict: 'AE',
		replace: 'true',
		templateUrl: 'partials/color-visualizer'
	};

});

app.directive('touchChart', function () {

  // Define constants and helpers used for the directive
	var n = 40,
		random = d3.random.normal(0, 0),
		data = d3.range(n).map(random);

	var margin = {top: -2, right: 0, bottom: 20, left: 0},
		width = 960 - margin.left - margin.right,
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
	scope: { // attributes bound to the scope of the directive
		point: '='
	},

	link: function (scope, element, attrs) {

		// initialization, done once per my-directive tag in template. If my-directive is within an
		// ng-repeat-ed template then it will be called every time ngRepeat creates a new copy of the template.

		// set up initial svg object
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

		//vis.append("g")
		//	.attr("class", "x axis")
		//	.attr("transform", "translate(0," + y(0) + ")")
		//	.call(d3.svg.axis().scale(x).orient("bottom"));

		//vis.append("g")
		//	.attr("class", "y axis")
		//	.call(d3.svg.axis().scale(y).orient("left"));

		var path = vis.append("g")
			.attr("clip-path", "url(#clip)")
			.append("path")
			.datum(data)
			.attr("class", "line")
			.attr("d", line)
			.style("stroke", "#0F0F1E")
			.style("stroke-width", "3"); 

		// whenever the bound 'exp' expression changes, execute this 
		scope.$watch('point', function (newVal, oldVal) {

			// push a new data point onto the back
			
			if (newVal.value !== oldVal.value) {
				
				data.push(newVal.value);

				path
					.attr("d", line)
					.attr("transform", null)
					.transition()
					.duration(500)
					.ease("linear")
					.attr("transform", "translate(" + x(-1) + ",0)")
					.each("end", this);

				// pop the old data point off the front
				data.shift();

			}

		}, true);


	}};

});

app.directive('hsvCircle', function () {

	var canvasElem; // The DOM node element of the <canvas>
	var canvasCtx; // The 2D context of the <canvas>

	return {

		restrict: 'AE',
		scope: { // attributes bound to the scope of the directive
			point: '='
		},
		template: '<canvas id="hsv"> </canvas>', 

		link: function (scope, element, attrs) {

			canvasElem = document.getElementById("hsv");
			canvasCtx = canvasElem.getContext("2d");

			canvasElem.width = 600;
			canvasElem.height = 600; 

			var imgData = canvasCtx.getImageData(0, 0, canvasElem.width, canvasElem.height);
			var pix = imgData.data;

			var centerX = canvasElem.width / 2;
			var centerY = canvasElem.height / 2;

			var circleRadius = Math.floor(Math.min(canvasElem.width, canvasElem.height) / 2) - 2;

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
						// The point is completely out of the circle.
						// This is used to draw a fully transparent pixel.
						color.setRGBA(0, 0, 0, 0);
					}

					var pixIdx = (y * canvasElem.width + x) * 4;

					pix[pixIdx+0] = color.r;
					pix[pixIdx+1] = color.g;
					pix[pixIdx+2] = color.b;
					pix[pixIdx+3] = color.alpha;

				}
			}

			canvasCtx.putImageData(imgData, 0, 0);
	
			//var twoPi = Math.PI * 2;
			// var test = new RGBAColor(0, 0, 255, 1);
			//var radians = degrees / 180 * Math.PI; 

			// var pointRadius = Math.sqrt(square(dx) + square(dy));   // Radius of the point (len)
			// var pointAngle = 180 * Math.atan2(dy, dx) / Math.PI;    // Angle of the point (in degree)

			function deg_to_rad (angle) {
				return angle / 180 * Math.PI; 
			};

			for ( var i = 0; i < 360; i++) {

				var len = circleRadius / 2; 

				var theta = i * Math.PI / 180; 
				var dx = len * Math.cos(theta);
				var dy = len * Math.sin(theta); 

				console.log(dx, dy, circleRadius); 

				$('canvas').drawArc({
					strokeStyle: '#343434',
	  				strokeWidth: 2,
					x: circleRadius + dx, y: circleRadius + dy,
					radius: 4, 
					fromCenter: true,
				});

			}

			// whenever the bound 'exp' expression changes, execute this 
			scope.$watch('colors', function (newVal, oldVal) {

			}, true);


		}

	};

});