var appControllers = angular.module('myApp.controllers', []);

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////


appControllers.controller('AppController', ['$q', '$rootScope', '$scope', '$location', 'api', 

	function($q, $rootScope, $scope, $location, api) {

		$scope.showMenu = true;

		$scope.go = function (path) {
			$location.path(path);
		}

		$scope.$watch('showMenu', function(newValue, oldValue) { 
			console.log(newValue); 
		});


	}

]);

appControllers.controller('MenuController', ['$q', '$rootScope', '$scope', '$location', 'api', 

	function($q, $rootScope, $scope, $location, api) {

		$scope.go = function (path) {
			$location.path(path);
		}


	}

]);

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////
