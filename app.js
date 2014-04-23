// Dependencies
var http = require('http');
var _ = require('underscore');
var util = require('./utilities');
var express = require('express')
var colors = require('colors'); 

// Protocols
var ws = require('ws');
var osc = require('node-osc');       

function Amplifier(options) {

	// Set up defaults if no options are provided
	this.options = options || {};

	console.log('[Amplifier Created]: '.magenta, this.options);

	this.options.ws = this.options.ws || {};
	this.options.ws.host = this.options.ws.host || '127.0.0.1';
	this.options.ws.port = this.options.ws.post || 4005;

	this.options.server = this.options.server || {};
	this.options.server.port = this.options.server.port || 6000;

	this.options.osc = this.options.osc || {};
	this.options.osc.inputPort = 9000;
	this.options.osc.outputPort = 10000;

	// Set up the two basic servers 
	this.setupWebserver(this.options.server);
	this.setupWebsocket(this.options.ws);

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

		ws.on('message', function(message, flags) {

			var newMessage = JSON.parse(message);

			//console.log("Mouse X: ".yellow, newMessage.mouseX);
			// console.log("Mouse Y: ".yellow, newMessage.mouseY);

			ws.send(JSON.stringify({message: "hello!"}));

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

Amplifier.prototype.setupWebserver = function(options) {

	var expressApp = express();
	expressApp.use(express.static(__dirname + '/admin'));
	expressApp.listen(options.port); 

	expressApp.get('/', function (req, res) {
		res.render('index.html'); 
	});

	console.log('[Web Interface - Listening]: '.magenta, options);

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