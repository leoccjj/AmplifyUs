var appConfig = {
	wsURL: 'ws://localhost:4005',
}; 

var appControllers = angular.module('myApp.controllers', []);

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////


appControllers.controller('AppController', ['$q', '$rootScope', '$scope', '$location', 'api', 'wsserver',

	function($q, $rootScope, $scope, $location, api, wsserver) {

		// {color:'red'}

		$scope.touchActivity = {}; 
		$scope.meanOnsetDurations = 0; 
		$scope.groupActivity = []; 

		wsserver.on('tick', function(args) {
        	$scope.touchActivity = args; 
        	$scope.meanOnsetDurations = parseInt(args.meanOnsetDuration, 10);
        	$scope.groupActivity = args.groupActivity;
        	// $scope.$apply(); 
        }); 

        wsserver.connect(appConfig.wsURL);

		$scope.go = function (path) {
			$rootScope.showMenu = true; 
			$location.path(path);
		}

		$scope.registerTouch = function(event, group) {
			wsserver.send({event: event, group: group})
		}; 


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
