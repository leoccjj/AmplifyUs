// Dependencies
var http = require('http');
var _ = require('underscore');
var util = require('./utilities');
var express = require('express')
var colors = require('colors'); 
var path = require('path');
var moment = require('moment');

var ws = require('ws');
var osc = require('node-osc');  

var DMX = require('dmx')

var routes = require('./routes');   

var buf = require('CBuffer'); 

var RGBColor = require("./rgb_color");
var HSVColor = require("./hsv_color");

var WatchJS = require("watchjs")
var watch = WatchJS.watch;
var unwatch = WatchJS.unwatch; 

var chroma = require("chroma-js");

var touchStatistics = require("./touch_stats");
var audioModel = require("./audio_model");

var oz = require('oscillators');

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

var dmx = new DMX();

var universe = null;

moment().format();

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

var app = module.exports = express();

app.set('port', process.env.PORT || 6005);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
//app.use(express.logger('dev'));
//app.use(express.errorHandler()); // Dev/Debug Helper 
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.static(path.join(__dirname, 'client')));
app.use(app.router);

app.set('view options', {debug: true});
app.locals.pretty = true; // Express 3.x
app.locals.doctype = 'html'; // Express 3.x
app.locals.layout = false; // Cruft from Express 2.x

app.get('/', routes.index);
app.get('/partials/:name', routes.partials);

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

var universeMap = {}; 

var colorModel = new Array();

for (var i = 0; i < 4; i++) {
	colorModel[i] = new HSVColor(0,1,1); 	
}

// Cool to Warm
var activityHueInterpolator = chroma.interpolate.bezier(['#66c1ec', '#44e038', '#ff0000']);

var memeMode = false; 
var memeCooldown = false; 

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

var GalileoAddresses = ['192.168.1.101', '192.168.1.104', '192.168.1.102', '192.168.1.103']; 

var dmxLightMap = [1, 2, 3, 0];
var galileoPanelMap = [0, 2, 3, 1];

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

var tickTimer = null; 
var colorTimer = null; 

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

function Amplifier(options) {

	console.log("Client Directory:", path.join(__dirname, 'client'));

	// Set up defaults if no options are provided
	this.options = options || {};

	this.setupWebserver(); 

	this.options.ws = this.options.ws || {};
	this.options.ws.host = this.options.ws.host || '127.0.0.1';
	this.options.ws.port = this.options.ws.post || 4005;
	this.setupWebsocket(this.options.ws);

	this.options.osc = this.options.osc || {};
	this.options.osc.inputPort = 12000;
	this.options.osc.outputPort = 12001;
	this.setupOSC(this.options.osc);

	this.options.dmx = this.options.dmx || {};
	this.options.dmx.live = this.options.dmx.live || false; 
	this.options.dmx.numLights = 4; 
	this.options.dmx.channelsPerLight = 10; 
	this.options.dmx.universeSize = this.options.dmx.numLights * this.options.dmx.channelsPerLight; 
	this.setupDMX(this.options.dmx); 

	this.clientList = [];

}

Amplifier.prototype.handleTouches = function(touch) {

	var now = moment();

	if (touch.event == "touchdown") {

		var newTouchEvent = {}; 

		newTouchEvent.group = touch.group; 
		newTouchEvent.sensorPin = touch.sensorPin; 
		newTouchEvent.timestamp = moment().valueOf();

		touchStatistics.addEvent(newTouchEvent);
		touchStatistics.add(); 

		var logMessage = "Touch: " + touch.group + "\tTime: " + now.valueOf() + "\t Sensor: " + newTouchEvent.sensorPin ; 
		console.log(logMessage.green); 

		var ws = myAmplifier.clientList[0].connection;

		var eV = {
			touch: newTouchEvent,
		}; 

		ws.send(JSON.stringify({event: eV, name: "touch"}), function(error){
			if(error) console.error("Touch", error); 
		});

	}

	else if (touch.event == "touchup") {
		// Do nothing for now
	}

}; 

Amplifier.prototype.setupWebsocket = function(options) {

	var core = this;

	console.log('[Websocket - Listening]: '.green, options);

	this.wss = new ws.Server({
		port: options.port,
		host: options.host
	});

	this.wss.on('connection', function(ws) {

		var newClient = getClientAddress(ws); 

		core.clientList = [];

		clearInterval(tickTimer);
		clearInterval(colorTimer);

		console.log("[Websocket] // New Connection From: ".blue, newClient);

		core.clientList.push({addr: newClient, connection: ws});

		//console.log('Clients: ', core.clientList); 

		startTicking(); 	// Client control/notification
		startColorLoop();   // Main control loop

		// Send configuration data down to the client 
		ws.send(JSON.stringify({event: touchStatistics.parameters , name: "config"}), function(error){
			if(error) console.log("Config", error); 
		}); 

		ws.on('message', function(message, flags) {

			var newMessage = JSON.parse(message);

			console.log(newMessage);

			if (newMessage.event == "touchup" || newMessage.event == "touchdown") {
				myAmplifier.handleTouches(newMessage); 
			}

			else if (newMessage.event == "config") {
				touchStatistics.parameters = newMessage.config; 
				console.log("New Parameters: \n".yellow, touchStatistics.parameters)
			}

			else if (newMessage.event == "meme-stop") {

				console.log("MemeMode Has Ended!".green); 

				memeMode = false;
				memeCooldown = true;

				// Meme cooldown period 
				setTimeout(function() {
					memeCooldown = false; 
					console.log("MemeMode Ready Again!".yellow); 
				}, 30000); 

			}

			else if (newMessage.event == "meme-start") {

				console.log("MemeMode Has Started! ".red); 
				memeMode = true;

			}

		});

		ws.on('close', function() {

			// client.connection._socket._handle
			console.log("[Websocket Connection Closed]".red); 

		});

		ws.on('error', function(e) {
			console.error("[Websocket Error]: ".red, e);
		});

		function getClientAddress(connection) {

			if(!_.isUndefined(connection._socket)) {
				var addr = connection._socket._handle.getpeername().address;
				if (addr) return addr;
			} else {
				return ''; 
			}

		};

		// Loop to update the client 
		function startTicking() {

			var tick = {}; 

			tickTimer = setInterval(function() {

				// Add decay rate...
				tick.timestamp = moment().valueOf();

				tick.value = touchStatistics.decay();

				tick.meanOnsetDuration = touchStatistics.computeMeanInterOnsetDurations(); 
				tick.groupActivity = touchStatistics.computeGroupActivity(); 

				ws.send(JSON.stringify({event: tick, name: "tick"}), function(error){
					if(error) console.error("Tick", error); 
				});

				// The following only affects the client if the client is in the 'model' mode.
				// ... notes would be triggered based on a [0-1] probability. 
				audioModel.musicbox.value = util.map(touchStatistics.panelActivity[0], 0.0, 1.0, 0.0, 1.0);   
				audioModel.patatap_a.value = util.map(touchStatistics.panelActivity[0], 0.0, 1.0, 0.0, 1.0); 

				audioModel.plinkIntensity.value = util.map(touchStatistics.panelActivity[1], 0.0, 1.0, 0.0, 0.80); 
				audioModel.patatap_b.value = util.map(touchStatistics.panelActivity[1], 0.0, 1.0, 0.0, 1.0); 

				audioModel.rhodesIntensity.value  = util.map(touchStatistics.panelActivity[2], 0.0, 1.0, 0.0, 1.0); 
				audioModel.patatap_c.value  = util.map(touchStatistics.panelActivity[2], 0.0, 1.0, 0.0, 1.0); 

				audioModel.vibraphoneIntensity.value = util.map(touchStatistics.panelActivity[3], 0.0, 1.0, 0.0, 1.0); 
				
			}, 90); 
	
		}; 

		// Loop to actually handle control data / interpolations etc 
		function startColorLoop() {

			var dmxOptions = myAmplifier.options.dmx; 

			console.log(dmxOptions); 

			var counter = 0;
			var osc1, osc2, osc3, osc4; 

			// TODO: Tighten this loop as much as possible
			colorTimer = setInterval(function() {

				if (memeMode) {

					// http://localhost:6005/#/overview
					colorModel[0].H = quickColor(colorModel[0].H, util.random_float(0, 0.1));  
					colorModel[1].H = quickColor(colorModel[1].H, util.random_float(0, 0.1));  
					colorModel[2].H = quickColor(colorModel[2].H, util.random_float(0, 0.1));  
					colorModel[3].H = quickColor(colorModel[3].H, util.random_float(0, 0.1));  

					colorModel[0].S = 1.0;
					colorModel[1].S = 1.0;
					colorModel[2].S = 1.0;
					colorModel[3].S = 1.0;

					// Dark instead of light 
					colorModel[0].V = 1.0;
					colorModel[1].V = 1.0;
					colorModel[2].V = 1.0;
					colorModel[3].V = 1.0;

				} else {

					// make the lights oscillate a tiny bit in hue
					osc1 = oz.sine(counter, .7100) * 0.015; 
					osc2 = oz.sine(counter, .7300) * 0.015;
					osc3 = oz.sine(counter, .7600) * 0.015;
					osc4 = oz.sine(counter, .7900) * 0.015;

					// separate the hue a bit 
					var hueValues = [osc1, osc2 + .02 , osc3 + 0.04, osc4 + 0.06];

					colorModel[0].S = util.clamp(((touchStatistics.panelLastPins[0]) * 0.25) + .50, 0.33, 1.00); 
					colorModel[1].S = ((touchStatistics.panelLastPins[1]) * 0.25) + .25; 
					colorModel[2].S = ((touchStatistics.panelLastPins[2]) * 0.25) + .25; 
					colorModel[3].S = ((touchStatistics.panelLastPins[3]) * 0.25) + .25; 

					// Light
					colorModel[0].V = 1; 
					colorModel[1].V = 1;
					colorModel[2].V = 1; 
					colorModel[3].V = 1; 

					for (var i = 0; i < 4; i++){
						colorModel[i].H = util.clamp((activityHueInterpolator(touchStatistics.touchActivity).hsv()[0] / 360) + hueValues[i], 0.0, 1.0);
					}	

				}

				var breathe = util.map(Math.abs(oz.sine(counter, 2) * 255), 0, 255, 40, 120); 
				breathe = breathe.toFixed(0);
				breathe = breathe.toString();

				// Universe increments in groups of six because (that's how many channels the lights use (but, we only use the first three))
				var idx = 0;
				for (var i = 0; i < dmxOptions.universeSize; i += 10 ) {
					universeMap[i] = colorModel[dmxLightMap[idx]].toRgb().R * 255; 
					universeMap[i+1] = colorModel[dmxLightMap[idx]].toRgb().G * 255; 
					universeMap[i+2] = colorModel[dmxLightMap[idx]].toRgb().B * 255; 
					idx++;
				}

				for (var c = 0; c < myAmplifier.oscClients.length; c++) {

					var R = Math.floor(colorModel[c].toRgb().R * 255).toFixed(0); 
					var G = Math.floor(colorModel[c].toRgb().G * 255).toFixed(0); 
					var B = Math.floor(colorModel[c].toRgb().B * 255).toFixed(0); 

					// Grr!! Panel 3 has a swapped B and G wire!! 
					if (c == 3) {
						var tmp;
						tmp = B;
						B = G;
						G = tmp; 
					}

					// Breathe when no activity, otherwise send down the real color 
					if (touchStatistics.panelActivity[c] <= 0.0025 && !memeMode) {
						myAmplifier.oscClients[c].send("p|" + breathe + "|" + breathe + "|" + breathe);
					} else {
						myAmplifier.oscClients[c].send("p|" + R.toString() + "|" + G.toString() + "|" + B.toString());
					}

					// Black out the panel when in cooldown mode (won't trigger)
					if (memeCooldown) {
						myAmplifier.oscClients[c].send("c|0|0|0");
					} else if (memeMode) {
						myAmplifier.oscClients[c].send("c|" + R.toString() + "|" + G.toString() + "|" + B.toString());
					} else {
						// Indicate between panels that a connection should be made! 
						myAmplifier.oscClients[c].send("c|" + breathe + "|" + breathe + "|" + breathe);
					}

				}

				if (dmxOptions.live) universe.update(universeMap);

				var eV = {
					colorModel: [colorModel[0].toString(), colorModel[1].toString(), colorModel[2].toString(), colorModel[3].toString()]
				}; 

				ws.send(JSON.stringify({event: eV, name: "colors"}), function(error){
					if(error) console.error("Colors Error", error); 
				});
			
				counter += 0.01;

			}, 90);

			function easingMap(value, inputMin, inputMax, outputMin, outputMax) {

				var t = value - inputMin;
				var c = outputMax - outputMin;
				var d = inputMax - inputMin;
				var b = outputMin;

				return (t==d) ? b+c : c * (-Math.pow(2, -10 * t/d) + 1) + b;
			};

			function quickColor(value, toAdd) {

				var result = ((value * 100) + (toAdd * 100)) % 100;

				return parseFloat(result / 100, 10);

			};

		};

		// Watch the audio model for changes + send down to client 
		_.each(audioModel, function(item){

			watch(item, function(prop, action, newValue, oldValue) {

				WatchJS.noMore = true; 

				var eV = {
					audioModel: item
				}; 

				var	sender = myAmplifier.clientList[0].connection;

				sender.send(JSON.stringify({event: eV, name: "audio"}), function(error){
					if(error) console.error("Watch Audio", error); 
				});

			}); 

		});

	});

};

Amplifier.prototype.setupOSC = function(options) {

	var core = this;

	this.oscServer = {};
	this.oscClients = new Array();

	if (options.inputPort)
		this.oscServer = new osc.Server(options.inputPort, '0.0.0.0');
		console.log('[OSC - Listening]: '.green, options);

	if (options.outputPort) {

		_.each(GalileoAddresses, function(addr) {
			this.oscClients.push(new osc.Client(addr, options.outputPort));
		}, this); 

	}

	this.oscServer.on('message', function(msg, rinfo) {

		var newMessage = {};

		//console.log(msg, rinfo);

		if (msg[0] == "/column" && msg[2] == 1) {

			if (!memeCooldown && !memeMode) {

				var eV = {
					audioModel: {
						meme: true
					}
				}; 

				var ws = myAmplifier.clientList[0].connection;

				ws.send(JSON.stringify({event: eV, name: "audio"}), function(error){
					if(error) console.error("Audio/Meme", error); 
				});

				memeMode = true; 

			}

		} else {

			newMessage.group = galileoPanelMap[msg[1]];

			newMessage.sensorPin = msg[2]; 

			if (msg[3] == 1) {
				newMessage.event = "touchdown"; 
			} else {
				newMessage.event = "touchup"; 
			}

			myAmplifier.handleTouches(newMessage); 

		}

	});

}

Amplifier.prototype.setupWebserver = function() {

	http.createServer(app).listen(app.get('port'), function () {
		console.log( ('Amplifier App Listening on port ' + app.get('port')).green );
	});

}

Amplifier.prototype.setupDMX = function(options) {

	// name, driver, device id
	universe = (options.live == true) ? dmx.addUniverse('amplifier', 'enttec-usb-dmx-pro', 0) : dmx.addUniverse('amplifier', 'null', 0); 

	// Zero out the map (not that it really matters)
	for (var i = 0; i < options.universeSize; i++ ) {
		universeMap[i] = 0; 
	}

	console.log('[Amplifier DMX Universe Created]'.green);

}

var handleCLIArguments = function(){

	var argv = process.argv;

	if (argv.length == 2) {
		startProject({});
	}

	else {

		for (var i = 2; i < argv.length; i++){

			switch(argv[i]){

				case "--live":
					startProject({
						dmx: { live: true, }
					});
					break;
				default:
					startProject({});
					break;

			}
		}

	}

};

var myAmplifier = null; 

function startProject(options) {
	myAmplifier = new Amplifier(options); 
}

handleCLIArguments();