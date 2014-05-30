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
var DMXAnimation = DMX.Animation;

var routes = require('./routes');   

var buf = require('CBuffer'); 

var RGBColor = require("./rgb_color");
var HSVColor = require("./hsv_color");

var WatchJS = require("watchjs")
var watch = WatchJS.watch;
var unwatch = WatchJS.unwatch;
var callWatchers = WatchJS.callWatchers;

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

var dmx = new DMX();

// name, driver, device id
// enttec-usb-dmx-pro'
var universe = null;

moment().format();

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

var app = module.exports = express();

app.set('port', process.env.PORT || 6005);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.static(path.join(__dirname, 'client')));
app.use(app.router);

app.set('view options', {debug: true});
app.locals.pretty = true; // Express 3.x
app.locals.doctype = 'html'; // Express 3.x
app.locals.layout = false; // Cruft from Express 2.x
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(express.errorHandler()); // Dev/Debug Helper 

app.get('/', routes.index);
app.get('/partials/:name', routes.partials);

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

var universeMap = {}; 

var parameters = {
	decayRate: .0025, 
	addRate: 0.025,
};

var colorModel = new Array();

colorModel[0] = new HSVColor(0,0,0); 
colorModel[1] = new HSVColor(0,0,0); 
colorModel[2] = new HSVColor(0,0,0); 
colorModel[3] = new HSVColor(0,0,0); 

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

var audioModel = {
	gain: {
		value: 0.25,
		key: "",
		instrument: ""
	},
	tempo: 115, 
	celloIntensity: {
		value: 0.0,
		key: "intensity", 
		instrument: "cello_pluck"
	},
	plinkIntensity: {
		value: 0.0,
		key: "intensity", 
		instrument: "syntklocka_stab_plink"
	},
	musicbox: {
		value: 0.0,
		key: "intensity", 
		instrument: "musicbox"
	}, 
	vibraphoneIntensity: {
		value: 0.0,
		key: "intensity", 
		instrument: "vibraphone"
	}, 
	rhodesIntensity: {
		value: 0.0,
		key: "intensity", 
		instrument: "rhodes_noize"
	}, 
	synthPianoIntensity: {
		value: 0.0,
		key: "intensity", 
		instrument: "synth_appointed_piano"
	}, 
	patatap_a: {
		value: 0.0,
		key: "percussion_volume", 
		instrument: "a"
	}, 
	patatap_b: {
		value: 0.0,
		key: "percussion_volume", 
		instrument: "b"
	}, 
	patatap_c: {
		value: 0.0,
		key: "percussion_volume", 
		instrument: "c"
	}, 
	delayFeedback: {
		value: 0.0,
		key: "delay_feedback", 
		instrument: "delay"
	}, 
	delayWet: {
		value: 0.0,
		key: "delay_wet", 
		instrument: "delay"
	}, 
	delaySync: "8D",
	mute: false, 
	transpose: false, 
}; 

setInterval(function(){
	//audioModel.gain = Math.random(); 
	audioModel.transpose = true; 
	audioModel.musicbox.value = Math.random();
}, 5000);

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

var touchBuffer = new buf(48); 

var touchStatistics = {

	touchActivity: 0, 

	//  Inter-onset duration 
	computeMeanInterOnsetDurations: function() {

		var touchesInBuffer = 0; 
		var interOnsetDuration = 0; 

		var tMinusOne = 0; 

		touchBuffer.forEach(function(item) {

			if (tMinusOne !== 0) 
				interOnsetDuration += (item.timestamp - tMinusOne);

			tMinusOne = item.timestamp; 

			touchesInBuffer++; 

		}); 

		var meanInterOnsetDuration = interOnsetDuration / touchesInBuffer; 

		return meanInterOnsetDuration; 

	}, 

	computeGroupActivity: function() {

		var groupActivity = [0, 0, 0, 0]; 

		touchBuffer.forEach(function(item) {
			groupActivity[item.group] += 1;  
		}); 

		// Turn to %, hard-coded touch buffer size (48)
		groupActivity = _.map(groupActivity, function(group) {
			return parseInt((group / 48) * 100, 10); 
		}); 

		return groupActivity; 

	}, 

	add: function() {

		if ( (this.touchActivity + parameters.addRate) <= 1) 
			this.touchActivity += parameters.addRate; 

		return this.touchActivity; 

	},

	decay: function() {

		// Decay if nonzero 
		if ( (this.touchActivity - parameters.decayRate) > 0) {
			this.touchActivity -= parameters.decayRate;
		}

		// Start popping off touches if nothing
		if (this.touchActivity <= .01) {
			touchBuffer.shift();
		}

		return this.touchActivity; 

	}

}

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

	var tick = {}; 

	tick.eventType = touch.eventType; 
	tick.group = touch.group; 
	tick.sensorPin = touch.sensorPin; 

	tick.timestamp = moment().valueOf();

	touchBuffer.push(tick);

	touchStatistics.add(); 

	var logMessage = "Touch @ " + touch.group + " : " + now.valueOf(); 
	console.log(logMessage.yellow); 

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

		// console.log('Clients', core.clientList); 

		startTicking(); 	// Client control/notification
		startColorLoop();   // Main control loop

		ws.send(JSON.stringify({event: parameters, name: "config"}), function(error){
			if(error) console.log(error); 
		}); 

		ws.on('message', function(message, flags) {

			var newMessage = JSON.parse(message);

			if (newMessage.event == "touchdown") {
				myAmplifier.handleTouches(newMessage); 
			}

			else if (newMessage.event == "config") {
				parameters = newMessage.config; 
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

			}, 125); 
	
		}; 

		// Loop to actually handle control data / interpolations etc 
		function startColorLoop() {

			var dmxOptions = myAmplifier.options.dmx; 

			console.log(dmxOptions); 

			colorModel[0].H = util.random_float_normalized(); 
			colorModel[1].H = util.random_float_normalized(); 
			colorModel[2].H = util.random_float_normalized(); 
			colorModel[3].H = util.random_float_normalized(); 

			colorModel[0].S = 1; 
			colorModel[1].S = 1;
			colorModel[2].S = 1;
			colorModel[3].S = 1;

			colorModel[0].V = 1; 
			colorModel[1].V = 1;
			colorModel[2].V = 1;
			colorModel[3].V = 1;

			var counter = 0;

			// TODO: Tighten this loop as much as possible
			colorTimer = setInterval(function() {

				var idx = 0;
				counter++; 

				// Universe increments in groups of six because
				// that's how many channels the lights use (we only use the first three)
				// * 255 to turn the normalized RGB value into DMX range 
				for (var i = 0; i < dmxOptions.universeSize; i += 6 ) {
					universeMap[i] = colorModel[idx].toRgb().R * 255; 
					universeMap[i+1] = colorModel[idx].toRgb().G * 255; 
					universeMap[i+2] = colorModel[idx].toRgb().B * 255; 
					//console.log(universeMap[i]);
					idx++;
				}

				var eV = {
					colorModel: colorModel
				}; 

				colorModel[0].H = quickColor(colorModel[0].H, util.random_float(0.0002, 0.0025)); 
				colorModel[1].H = quickColor(colorModel[1].H, util.random_float(0.0001, 0.00065)); 
				colorModel[2].H = quickColor(colorModel[2].H, util.random_float(0.0001, 0.0015)); 
				colorModel[3].H = quickColor(colorModel[3].H, util.random_float(0.0001, 0.0050)); 

				ws.send(JSON.stringify({event: eV, name: "colors"}), function(error){
					if(error) console.error(error); 
				});

				// SEND DATA VIA DMX!!! Do not forget to uncomment
				// universe.update(universeMap); 

			}, 66);
		

			function quickColor(value, toAdd) {

				var result = ((value * 100) + (toAdd * 100)) % 100;

				return parseFloat(result / 100, 10);

			}

		};

		_.each(audioModel, function(item){

			watch(item, function(prop, action, newValue, oldValue) {

				WatchJS.noMore = true; 

				// console.log(item, prop, action, newValue); 

				var eV = {
					audioModel: item
				}; 

				ws.send(JSON.stringify({event: eV, name: "audio"}), function(error){
					if(error) console.error(error); 
				});

				if (prop === "transpose") {
					audioModel.transpose = false; 
				} 
			
			}); 

		});

		/* 
		watch(audioModel, function(prop, action, newValue, oldValue, blah, bloo){

			WatchJS.noMore = true; 

			console.log(prop, action, newValue, blah, bloo); 

			var eV = {
				audioModel: audioModel.prop
			}; 

			ws.send(JSON.stringify({event: eV, name: "audio"}), function(error){
				if(error) console.error(error); 
			});

			if (prop === "transpose") {
				audioModel.transpose = false; 
			} 
			

		},1);
		*/ 


	});

};

Amplifier.prototype.setupOSC = function(options) {

	var core = this;

	this.oscServer = {};
	this.oscClient = {};

	if (options.inputPort)
		this.oscServer = new osc.Server(options.inputPort, '127.0.0.1');
		console.log('[OSC - Listening]: '.green, options);

	if (options.outputPort) {
		// Send to the entire subnet? 
		this.oscClient = new osc.Client('224.0.0.0', options.outputPort);
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
