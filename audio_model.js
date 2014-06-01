var audioModel = {

	gain: {
		value: 0.25,
		key: "",
		instrument: ""
	},
	tempo: {
		value: 105, 
		key: "tempo",
		wait: true
	}, 
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
	mute: {
		value: false,
		key: "mute", 
	},
	transpose: {
		value: false,
		key: "transpose", 
	}, 
	delaySync: "8D"

};


module.exports = audioModel;
