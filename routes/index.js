exports.index = function(req, res){
	res.render('index');
};

exports.partials = function (req, res) {
	var name = req.params.name;
	//console.log('\u001b[35m' + 'Rendering Partial: ' + name + '\u001b[0m');
	res.render('partials/' + name);
};