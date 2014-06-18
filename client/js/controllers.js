var appConfig = {
	wsURL: 'ws://localhost:4005',
}; 

var appControllers = angular.module('myApp.controllers', []);

var audioEngine = new DMAF.Framework(); 
var gui = new dat.GUI();

var musicboxNotes = [
	{c: 0, e: 250, n: 68, noteEndTime: 0.750, t: "noteOn", v: 127}, 
	{c: 0, e: 250, n: 72, noteEndTime: 0.750, t: "noteOn", v: 127}, 
	{c: 0, e: 250, n: 77, noteEndTime: 0.750, t: "noteOn", v: 127}, 
	{c: 0, e: 250, n: 80, noteEndTime: 0.750, t: "noteOn", v: 127}
];

var celloNotes = [
	{c: 0, e: 250, n: 80, noteEndTime: 3.750, t: "noteOn", v: 127},
	{c: 0, e: 250, n: 84, noteEndTime: 3.750, t: "noteOn", v: 127},
	{c: 0, e: 250, n: 89, noteEndTime: 3.750, t: "noteOn", v: 127},
	{c: 0, e: 250, n: 91, noteEndTime: 3.750, t: "noteOn", v: 127}
];

var rhodesNotes = [
	{c: 0, e: 250, n: 80 - 12, noteEndTime: 0.750, t: "noteOn", v: 127},
	{c: 0, e: 250, n: 84 - 12, noteEndTime: 0.750, t: "noteOn", v: 127},
	{c: 0, e: 250, n: 89 - 12, noteEndTime: 0.750, t: "noteOn", v: 127},
	{c: 0, e: 250, n: 91 - 12, noteEndTime: 0.750, t: "noteOn", v: 127}
];

var plinkNotes = [
	{c: 0, e: 250, n: 80, noteEndTime: 1.0, t: "noteOn", v: 1},
	{c: 0, e: 250, n: 84, noteEndTime: 1.0, t: "noteOn", v: 1},
	{c: 0, e: 250, n: 89, noteEndTime: 1.0, t: "noteOn", v: 1},
	{c: 0, e: 250, n: 91, noteEndTime: 1.0, t: "noteOn", v: 1}
]; 

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

		$scope.memes = ["harlem", "nyan", "happy", "gangnam", "fox", "friday", "daft"]; 
		$scope.memeIndex = 0; 	

		wsserver.connect(appConfig.wsURL);

		wsserver.on('config', function(args) {

			if ($scope.guiControllers.length == 0) {

				// Config Variables from Server
				$scope.guiVariables = args;

				$scope.guiControllers.push(gui.add($scope.guiVariables, 'decayRate', .000125, .020));
				$scope.guiControllers.push(gui.add($scope.guiVariables, 'addRate', 0.001, 0.100));

				_.forEach($scope.guiControllers, function(controller){
					controller.onFinishChange(function(value){
						$scope.$apply(); 
					});
				}); 

				// Local Configuration Variables 
				$scope.guiVariables.gain = 0.50;
				$scope.guiVariables.tempo = 60; 

				var gainController = gui.add($scope.guiVariables, 'gain', 0.0, 1.0);
				var tempoController = gui.add($scope.guiVariables, 'tempo', 40, 130); 

				// This mode gives each touch strip control over a note. Columns are given different instruments.   
				$scope.guiVariables.setDirect = function() {

					// Give a little percussion to this mode...
					// audioEngine.loadBeatPatterns();
					// audioEngine.dispatch("percussion_volume", {instrument: "a", intensity: 0.5}); 
					// audioEngine.dispatch("percussion_volume", {instrument: "b", intensity: 0.20}); 
					// audioEngine.dispatch("percussion_volume", {instrument: "c", intensity: 0.33}); 

					// Set probabilities to 1.0 for all the instruments so the controller
					// doesn't filter some of them out
					audioEngine.dispatch("intensity", {instrument: "musicbox", intensity: 1.0}); 
					audioEngine.dispatch("intensity", {instrument: "cello_pluck", intensity: 1.0}); 
					audioEngine.dispatch("intensity", {instrument: "vibraphone", intensity: 1.0}); 
					audioEngine.dispatch("intensity", {instrument: "syntklocka_stab_plink", intensity: 1.0}); 
					audioEngine.dispatch("intensity", {instrument: "rhodes_noize", intensity: 1.0}); 
					audioEngine.dispatch("intensity", {instrument: "synth_appointed_piano", intensity: 1.0}); 

					audioEngine.dispatch("delay_sync", {instrument: "delay", intensity: "4"}); 

					$scope.mode = "direct";

				};

				// This mode loads pre-defined MIDI files. Notes are played according to probabilities set
				// by an activity model of touches on the strips. The model sends data via the tick 
				// event to update the audio engine. 
				$scope.guiVariables.setModel = function() {
					audioEngine.loadPatterns();
					$scope.mode = "model"; 
				};

				var directController = gui.add($scope.guiVariables, 'setDirect'); 
				var modelController  = gui.add($scope.guiVariables, 'setModel'); 

				$scope.guiControllers.push(gainController);
				$scope.guiControllers.push(tempoController);

				gainController.onFinishChange(function(value){
					DMAF.masterVolume = value; 
					DMAF.context.master.gain.setTargetValueAtTime(DMAF.masterVolume, 0, 0.2);
				});

				tempoController.onFinishChange(function(value){
					audioEngine.dispatch("tempo", value);
				});

				// DEFAULT TO DIRECT MODE:
				$scope.guiVariables.setDirect(); 

			}

			if(!audioEngine.enabled){
				console.log("AudioEngine not active", audioEngine);
				return;
			}

			// Debug the audio engine objects: 
			// console.log("AudioBusManager", DMAF.Managers.getAudioBusManager());
			// console.log("MusicController", DMAF.Processors.getMusicController());
			// console.log("SynthManager", DMAF.Managers.getSynthManager());

			audioEngine.dispatch("musicOn");
			audioEngine.dispatch("tempo", $scope.guiVariables.tempo);

			audioEngine.setMemeCallback(function(){

				// Instrument Bus (pingping)
				var audioBusManager = DMAF.Managers.getAudioBusManager();
				audioBusManager.activeAudioBusInstances.pingping.output.gain.setTargetValueAtTime(1.0, 0, 0.01);

				wsserver.send({event: "meme-stop"});

				// Set Master (everyone)
				DMAF.context.master.gain.setTargetValueAtTime(0.50, 0, 0.0);

			}); 

			// Key-transpose everything
			setInterval(function(){
				audioEngine.dispatch("transpose");
			}, 6500);

		});
	
		wsserver.on('tick', function(args) {
			$scope.touchActivity = args; 
			$scope.meanOnsetDurations = parseInt(args.meanOnsetDuration, 10);
			$scope.groupActivity = args.groupActivity;
			$scope.serverAvailable = true; 
		}); 

		// DMX/panel colors 
		wsserver.on('colors', function(colorEvent) {
			$scope.colorModel = colorEvent.colorModel; 
		});

		// Audio events pending dispatch
		wsserver.on('audio', function(audioEvent) {
			var model = audioEvent.audioModel;
			if ($scope.mode == "model") dispatch(model); 
			else if (model.meme) {
				$scope.playMeme($scope.memes[$scope.memeIndex]); 
				$scope.memeIndex = ($scope.memeIndex + 1) % 7; 
			}
				
		}); 

		// Notes triggered in direct-control mode 
		wsserver.on('touch', function(args) {

			var touchEvent = args.touch;

			var pin = touchEvent.sensorPin; 

			if ($scope.mode == "direct") {

				if (touchEvent.group == 0) {
					// Column 1 (Lobby)
					audioEngine.dispatch("musicbox", musicboxNotes[pin]);
				} else if (touchEvent.group == 1) {
					// Column 2 (Tier 1, Bottom)
					audioEngine.dispatch("cello_pluck", celloNotes[pin]); 
				}  else if (touchEvent.group == 2) {
					// Column 3 (Tier 2)
					audioEngine.dispatch("rhodes_noize", rhodesNotes[pin]); 
				} else if (touchEvent.group == 3) {
					// Column 4 (Tier 3, Top)
					audioEngine.dispatch("syntklocka_stab_plink", plinkNotes[pin]); 
				}

			}
			
		}); 
		
		$scope.registerTouch = function(event, group) {
			wsserver.send({event: event, group: group, sensorPin: 3}); 
		}; 

		$scope.playMeme = function(memeName) {

			var audioBusManager = DMAF.Managers.getAudioBusManager();

			// Instruments -- turn off 
			audioBusManager.activeAudioBusInstances.pingping.output.gain.setTargetValueAtTime(0.0, 0, 0.01);

			DMAF.context.master.gain.setTargetValueAtTime(0.075, 0, 0.0);

			audioEngine.dispatch("scratch");

			console.log('Playing Meme: ', memeName);

			setTimeout(function() {

				DMAF.context.master.gain.setTargetValueAtTime(0.275, 0, 0.0);
				audioEngine.dispatch(memeName);
				wsserver.send({event: "meme-start"});

			}, 750);

		};

		$scope.$watch('guiVariables', function(newValue, oldValue) {

			if ($scope.serverAvailable)
				wsserver.send({event: "config", config: newValue});

		}, true);

		function dispatch(model) {

			if (model.wait) {
				audioEngine.dispatch(model.key, model.value); 
			}
			else if (model.instrument) {
				audioEngine.dispatch(model.key, {instrument: model.instrument, intensity: model.value}); 
			}
			else {
				audioEngine.dispatch(model.key); 
			}

		}; 

	}

]);