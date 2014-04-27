var module = angular.module('myApp', [
	'ngRoute',
	'ngResource',
	'ngAnimate',
	'ngTouch', 
	'myApp.controllers'
]); 

module.config(['$routeProvider', function($routeProvider) {
	$routeProvider.when('/overview', {templateUrl: 'partials/overview', controller: 'AppController'});
	$routeProvider.when('/sound', {templateUrl: 'partials/sound', controller: 'AppController'});
	$routeProvider.when('/light', {templateUrl: 'partials/light', controller: 'AppController'});
	$routeProvider.when('/nodes', {templateUrl: 'partials/nodes', controller: 'AppController'});
	$routeProvider.when('/settings', {templateUrl: 'partials/settings', controller: 'AppController'});
	$routeProvider.otherwise({redirectTo: '/overview'});
}]);


module.factory('api', function($resource, $http){

	return {

		sendMessage: function(key, arguments) {

		}, 

		capturePhoto: function(callback) {

			this.sendMessage("");

		}, 

	}

});