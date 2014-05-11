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

		var groupActivity = [0, 0, 0, 0]

		touchBuffer.forEach(function(item) {
			groupActivity[item.group] += 1;  
		}); 

		// Turn to %
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
			
			console.log('Clearing Tick Timer: '.red)
			clearInterval(tickTimer);

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

			// 30 FPS-ish
			colorTimer = setInterval(function() {

				var idx = 0;

				for (var i = 0; i < dmxOptions.universeSize; i += 6 ) {
					universeMap[i] = colorModel[idx].toRgb().R;
					universeMap[i+1] = colorModel[idx].toRgb().G; 
					universeMap[i+2] = colorModel[idx].toRgb().B;
					idx++;
				}

				// universe.update(universeMap); 

				/* 
				if (touchStatistics.touchActivity < 0.25) {

					animationColors.initSlowActivity();

				}

				colorModel[0].H += quickColor( ((colorModel[0].H + 1) % 360) ); 

				var eV = {
					colors: [colorModel[0].toString()]
				}; 

				ws.send(JSON.stringify({event: eV, name: "colors"}), function(error){
					if(error) console.error(error); 
				});
				*/ 


			}, 33);

			function quickColor(degrees) {

				var twoPi = Math.PI * 2;

				var radians = degrees / 180 * Math.PI; 

				return (radians / twoPi); 

			}


		};

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

var animationColors = {

	state: null,

	initSlowActivity: function() {

		if(!this.checkState('slow')) return;

		// In Radians 
		colorModel[0] = HSVColor.fromAngle(240, 1, 1);

		colorModel[1] = new HSVColor(0.7277,0,0); 
		colorModel[2] = new HSVColor(0.7277,0.0,0); 
		colorModel[3] = new HSVColor(0.7277,0,0); 

		console.log(colorModel[0].toString()); 
		console.log(colorModel[1].toString()); 
		console.log(colorModel[2].toString()); 
		console.log(colorModel[3].toString()); 

	}, 

	initFastActivity: function() {

		if(!this.checkState('fast')) return;

		colorModel[0] = new HSVColor(0,0,0); 
		colorModel[1] = new HSVColor(0,0,0); 
		colorModel[2] = new HSVColor(0,0,0); 
		colorModel[3] = new HSVColor(0,0,0); 

	},

	checkState: function(state) {

		if (this.state !== state) {
			this.state = state; 
			return true; 
		} else {
			return false; 
		}

	}

};




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
						dmx: {
							live: true, 
						}
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