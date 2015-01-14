angular.module('XXXXXX', ['ui.router', 'ui.bootstrap', 'firebaseHelper'])
	
	.run(function(){
		FastClick.attach(document.body);
	})
	
	.config(function($locationProvider, $urlRouterProvider, $stateProvider, $firebaseHelperProvider){
		// routing
		$locationProvider.html5Mode(true);
		$urlRouterProvider.when('',  '/');
		$stateProvider  
			.state('main', {
				abstract: true,
				templateUrl: 'views/main.html',
			})
				.state('main.page', {
					url: '/:page',
					templateUrl: function($stateParams){
						return 'views/pages/' + ($stateParams.page || 'home') + '.html';
					},
				});
		
		// data
		$firebaseHelperProvider.namespace('demo');
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