'use strict';

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

	var margin = {top: 20, right: 0, bottom: 20, left: 0},
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
			.attr("transform", "translate(0, -2)")
			.style("stroke-width", "3"); 

		// whenever the bound 'exp' expression changes, execute this 
		scope.$watch('point', function (newVal, oldVal) {

			// push a new data point onto the back
			
			if (newVal.value) {

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