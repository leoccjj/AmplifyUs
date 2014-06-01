var CircularBuffer = require('CBuffer'); 
var _ = require('underscore');

var touchBuffer = new CircularBuffer(48); 

var parameters = {
	decayRate: .00125, 
	addRate: 0.0125,
};

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

		// get last added event here! easy peasy.

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

	},

	addEvent: function(event) {
		touchBuffer.push(event); 
	}

}

module.exports = touchStatistics;