(function() {

	// http://stackoverflow.com/questions/12717897/using-ng-model-within-a-directive
	// http://umur.io/angularjs-directives-using-isolated-scope-with-attributes/

	var MODULE_NAME, SLIDER_TAG, sliderDirective;

	MODULE_NAME = 'ui.slider'; // include for app 

	SLIDER_TAG = 'slider'; // in templates

	// <slider config="{}"></slider>
	sliderDirective = function($compile) {

		return {

			restrict: 'E',
			//transclude: true, 
			// replace: true, 
			replace: false, 
			// text binding, @, one way &, two-way, =
			scope: {
				name: '@', 
				config: '@',
				lowValue: '=low',
				highValue: '=high'
			},

			templateUrl: 'views/slider.html', 

			link: function(scope, element, attributes) {

				var configObject = eval('(' + attributes.config + ')');

				var numHandles = configObject.handles; 
 
				var sliderSelector = $(element).find('div');

				if (numHandles == 1) {
					configObject.start = scope.lowValue || 0; 
				} else if (numHandles == 2) {
					configObject.start = [scope.lowValue, scope.highValue] || [configObject.range[0], configObject.range[1]]
				}

				configObject.slide = function() {

						if (numHandles == 1) {
							var value = parseInt(sliderSelector.val(), 10);
							scope.lowValue = value; 
							scope.$apply(); 
						} else if (numHandles == 2) {
							var lowValue = parseInt(sliderSelector.val()[0], 10);
							var highValue = parseInt(sliderSelector.val()[1], 10);
							scope.lowValue = lowValue; 
							scope.highValue = highValue;
							scope.$apply();  
						}

				}

				sliderSelector.noUiSlider(configObject); 

			}

		};

	};

	qualifiedDirectiveDefinition = ['$compile', sliderDirective];

	module = function(window, angular) {
		return angular.module(MODULE_NAME, []).directive(SLIDER_TAG, qualifiedDirectiveDefinition);
	};

	module(window, window.angular);

}).call(this);
