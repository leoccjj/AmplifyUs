var appConfig = {
	wsURL: 'ws://localhost:4005',
}; 

var appControllers = angular.module('myApp.controllers', []);

var audioEngine = new DMAF.Framework(); 
var gui = new dat.GUI();

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

appControllers.controller('AppController', ['$q', '$rootScope', '$scope', '$location', 'api', 'wsserver',

	function($q, $rootScope, $scope, $location, api, wsserver) {

		audioEngine.dispatch("loadGlobal");

		$scope.touchActivity = {}; 
		$scope.meanOnsetDurations = 0; 
		$scope.groupActivity = []; 

		$scope.guiVariables = {}; 
		$scope.guiControllers = []; 
		$scope.serverAvailable = false; 

		$scope.colorModel = new Array();
		$scope.audioModel = new Object(); 

		wsserver.on('tick', function(args) {
        	$scope.touchActivity = args; 
        	$scope.meanOnsetDurations = parseInt(args.meanOnsetDuration, 10);
        	$scope.groupActivity = args.groupActivity;
        	$scope.serverAvailable = true; 
        }); 

		// Todo: this needs to be a directive or something... 
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

			if(!audioEngine.enabled){
				console.log("AudioEngine not active", audioEngine);
				return;
			}

			audioEngine.loadPatterns();

			console.log("SynthManager", DMAF.Managers.getSynthManager());
			console.log("AudioBusManager", DMAF.Managers.getAudioBusManager());
			console.log("MusicController", DMAF.Processors.getMusicController());

			audioEngine.dispatch("musicOn");

			//setInterval(function() {
			//	audioEngine.dispatch("transpose");
			//}, 4 * DMAF.Processors.getMusicController().player.barLength);

        });

        wsserver.on('colors', function(colorEvent) {
        	$scope.colorModel = colorEvent.colorModel; 
        });

        wsserver.on('audio', function(audioEvent) {

        	console.log('audioEvent', audioEvent.audioModel); 

        	var model = audioEvent.audioModel;

        	dispatch(model);

        }); 

        wsserver.connect(appConfig.wsURL);

		$scope.go = function (path) {
			$location.path(path);
		}

		$scope.registerTouch = function(event, group) {
			wsserver.send({event: event, group: group})
		}; 

		$scope.$watch('guiVariables', function(newValue, oldValue) {

			if ($scope.serverAvailable)
			 	wsserver.send({event: "config", config: newValue});

		}, true);

		function dispatch(model) {
			if (model.instrument) {
				audioEngine.dispatch(model.key, {instrument: model.instrument, intensity: model.value}); 
			}
			else {
				audioEngine.dispatch(model.key); 
			}
		}

	}

]);

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

appControllers.controller('MenuController', ['$q', '$rootScope', '$scope', '$location', 'api', 

	function($q, $rootScope, $scope, $location, api) {

		$scope.go = function (path) {
			$location.path(path);
		}

	}

]);

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////
