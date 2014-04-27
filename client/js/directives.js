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