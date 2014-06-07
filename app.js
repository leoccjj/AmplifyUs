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

var chroma = require("chroma-js");

var touchStatistics = require("./touch_stats");
var audioModel = require("./audio_model");

var oz = require('oscillators');

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

var dmx = new DMX();

var universe = null;

moment().format();

// [X] Last Touch Strip => Saturation
// [X] Column Activity => Value
// [] Impulse for touches => Activity Model
// [] Instant Touch Sound 
// [] Faster Loop for DMX

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

colorModel[0] = new HSVColor(0,1,1); 
colorModel[1] = new HSVColor(0,1,1); 
colorModel[2] = new HSVColor(0,1,1); 
colorModel[3] = new HSVColor(0,1,1); 

// Cool to Warm
var activityHueInterpolator = chroma.interpolate.bezier(['#66c1ec', '#44e038', '#ff5400']);

var GalileoAddresses = ['192.168.1.101', '192.168.1.102', '192.168.1.103', '192.168.1.104']; 

var handConnectionEvents = new buf(2); 

var memeMode = false; 
var memeCooldown = false; 

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

var tickTimer = null; 
var colorTimer = null; 
var modelControlTimer = null; 

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
	this.options.dmx.channelsPerLight = 6; 
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
			if(error) console.error(error); 
		});

		// Check for hand connection event conditions (bridging panels 2 + 3 together)
		if ((newTouchEvent.group === 2 || newTouchEvent.group === 3) && newTouchEvent.sensorPin === 5) {
			
			handConnectionEvents.push(newTouchEvent);

			if (!handConnectionEvents.group[1].group) return; 

			// Different groups (2 or 3)
			if (handConnectionEvents[0].group !== handConnectionEvents.group[1]) {

				// Make sure related in time
				if (handConnectionEvents[1].timestamp - handConnectionEvents[1].timestamp <= 1000) {
					
					if (!memeCooldown) {

						var eV = {
							audioModel: {
								meme: true
							}
						}; 

						ws.send(JSON.stringify({event: eV, name: "audio"}), function(error){
							if(error) console.error(error); 
						});

						memeMode = true; 

					}

				}

			}

		}

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
		clearInterval(modelControlTimer); 

		console.log("[Websocket] // New Connection From: ".blue, newClient);

		core.clientList.push({addr: newClient, connection: ws});

		//console.log('Clients: ', core.clientList); 

		startTicking(); 	// Client control/notification
		startColorLoop();   // Main control loop

		// Debugging only! 
		modelControlTimer = setInterval(function(){
			
			audioModel.transpose.value = true; 

		}, 9000);

		ws.send(JSON.stringify({event: touchStatistics.parameters , name: "config"}), function(error){
			if(error) console.log(error); 
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

				// Meme cooldown (1 minute)
				setTimeout(function() {
					memeCooldown = false; 
				}, 60000); 

			}

			else if (newMessage.event == "meme-start") {

				console.log("MemeMode Has Started! ".red); 

				memeMode = true;

			}

		});

		ws.on('close', function() {
			
			clearInterval(tickTimer);
			clearInterval(colorTimer);
			clearInterval(modelControlTimer);

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

		function updateTempo() {
			var newTempo = util.map(touchStatistics.touchActivity, 0.0, 1.0, 105, 125); 
			audioModel.tempo.value = newTempo;
		}; 

		var throttledTempo = _.throttle(updateTempo, 5000);

		// Loop to update the GUI
		function startTicking() {

			var tick = {}; 

			tickTimer = setInterval(function() {

				// Add decay rate...
				tick.timestamp = moment().valueOf();

				tick.value = touchStatistics.decay();

				tick.meanOnsetDuration = touchStatistics.computeMeanInterOnsetDurations(); 
				tick.groupActivity = touchStatistics.computeGroupActivity(); 

				ws.send(JSON.stringify({event: tick, name: "tick"}), function(error){
					if(error) console.error(error); 
				});

				audioModel.musicbox.value = util.map(touchStatistics.panelActivity[0], 0.0, 1.0, 0.0, 1.0); // move to 3 maybe? 
				// audioModel.celloIntensity.value = util.map(touchStatistics.panelActivity[0], 0.0, 1.0, 0.0, 1.0);  
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
			var colorMode = 0; 
			var p1, p2, p3, p4; 
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

					// make the installation breathe a little via hue
					osc1 = oz.sine(counter, .7100) * 0.009; 
					osc2 = oz.sine(counter, .7300) * 0.009;
					osc3 = oz.sine(counter, .7600) * 0.009;
					osc4 = oz.sine(counter, .7900) * 0.009;

					// separate the hue a bit 
					var osc = [osc1, osc2 + .04 , osc3 + 0.07, osc4 + 0.12];

					p1 = easingMap(touchStatistics.panelActivity[0], 0.0, 1.0, 0.0, 1.0);
					p2 = easingMap(touchStatistics.panelActivity[1], 0.0, 1.0, 0.0, 1.0);
					p3 = easingMap(touchStatistics.panelActivity[2], 0.0, 1.0, 0.0, 1.0);
					p4 = easingMap(touchStatistics.panelActivity[3], 0.0, 1.0, 0.0, 1.0);

					var t1 = util.map(touchStatistics.panelActivity[0], 0.0, 1.0, 1.0, 2.0);

					// Debug Panel Activity
					// console.log(touchStatistics.panelActivity);
					// ==========

					// Not used right now 
					colorMode = parseInt(util.map(touchStatistics.touchActivity, 0, 1, 0, 4), 10); 

					// Dimitri Test: 

					/*  
					colorModel[0].S = p1;
					colorModel[1].S = p2;
					colorModel[2].S = p3;
					colorModel[3].S = p4;

					// Dark instead of light 
					colorModel[0].V = p1;
					colorModel[1].V = p2;
					colorModel[2].V = p3;
					colorModel[3].V = p4;
					*/ 

					// Vicky Test: 

					colorModel[0].S = (touchStatistics.panelLastPins[0] + 1) * 0.25; 
					colorModel[1].S = (touchStatistics.panelLastPins[1] + 1) * 0.25; 
					colorModel[2].S = (touchStatistics.panelLastPins[2] + 1) * 0.25; 
					colorModel[3].S = (touchStatistics.panelLastPins[3] + 1) * 0.25; 

					// Light -- Change to .S for Darkness Map 
					colorModel[0].V = 1; // Panel Activity for decay, but use value range
					colorModel[1].V = 1;
					colorModel[2].V = 1;
					colorModel[3].V = 1;

					// console.log(colorModel); 

					for (var i = 0; i < 4; i++){
						colorModel[i].H = util.clamp((activityHueInterpolator(touchStatistics.touchActivity).hsv()[0] / 360) + osc[i], 0.0, 1.0);
					}		

				}

				var breathe = util.map(Math.abs(oz.sine(counter, 2) * 255), 0, 255, 40, 120); 
				breathe = breathe.toFixed(0);
				breathe = breathe.toString();

				// Universe increments in groups of six because (that's how many channels the lights use (but, we only use the first three))
				var idx = 0;
				for (var i = 0; i < dmxOptions.universeSize; i += 6 ) {
					universeMap[i] = colorModel[idx].toRgb().R * 255; 
					universeMap[i+1] = colorModel[idx].toRgb().G * 255; 
					universeMap[i+2] = colorModel[idx].toRgb().B * 255; 
					idx++;
				}

				for (var c = 0; c < myAmplifier.oscClients.length; c++) {

					var R = Math.floor(colorModel[c].toRgb().R * 255); 
					var G = Math.floor(colorModel[c].toRgb().G * 255); 
					var B = Math.floor(colorModel[c].toRgb().B * 255); 

					R.toFixed(0);
					G.toFixed(0);
					B.toFixed(0);

					if (touchStatistics.panelActivity[c] <= 0.075 && !memeMode) {
						myAmplifier.oscClients[c].send("p|" + breathe + "|" + breathe + "|" + breathe);
					} else {
						myAmplifier.oscClients[c].send("p|" + R.toString() + "|" + G.toString() + "|" + B.toString());

					}

					// Black when in cooldown mode (won't trigger)
					if (memeCooldown) {
						myAmplifier.oscClients[c].send("c|0|0|0");
					} else {
						// gesture between panels that a connection should be made! 
						myAmplifier.oscClients[c].send("c|" + breathe + "|" + breathe + "|" + breathe);
						// myAmplifier.oscClients[c].send("c|" + 255 - breathe + "|" + 255 - breathe + "|" + 255 - breathe);
					}

				}

				if (dmxOptions.live) universe.update(universeMap);

				// console.log(colorModel);

				var eV = {
					colorModel: [colorModel[0].toString(), colorModel[1].toString(), colorModel[2].toString(), colorModel[3].toString()]
				}; 

				ws.send(JSON.stringify({event: eV, name: "colors"}), function(error){
					if(error) console.error(error); 
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

		_.each(audioModel, function(item){

			watch(item, function(prop, action, newValue, oldValue) {

				WatchJS.noMore = true; 

				var eV = {
					audioModel: item
				}; 

				ws.send(JSON.stringify({event: eV, name: "audio"}), function(error){
					if(error) console.error(error); 
				});

				if (item.key === "transpose") {
					item.value = false; 
				} 
			
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


		newMessage.group = msg[1];
		newMessage.sensorPin = msg[2]; 

		if (msg[3] == 1) {
			newMessage.event = "touchdown"; 
		} else {
			newMessage.event = "touchup"; 
		}

		//console.log(msg, rinfo);
		//console.log(newMessage);

		myAmplifier.handleTouches(newMessage); 

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
