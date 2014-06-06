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
var frequency = 0.1;

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

colorModel[0] = new HSVColor(0,1,1); 
colorModel[1] = new HSVColor(0,1,1); 
colorModel[2] = new HSVColor(0,1,1); 
colorModel[3] = new HSVColor(0,1,1); 

var bezInterpolator = chroma.interpolate.bezier(['#66c1ec', '#44e038', '#c638e0', '#ff5400']);

var GalileoAddresses = ['192.168.1.101', '192.168.1.102', '192.168.1.103', '192.168.1.104']; 

var handConnectionEvents = new buf(2); 

var memeMode = false; 
var memeCooldown = false; 

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
	this.options.osc.inputPort = 9000;
	this.options.osc.outputPort = 10000;
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

		newTouchEvent.eventType = touch.eventType; 
		newTouchEvent.group = touch.group; 
		newTouchEvent.sensorPin = touch.sensorPin || -1; 

		newTouchEvent.timestamp = moment().valueOf();

		touchStatistics.addEvent(newTouchEvent);

		touchStatistics.add(); 

		var logMessage = "Touch: " + touch.group + "\tTime: " + now.valueOf() + "\t Sensor: " + newTouchEvent.sensorPin ; 
		console.log(logMessage.green); 

		// Check for hand connection event conditions (bridging panels 2 + 3 together)
		if ((newTouchEvent.group === 2 || newTouchEvent.group === 3) && newTouchEvent.sensorPin === 5) {
			
			handConnectionEvents.push(newTouchEvent);

			if (!handConnectionEvents.group[1].group) return; 

			// Different groups (2 or 3)
			if (handConnectionEvents[0].group !== handConnectionEvents.group[1]) {

				// Make sure related in time
				if (handConnectionEvents[1].timestamp - handConnectionEvents[1].timestamp <= 1000) {
					
					function activateMemeMode() {
						memeMode = true;
					}; 

					// Find way of setting meme mode length 
					var throttledMemeMode = _.throttle(activateMemeMode, 15000);

					throttledMemeMode(); 

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

		console.log("[Websocket] // New Connection From: ".blue, newClient);

		core.clientList.push({addr: newClient, connection: ws});

		console.log('Clients: ', core.clientList); 

		startTicking(); 	// Client control/notification
		startColorLoop();   // Main control loop

		// Debugging only! 
		setInterval(function(){
			audioModel.tempo.value = 115; 
			audioModel.delaySync = "4";
			audioModel.transpose.value = true; 
		}, 9000);

		console.log(touchStatistics.parameters);

		ws.send(JSON.stringify({event: touchStatistics.parameters , name: "config"}), function(error){
			if(error) console.log(error); 
		}); 

		ws.on('message', function(message, flags) {

			var newMessage = JSON.parse(message);

			console.log(message);

			if (newMessage.event == "touchup" || newMessage.event == "touchdown") {
				myAmplifier.handleTouches(newMessage); 
			}

			else if (newMessage.event == "config") {
				touchStatistics.parameters = newMessage.config; 
			}

		});

		ws.on('close', function() {
			
			clearInterval(tickTimer);
			clearInterval(colorTimer);

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

				audioModel.musicbox.value = util.map(touchStatistics.panelActivity[0], 0.0, 1.0, 0.050, 1.0); 
				audioModel.celloIntensity.value = util.map(touchStatistics.panelActivity[0], 0.0, 1.0, 0.0, 1.0);  

				audioModel.plinkIntensity.value = util.map(touchStatistics.panelActivity[1], 0.0, 1.0, 0.00, 0.20); 
				audioModel.patatap_b.value = util.map(touchStatistics.panelActivity[1], 0.0, 1.0, 0.0, 1.0); 

				audioModel.rhodesIntensity.value  = util.map(touchStatistics.panelActivity[2], 0.0, 1.0, 0.0, 1.0); 
				audioModel.patatap_c.value  = util.map(touchStatistics.panelActivity[2], 0.0, 1.0, 0.0, 1.0); 

				audioModel.patatap_a.value = util.map(touchStatistics.panelActivity[3], 0.0, 1.0, 0.0, 1.0); 
				audioModel.vibraphoneIntensity.value = util.map(touchStatistics.panelActivity[3], 0.0, 1.0, 0.0, 1.0); 

				if (touchStatistics.touchActivity >= .80) {
					audioModel.delaySync = "4";
				} else {
					audioModel.delaySync = "8D"; 
				}

				// throttledTempo(); 
				
			}, 125); 
	
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

					// ToDo

				} else {

					// make the installation breathe a little via hue
					osc1 = oz.sine(counter, .7100) * 0.033; 
					osc2 = oz.sine(counter, .7300) * 0.033;
					osc3 = oz.sine(counter, .7600) * 0.033;
					osc4 = oz.sine(counter, .7900) * 0.033;

					// separate the hue a bit 
					var osc = [osc1, osc2 + .04 , osc3 + 0.07, osc4 + 0.12];

					p1 = easingMap(touchStatistics.panelActivity[0], 0.0, 1.0, 0.175, 1.0);
					p2 = easingMap(touchStatistics.panelActivity[1], 0.0, 1.0, 0.175, 1.0);
					p3 = easingMap(touchStatistics.panelActivity[2], 0.0, 1.0, 0.175, 1.0);
					p4 = easingMap(touchStatistics.panelActivity[3], 0.0, 1.0, 0.175, 1.0);

					var t1 = util.map(touchStatistics.panelActivity[0], 0.0, 1.0, 1.0, 2.0);

					// Not used right now 
					colorMode = parseInt(util.map(touchStatistics.touchActivity, 0, 1, 0, 4), 10); 

					colorModel[0].S = p1;
					colorModel[1].S = p2;
					colorModel[2].S = p3;
					colorModel[3].S = p4;

					// colorModel[0].V = p1;

					for (var i = 0; i < 4; i++){
						colorModel[i].H = util.clamp((bezInterpolator(touchStatistics.touchActivity).hsv()[0] / 360) + osc[i], 0.0, 1.0);
					}		

				}

				// Universe increments in groups of six because (that's how many channels the lights use (but, we only use the first three))
				var idx = 0;
				for (var i = 0; i < dmxOptions.universeSize; i += 6 ) {
					universeMap[i] = colorModel[idx].toRgb().R * 255; 
					universeMap[i+1] = colorModel[idx].toRgb().G * 255; 
					universeMap[i+2] = colorModel[idx].toRgb().B * 255; 
					idx++;
				}

				for (var c = 0; c < myAmplifier.oscClients.length; c++) {

					var R = colorModel[c].toRgb().R * 255; 
					var G = colorModel[c].toRgb().G * 255; 
					var B = colorModel[c].toRgb().B * 255; 

					myAmplifier.oscClients[c].send("p|" + R.toString() + "|" + G.toString() + "|" + B.toString());

					// Black when in cooldown mode (won't trigger)
					if (memeCooldown) {
						myAmplifier.oscClients[c].send("c|0|0|0");
					} else {
						// gesture between panels that a connection should be made! 
						var breathe = Math.abs(Math.sin(counter)) * 255; 
						myAmplifier.oscClients[c].send("c|" + breathe + "|" + breathe + "|" + breathe);
						// myAmplifier.oscClients[c].send("c|" + 255 - breathe + "|" + 255 - breathe + "|" + 255 - breathe);
					}

				}

				// console.log(colorModel);

				if (dmxOptions.live) universe.update(universeMap);

				// Turn off when finished debugging 
				if (true) {

					var eV = {
						colorModel: [colorModel[0].toString(), colorModel[1].toString(), colorModel[2].toString(), colorModel[3].toString()]
					}; 

					ws.send(JSON.stringify({event: eV, name: "colors"}), function(error){
						if(error) console.error(error); 
					});
				
				}

				counter = incrementCounter(counter); 

			}, 32);

			function incrementCounter(value) {
				return value += 0.01; 
			};

			function easingMap(value, inputMin, inputMax, outputMin, outputMax) {

				var t = value - inputMin;
				var c = outputMax - outputMin;
				var d = inputMax - inputMin;
				var b = outputMin;

				return (t==d) ? b+c : c * (-Math.pow(2, -10 * t/d) + 1) + b;
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
		this.oscServer = new osc.Server(options.inputPort, '127.0.0.1');
		console.log('[OSC - Listening]: '.green, options);

	if (options.outputPort) {

		_.each(GalileoAddresses, function(addr) {
			this.oscClients.push(new osc.Client(addr, options.outputPort));
		}, this); 

	}

	this.oscServer.on('message', function(msg, rinfo) {

		var newMessage = {};

		console.log(msg, rinfo);

		newMessage.eventType = msg[1]; 
		newMessage.group = msg[2]; 
		newMessage.sensorPin = msg[3]; 

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
