var module = angular.module('myApp', [
	'ngRoute',
	'ngResource',
	'ngAnimate',
	'ngTouch', 
	'myApp.controllers'
]); 

module.config(['$routeProvider', function($routeProvider) {
	$routeProvider.when('/', {templateUrl: 'views/layout', controller: 'AppController'});
	$routeProvider.otherwise({redirectTo: '/'});
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

module.directive('modeSelector', function() {

  return {
      restrict: 'AE',
      replace: 'true',
      templateUrl: 'views/mode-selector.html'
  };

});
