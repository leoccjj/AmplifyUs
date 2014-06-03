var CircularBuffer = require('CBuffer'); 
var _ = require('underscore');

var touchBuffer = new CircularBuffer(48); 

// ToDo: Per Sensor Add/Decay

var touchStatistics = {

	parameters: {
		decayRate: .00125, 
		addRate: 0.0125,
		panelDecay: 0,
		panelAdd: 0, 
	}, 

	touchActivity: 0, 

	panelActivity: [0, 0, 0, 0], 

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

		var latestTouch = touchBuffer.last();
		var groupActivity = this.panelActivity[latestTouch.group]; 

		if ( (groupActivity + this.parameters.addRate) <= 1) {
			this.panelActivity[latestTouch.group] += this.parameters.addRate; 
		}

		if ( (this.touchActivity + this.parameters.addRate) <= 1) 
			this.touchActivity += this.parameters.addRate; 

		return this.touchActivity; 

	},

	decay: function() {

		// Decay if nonzero 
		if ( (this.touchActivity - this.parameters.decayRate) > 0) {
			this.touchActivity -= this.parameters.decayRate;
		}

		for (var i = 0; i < 4; i++) {

			var activity = this.panelActivity[i];

			if ( (activity - this.parameters.decayRate) > 0) {
				this.panelActivity[i] -= (this.parameters.decayRate);
				// this.panelActivity[i] = this.panelActivity[i].toFixed(6); 
			}

			// console.log(this.panelActivity[item.group]); 

		}; 

		// Start popping off touches if nothing
		if (this.touchActivity <= .01) {
			touchBuffer.shift();
		}

		//console.log(this.panelActivity);

		return this.touchActivity; 

	},

	addEvent: function(event) {
		touchBuffer.push(event); 
	}

}

module.exports = touchStatistics;