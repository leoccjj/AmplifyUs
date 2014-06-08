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

		$scope.mode = "direct";

		$scope.memes = ["harlem", "nyan", "happy", "gangnam", "fox", "friday", "daft_punk"]; 
		$scope.memeIndex = 0; 

		wsserver.on('tick', function(args) {
			$scope.touchActivity = args; 
			$scope.meanOnsetDurations = parseInt(args.meanOnsetDuration, 10);
			$scope.groupActivity = args.groupActivity;
			$scope.serverAvailable = true; 
		}); 

		// Todo: this needs to be a directive or something... 
		wsserver.on('config', function(args) {

			if ($scope.guiControllers.length == 0) {

				// Config From Server
				$scope.guiVariables = args;

				$scope.guiControllers.push(gui.add($scope.guiVariables, 'decayRate', .000125, .020));
				$scope.guiControllers.push(gui.add($scope.guiVariables, 'addRate', 0.001, 0.100));

				_.forEach($scope.guiControllers, function(controller){
					controller.onFinishChange(function(value){
						$scope.$apply(); 
					});
				}); 

				// Local Config
				$scope.guiVariables.gain = 0.50;
				$scope.guiVariables.tempo = 115; 

				$scope.guiVariables.setDirect = function() {

					audioEngine.dispatch("intensity", {instrument: "musicbox", intensity: 1.0}); 
					audioEngine.dispatch("intensity", {instrument: "cello_pluck", intensity: 1.0}); 
					audioEngine.dispatch("intensity", {instrument: "vibraphone", intensity: 1.0}); 
					audioEngine.dispatch("intensity", {instrument: "syntklocka_stab_plink", intensity: 1.0}); 

					audioEngine.dispatch("percussion_volume", {instrument: "a", intensity: 1.0}); 
					audioEngine.dispatch("percussion_volume", {instrument: "b", intensity: 1.0}); 
					audioEngine.dispatch("percussion_volume", {instrument: "c", intensity: 1.0}); 

					audioEngine.dispatch("delay_sync", {instrument: "delay", intensity: "4"}); 

					$scope.mode = "direct";

				};

				$scope.guiVariables.setModel = function() {
					audioEngine.loadPatterns();
					$scope.mode = "model"; 
				};

				var gainController   = gui.add($scope.guiVariables, 'gain', 0.0, 1.0);
				var tempoController  = gui.add($scope.guiVariables, 'tempo', 40, 130); 
				var directController = gui.add($scope.guiVariables, 'setDirect'); 
				var modelController  = gui.add($scope.guiVariables, 'setModel'); 

				$scope.guiControllers.push(gainController);
				$scope.guiControllers.push(tempoController);

				gainController.onFinishChange(function(value){
					DMAF.masterVolume = value; 
					DMAF.context.master.gain.setTargetValueAtTime(value, 0, 0.2);
				});

				tempoController.onFinishChange(function(value){
					audioEngine.dispatch("tempo", value);
				});

			}

			if(!audioEngine.enabled){
				console.log("AudioEngine not active", audioEngine);
				return;
			}

			//console.log("AudioBusManager", DMAF.Managers.getAudioBusManager());
			//console.log("MusicController", DMAF.Processors.getMusicController());
			//console.log("SynthManager", DMAF.Managers.getSynthManager());

			audioEngine.dispatch("musicOn");

			audioEngine.setMemeCallback(function(){

				var audioBusManager = DMAF.Managers.getAudioBusManager();
				audioBusManager.activeAudioBusInstances.output_bus.output.gain.setTargetValueAtTime(DMAF.masterVolume, 0, 0.25);

				wsserver.send({event: "meme-stop"});

			}); 

			setInterval(function(){
				audioEngine.dispatch("transpose");
			}, 4000);

			//setInterval(function() {
			//	audioEngine.dispatch("transpose");
			//}, 4 * DMAF.Processors.getMusicController().player.barLength);

		});

		wsserver.on('touch', function(args) {

			var touchEvent = args.touch;

			var pin = touchEvent.sensorPin; 

			if ($scope.mode == "direct") {

				audioEngine.dispatch("intensity", {instrument: "musicbox", intensity: 1.0}); 
				audioEngine.dispatch("intensity", {instrument: "cello_pluck", intensity: 1.0}); 
				audioEngine.dispatch("intensity", {instrument: "vibraphone", intensity: 1.0}); 
				audioEngine.dispatch("intensity", {instrument: "syntklocka_stab_plink", intensity: 1.0}); 

				audioEngine.dispatch("percussion_volume", {instrument: "a", intensity: 1.0}); 
				audioEngine.dispatch("percussion_volume", {instrument: "b", intensity: 1.0}); 
				audioEngine.dispatch("percussion_volume", {instrument: "c", intensity: 1.0}); 

				if (touchEvent.group == 0) {

					if (pin == 0) {
						audioEngine.dispatch("musicbox", {c: 0, e: 250, n: 68, noteEndTime: 0.500, t: "noteOn", v: 80}); 
					} else if (pin == 1) {
						audioEngine.dispatch("musicbox", {c: 120, e: 250, n: 72, noteEndTime: 0.500, t: "noteOn", v: 90}); 
					} else if (pin == 2) {
						audioEngine.dispatch("musicbox", {c: 460, e: 250, n: 77, noteEndTime: 0.500, t: "noteOn", v: 127}); 
					} else if (pin == 3) {
						audioEngine.dispatch("musicbox", {c: 460, e: 250, n: 80, noteEndTime: 0.500, t: "noteOn", v: 127}); 
					}

				} else if (touchEvent.group == 1) {

					if (pin == 0) {
						audioEngine.dispatch("cello_pluck", {c: 0, e: 250, n: 80, noteEndTime: 3.500, t: "noteOn", v: 80}); 
					} else if (pin == 1) {
						audioEngine.dispatch("cello_pluck", {c: 120, e: 250, n: 84, noteEndTime: 3.500, t: "noteOn", v: 90}); 
					} else if (pin == 2) {
						audioEngine.dispatch("cello_pluck", {c: 460, e: 250, n: 89, noteEndTime: 3.500, t: "noteOn", v: 127}); 
					} else if (pin == 3) {
						audioEngine.dispatch("cello_pluck", {c: 460, e: 250, n: 91, noteEndTime: 3.500, t: "noteOn", v: 127}); 
					}

				} else if (touchEvent.group == 2) {

					if (pin == 0) {
						audioEngine.dispatch("vibraphone", {c: 0, e: 250, n: 80, noteEndTime: 0.500, t: "noteOn", v: 80}); 
					} else if (pin == 1) {
						audioEngine.dispatch("vibraphone", {c: 120, e: 250, n: 84, noteEndTime: 0.500, t: "noteOn", v: 90}); 
					} else if (pin == 2) {
						audioEngine.dispatch("vibraphone", {c: 460, e: 250, n: 89, noteEndTime: 0.500, t: "noteOn", v: 127}); 
					} else if (pin == 3) {
						audioEngine.dispatch("vibraphone", {c: 460, e: 250, n: 91, noteEndTime: 0.500, t: "noteOn", v: 127}); 
					}

				} else if (touchEvent.group == 3) {

					if (pin == 0) {
						audioEngine.dispatch("syntklocka_stab_plink", {c: 0, e: 250, n: 80, noteEndTime: 0.500, t: "noteOn", v: 80}); 
					} else if (pin == 1) {
						audioEngine.dispatch("syntklocka_stab_plink", {c: 120, e: 250, n: 84, noteEndTime: 0.500, t: "noteOn", v: 90}); 
					} else if (pin == 2) {
						audioEngine.dispatch("syntklocka_stab_plink", {c: 460, e: 250, n: 89, noteEndTime: 0.500, t: "noteOn", v: 127}); 
					} else if (pin == 3) {
						audioEngine.dispatch("syntklocka_stab_plink", {c: 460, e: 250, n: 91, noteEndTime: 0.500, t: "noteOn", v: 127}); 
					}

				}

			}
			
		}); 

		wsserver.on('colors', function(colorEvent) {
			$scope.colorModel = colorEvent.colorModel; 
		});

		wsserver.on('audio', function(audioEvent) {
			var model = audioEvent.audioModel;
			if ($scope.mode == "model") dispatch(model); 
			else if (model.meme) {
				$scope.playMeme($scope.memes[$scope.memeIndex % 7]); 
				$scope.memeIndex++; 
			}
				
		}); 

		wsserver.connect(appConfig.wsURL);

		$scope.go = function (path) {
			$location.path(path);
		}

		$scope.registerTouch = function(event, group) {
			wsserver.send({event: event, group: group, sensorPin: 3}); 
		}; 

		/* 
		$scope.pluck = function(pin) {

			wsserver.send({event: "touchdown", group: 0, sensorPin: pin});

			//var nextTime = DMAF.Processors.getMusicController().player.getNextBeatTime(); 
			//console.log(DMAF.Processors.getMusicController().player.getCurrentBeatTime()); 

			// setTimeout()

			console.log(pin);

			if (pin == 1) {
				audioEngine.dispatch("cello_pluck", {c: 0, e: 250, n: 77, noteEndTime: 3.500, t: "noteOn", v: 127}); 
				audioEngine.dispatch("cello_pluck", {c: 120, e: 250, n: 84, noteEndTime: 3.500, t: "noteOn", v: 127}); 
				audioEngine.dispatch("cello_pluck", {c: 460, e: 250, n: 89, noteEndTime: 3.500, t: "noteOn", v: 127}); 
			} else if (pin == 2) {
				audioEngine.dispatch("cello_pluck", {c: 0, e: 250, n: 91, noteEndTime: 3.500, t: "noteOn", v: 127}); 
				audioEngine.dispatch("cello_pluck", {c: 120, e: 250, n: 84, noteEndTime: 3.500, t: "noteOn", v: 127}); 
				audioEngine.dispatch("cello_pluck", {c: 460, e: 250, n: 80, noteEndTime: 3.500, t: "noteOn", v: 127}); 
			} else if (pin == 3) {
				audioEngine.dispatch("cello_pluck", {c: 0, e: 250, n: 80, noteEndTime: 3.500, t: "noteOn", v: 127}); 
				audioEngine.dispatch("cello_pluck", {c: 120, e: 250, n: 84, noteEndTime: 3.500, t: "noteOn", v: 127}); 
				audioEngine.dispatch("cello_pluck", {c: 460, e: 250, n: 89, noteEndTime: 3.500, t: "noteOn", v: 127}); 
			}


			if (pin == 1) {
				audioEngine.dispatch("cello_pluck", {c: 0, e: 250, n: 80, noteEndTime: 3.500, t: "noteOn", v: 127}); 
			} else if (pin == 2) {
				audioEngine.dispatch("cello_pluck", {c: 0, e: 250, n: 80, noteEndTime: 3.500, t: "noteOn", v: 100}); 
				audioEngine.dispatch("cello_pluck", {c: 120, e: 250, n: 84, noteEndTime: 3.500, t: "noteOn", v: 127}); 
			} else if (pin == 3) {
				audioEngine.dispatch("cello_pluck", {c: 0, e: 250, n: 80, noteEndTime: 3.500, t: "noteOn", v: 90}); 
				audioEngine.dispatch("cello_pluck", {c: 120, e: 250, n: 84, noteEndTime: 3.500, t: "noteOn", v: 100}); 
				audioEngine.dispatch("cello_pluck", {c: 460, e: 250, n: 89, noteEndTime: 3.500, t: "noteOn", v: 127}); 
			} else if (pin == 4) {
				audioEngine.dispatch("cello_pluck", {c: 0, e: 250, n: 80, noteEndTime: 3.500, t: "noteOn", v: 80}); 
				audioEngine.dispatch("cello_pluck", {c: 120, e: 250, n: 84, noteEndTime: 3.500, t: "noteOn", v: 90}); 
				audioEngine.dispatch("cello_pluck", {c: 460, e: 250, n: 89, noteEndTime: 3.500, t: "noteOn", v: 100}); 
				audioEngine.dispatch("cello_pluck", {c: 460, e: 250, n: 92, noteEndTime: 3.500, t: "noteOn", v: 127}); 
			}

		}; 

		*/ 

		$scope.$watch('guiVariables', function(newValue, oldValue) {

			if ($scope.serverAvailable)
				wsserver.send({event: "config", config: newValue});

		}, true);

		$scope.playMeme = function(memeName) {

			audioEngine.dispatch("scratch");

			setTimeout(function() {

				var audioBusManager = DMAF.Managers.getAudioBusManager();
				audioBusManager.activeAudioBusInstances.output_bus.output.gain.setTargetValueAtTime(0.0, 0, 0.25);

				audioEngine.dispatch(memeName);

				wsserver.send({event: "meme-start"});

			}, 700);

		}

		function dispatch(model) {

			//var nextTime = DMAF.Processors.getMusicController().player.getNextBeatTime(); 
			//console.log(DMAF.Processors.getMusicController().player.getCurrentBeatTime()); 

			if (model.wait) {
				audioEngine.dispatch(model.key, model.value); 
			}
			else if (model.instrument) {
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
