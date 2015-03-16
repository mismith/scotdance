angular.module('XXXXXX', ['ui.router', 'ui.bootstrap', 'firebaseHelper', 'contentful'])
	
	.run(function(){
		FastClick.attach(document.body);
	})
	
	.config(function($locationProvider, $urlRouterProvider, $urlMatcherFactoryProvider, $stateProvider, $firebaseHelperProvider, contentfulProvider){
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