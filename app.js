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

var routes = require('./routes');    

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

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

function Amplifier(options) {

	// Set up defaults if no options are provided
	this.options = options || {};

	console.log('[Amplifier Created]: '.magenta, this.options);

	this.options.ws = this.options.ws || {};
	this.options.ws.host = this.options.ws.host || '127.0.0.1';
	this.options.ws.port = this.options.ws.post || 4005;

	this.options.osc = this.options.osc || {};
	this.options.osc.inputPort = 9000;
	this.options.osc.outputPort = 10000;

	this.setupWebsocket(this.options.ws);
	this.setupWebserver(); 

	// Configure OSC if available
	if (this.options.osc) this.setupOSC(this.options.osc);

	this.clientList = [];

}

Amplifier.prototype.setupWebsocket = function(options) {

	var core = this;

	console.log('[Websocket - Listening]: '.magenta, options);

	this.wss = new ws.Server({
		port: options.port,
		host: options.host
	});

	this.wss.on('connection', function(ws) {

		var newClient = getClientAddress(ws); 

		console.log("[Websocket] // New Connection From: ".blue, newClient);

		core.clientList.push({addr: newClient, connection: ws});

		//console.log('Clients', core.clientList); 

		startTicking(); 

		ws.on('message', function(message, flags) {

			var newMessage = JSON.parse(message);

			if (newMessage.event == "touchdown" || newMessage.event == "touchup") {

				var now = moment();

				var logMessage = "Touch @ " + newMessage.group + " : " + now.valueOf(); 
				console.log(logMessage.yellow); 

				ws.send(JSON.stringify({message: "hello!"}));

			}

			// console.log("Mouse X: ".yellow, newMessage.mouseX);
			// console.log("Mouse Y: ".yellow, newMessage.mouseY);
			// ws.send(JSON.stringify({message: "hello!"}));

		});

		ws.on('close', function() {
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

		function startTicking() {

			var tick = {}; 

			setInterval(function() {
				tick.timestamp = moment().valueOf();
				tick.value = util.random_float_normalized(); 
				ws.send(JSON.stringify({event: tick, name: "tick"}), function(error){
					if(error) console.log(error); 
				});
			}, 1000); 
	

		}; 

	});

};

Amplifier.prototype.setupOSC = function(options) {

	var core = this;

	this.oscServer = {};
	this.oscClient = {};

	if (options.inputPort)
		this.oscServer = new osc.Server(options.inputPort, 'localhost');
		console.log('[OSC - Listening]: '.magenta, options);

	if (options.outputPort) {
		// Send to the entire subnet? 
		this.oscClient = new osc.Client('224.0.0.0', options.outputPort);
	}

	this.oscServer.on('oscmessage', function(msg, rinfo) {

		var arguments = [];

		if (msg.arguments) {
			for (var a = 0; a < msg.arguments.length; ++a) {
				arguments.push( msg.arguments[a].value ); 
			}
		}

	});

}; 

Amplifier.prototype.setupWebserver = function() {

	// What current directory are we in?
	console.log("Public Dir: ", path.join(__dirname, 'client'));

	http.createServer(app).listen(app.get('port'), function () {
		console.log('Amplifier App istening on port ' + app.get('port'));
	});

}

var handleCLIArguments = function(){

    var argv = process.argv;

    for(var i = 2; i < argv.length; i++){

        switch(argv[i]){

            case "--serial":
            	// enumerateSerialPorts(); 
                break;
            case "-s": 
            case "-start":
            	startProject(argv[++i]); 
                break;
        }
    }

};

function startProject() {

}

// Empty Config Object
var myAmplifier = new Amplifier(); 

handleCLIArguments();