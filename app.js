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

var chroma = require("chroma-js");

var touchStatistics = require("./touch_stats");
var audioModel = require("./audio_model");

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

colorModel[0] = chroma(0, 0, 0, 'hsv');
colorModel[1] = chroma(0, 0, 0, 'hsv');
colorModel[2] = chroma(0, 0, 0, 'hsv');
colorModel[3] = chroma(0, 0, 0, 'hsv');

//PuBu, Purples, YlGnBu, OrRd, YlGnBu,

var colorScales = [
	chroma.scale('YlGnBu').out('hex'),
	chroma.scale('Purples').out('hex'),
	chroma.scale('PuBu').out('hex'), 
	chroma.scale('OrRd').out('hex')
]; 

var theScale = chroma.scale(['white', 'greenyellow', 'mediumblue', 'mediumpurple', 'lightyellow', 'orangered', 'darkred']).mode('hcl').out('hex');

var GalileoAddresses = ['192.168.1.105', '192.168.1.106', '192.168.1.107', '192.168.1.108']; 

var handConnectionEvents = new buf(2); 

var numTouchPanels = 4;
var numTouchStripsPerPanel = 5;

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

setInterval(function(){
	//audioModel.gain = Math.random(); 
	audioModel.transpose.value = true; 
	//audioModel.musicbox.value = 1.0; //Math.random();
}, 5000);

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

		// Handle Column Mappings ?? 
	
		// Check for hand connection event conditions (bridging panels 2 + 3 together)
		// ToDo: Debounce the detection event (set a flag+timer or something?)
		if ((newTouchEvent.group === 2 || newTouchEvent.group === 3) && newTouchEvent.sensorPin === 5) {
			
			handConnectionEvents.push(newTouchEvent);

			if (!handConnectionEvents.group[1].group) return; 

			// Different groups (2 or 3)
			if (handConnectionEvents[0].group !== handConnectionEvents.group[1]) {

				// Make sure related in time
				if (handConnectionEvents[1].timestamp - handConnectionEvents[1].timestamp <= 1000) {
					// Go crazy!! 
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

		// console.log('Clients', core.clientList); 

		startTicking(); 	// Client control/notification
		startColorLoop();   // Main control loop

		console.log(touchStatistics.parameters);

		ws.send(JSON.stringify({event: touchStatistics.parameters , name: "config"}), function(error){
			if(error) console.log(error); 
		}); 

		ws.on('message', function(message, flags) {

			var newMessage = JSON.parse(message);

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

				audioModel.musicbox.value = util.map(touchStatistics.panelActivity[0], 0.0, 1.0, 0.25, 1.0); 
				audioModel.celloIntensity.value = util.map(touchStatistics.panelActivity[0], 0.0, 1.0, 0.0, 1.0);  

				audioModel.plinkIntensity.value = util.map(touchStatistics.panelActivity[1], 0.0, 1.0, 0.025, 0.20); 
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

			// POSITION ON SCALE (0.50);

			//colorModel[0] = slowScale.mode('hsv')(0.30);
			//colorModel[1] = slowScale.mode('hsv')(0.45);
			//colorModel[2] = slowScale.mode('hsv')(0.65);
			//colorModel[3] = slowScale.mode('hsv')(0.85); 

			//console.log(chroma(colorModel[0]).hsv()); 

			//console.log("What", colorModel[0]);
			//console.log("Color Model", chroma(colorModel[0]).hex());

			var counter = 0;
			var sinPosition = 0; 
			var colorMode = 0; 
			var lastColorMode = 0; 
			var transition = 0; 

			// TODO: Tighten this loop as much as possible
			colorTimer = setInterval(function() {

				var idx = 0;
				counter++; 

				var p1 = touchStatistics.panelActivity[0];
				var p2 = touchStatistics.panelActivity[1];
				var p3 = touchStatistics.panelActivity[2];
				var p4 = touchStatistics.panelActivity[3];;

				colorMode = parseInt(util.map(touchStatistics.touchActivity, 0, 1, 0, 4), 10); 

				if (colorMode != lastColorMode) {

					lastColorMode = colorMode; 

				}

				//console.log(colorMode); 

				colorModel[0] = colorScales[colorMode].mode('hsv')(generateOffset(p1));
				colorModel[1] = colorScales[colorMode].mode('hsv')(generateOffset(p2));
				colorModel[2] = colorScales[colorMode].mode('hsv')(generateOffset(p3));
				colorModel[3] = colorScales[colorMode].mode('hsv')(generateOffset(p4)); 


				//colorModel[0] = theScale.mode('hsl')(generateOffset(p1));
				//colorModel[1] = theScale.mode('hsl')(generateOffset(p2));
				//colorModel[2] = theScale.mode('hsl')(generateOffset(p3));
				//colorModel[3] = theScale.mode('hsl')(generateOffset(p4)); 

				// console.log(colorModel);


				// console.log(chroma.hsv(colorModel[0]).rgb());

				// Universe increments in groups of six because
				// that's how many channels the lights use (we only use the first three)
				for (var i = 0; i < dmxOptions.universeSize; i += 6 ) {
					universeMap[i]   = chroma.hsv(colorModel[idx]).rgb()[0];
					universeMap[i+1] = chroma.hsv(colorModel[idx]).rgb()[1];
					universeMap[i+2] = chroma.hsv(colorModel[idx]).rgb()[2];
					idx++;
				}

				var eV = {
					colorModel: colorModel
				}; 

				ws.send(JSON.stringify({event: eV, name: "colors"}), function(error){
					if(error) console.error(error); 
				});

				// SEND DATA VIA DMX!!! Do not forget to uncomment
				// universe.update(universeMap); 

			}, 66);
		
			function generateOffset(value) {

				var result = (value * 100) % 100;

				var floatResult = parseFloat(result / 100, 10);

				return floatResult; 

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

		// Send to the entire subnet? 

		_.each(GalileoAddresses, function(addr) {
			this.oscClients.push(new osc.Client(addr, options.outputPort));
		}, this); 

		// this.oscClient = new osc.Client('224.0.0.0', options.outputPort);
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
