var appConfig = {
	wsURL: 'ws://localhost:4005',
}; 

var gui = new dat.GUI();

var appControllers = angular.module('myApp.controllers', []);

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

appControllers.controller('AppController', ['$q', '$rootScope', '$scope', '$location', 'api', 'wsserver',

	function($q, $rootScope, $scope, $location, api, wsserver) {

		// {color:'red'}

		$scope.touchActivity = {}; 
		$scope.meanOnsetDurations = 0; 
		$scope.groupActivity = []; 

		$scope.guiVariables = {}; 
		$scope.guiControllers = []; 
		$scope.serverAvailable = false; 


		wsserver.on('tick', function(args) {
        	$scope.touchActivity = args; 
        	$scope.meanOnsetDurations = parseInt(args.meanOnsetDuration, 10);
        	$scope.groupActivity = args.groupActivity;
        	$scope.serverAvailable = true; 
        	// $scope.$apply(); 
        }); 

		// Alright this stuff really needs to be a directive or something
        wsserver.on('config', function(args) {

        	if ($scope.guiControllers.length == 0) {

	        	$scope.guiVariables = args;

	 	 		$scope.guiControllers.push(gui.add($scope.guiVariables , 'decayRate', .000125, .0050));
	 	 		$scope.guiControllers.push(gui.add($scope.guiVariables , 'addRate', 0.001, 0.050));

	 	 		_.forEach($scope.guiControllers, function(controller){
	 	 			controller.onFinishChange(function(value){
	 	 				$scope.$apply(); 
	 	 			});
	 	 		}); 
	 	 		
 	 		}

        });


        wsserver.connect(appConfig.wsURL);

		$scope.go = function (path) {
			$location.path(path);
		}

		$scope.registerTouch = function(event, group) {
			wsserver.send({event: event, group: group})
		}; 

		$scope.$watch('guiVariables', function(newValue, oldValue) {

			// console.log(newValue);
			if ($scope.serverAvailable)
			 	wsserver.send({event: "config", config: newValue});

		}, true);

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
