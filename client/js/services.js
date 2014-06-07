'use strict';

var app = angular.module('myApp');

app.factory('wsserver', ['$rootScope', function($rootScope) {

	// Used in log statements, should match the module name
	var name = 'wsserver';

	// wait this long between attempts to connect with server
	var reconnect_attempts_period = 2000;

	// Callback Functions
	// for certain "events" you can assign exactly one callback function. they
	// are not real events; the strings just describe the situation in which
	// that callback function will be done
	var callbacks = {
		'websocket-opened': function() {}, // no args
		'update': function() {},
		'websocket-closed': function() {}, // no args
		'tick': function () {}, 
		'config': function () {}, 
		'colors': function() {},
		'audio': function() {}, 
	};

	var on = function(e, f) { // assign callback functions
		if (!_.has(callbacks, e)) {
			throw name + ".on: " + e + " is not a valid callback type. You can assign exactly one callback for each of the types in " + JSON.stringify(_.keys(callbacks));
		} else {
			callbacks[e] = f;
		}
	};

	var do_callback = function(e, arg) {
		$rootScope.$apply(function() {
			callbacks[e](arg);
		});
	};

	// Maintaining Connection with Server

	var ws, url, protocol; // websocket, URL, protocol

	var connect = function(_url, _protocol) {
		url = _url;
		protocol = _protocol;
		try {
			if (!protocol) {
				ws = new WebSocket(url);
			} else {
				ws = new WebSocket(url, protocol);
			}
			ws.onopen = onopen;
			ws.onmessage = onmessage;
			ws.onclose = onclose;
		} catch(err) {
			console.log(err);
			reconnect('.connect failed with error', err);
		}
	};

	var reconnect = function(error_description) {
		console.log(name, error_description, 'Trying again in', reconnect_attempts_period, 'ms...');
		setTimeout(function() {
			connect(url, protocol);
		}, reconnect_attempts_period);
	};

	var onopen = function() {
		console.log(name, 'Websocket Opened');
		do_callback('websocket-opened');
	};

	var onclose = function() {
		// NOTE that if a "new WebSocket" call has valid parameters, but the
		// server is not running, that will trigger onclose and will not throw
		// an error
		do_callback('websocket-closed');
		reconnect('websocket closed');
	};

	var send = function(args) {
		ws.send(JSON.stringify(args));
	}; 

	// Processing Updates from Server
	var onmessage = function(newMessageFromServer) {

		// TODO put these back in for deployment
		var data = JSON.parse(newMessageFromServer.data);
		
		// console.log('websocket data', data);

		do_callback(data.name, data.event); 

	};

	return {
		on: on,
		connect: connect,
		send: send, 
	};

}]);
