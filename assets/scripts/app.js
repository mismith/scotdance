angular.module('XXXXXX', ['ui.router', 'ui.bootstrap', 'firebaseHelper', 'contentful', 'hc.marked'])
	
	.run(function(){
		FastClick.attach(document.body);
	})
	
	.config(function($locationProvider, $urlRouterProvider, $urlMatcherFactoryProvider, $stateProvider, $provide, $firebaseHelperProvider, contentfulProvider){
		// routing
		$locationProvider.html5Mode(true);
		$urlRouterProvider.when('',  '/');
		$urlMatcherFactoryProvider.strictMode(false); // make trailing slashes optional
		$stateProvider  
			.state('main', {
				abstract: true,
				templateUrl: 'views/main.html',
			})
				.state('main.page', {
					url: '/:page',
					templateUrl: function($stateParams){
						return 'views/page/' + ($stateParams.page || 'home') + '.html';
					},
				});
		/**
		* Extend the UI Router $stateProvider, adding the ability to specify an
		* anchor hash as a parameter in the ui-sref directive.
		*/
		$provide.decorator('$state', ['$delegate', function ($stateProvider) {
			// Save the orignal function for generating a state's URL.
			var $stateHref = $stateProvider.href;
			
			// Create our extended function.
			$stateProvider.href = function href(stateOrName, params, options) {
				var hash = '';
				params = params || {};
				var hashParam = params['#'];
				
				// Check if the anchor parameter was specified.
				if (typeof hashParam !== 'undefined') {
					// Ensure hash parameter is a string and not empty.
					if ((typeof hashParam === 'string' || hashParam instanceof String) && hashParam.length) {
						hash = '#' + hashParam;
					}
					
					delete params['#'];
				}
				
				// Return the original parsed URL with the hash appended.
				return $stateHref(stateOrName, params, options) + hash;
			};
			return $stateProvider;
		}]);
		
		// data
		$firebaseHelperProvider.namespace('demo');
		contentfulProvider.setOptions({
			accessToken: 'XXXXXX',
			space:       'XXXXXX',
		});
	})
	
	.controller('AppCtrl', function($rootScope, $state){
		$rootScope.$state = $state;
	})
	.controller('HomePageCtrl', function($scope, $firebaseHelper){
		$scope.angularWorking = 'Yes';
		
		$firebaseHelper.load('example').then(function(example){
			$scope.firebaseWorking = true;
		});
	});