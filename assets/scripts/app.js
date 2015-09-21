angular.module('XXXXXX', ['ui.router', 'firebaseHelper', 'contentful', 'hc.marked', 'bigUtil', 'bigScroll', 'bigSlider', 'bigWordpress'])
	
	.config(function($locationProvider, $urlRouterProvider, $urlMatcherFactoryProvider, $stateProvider, $firebaseHelperProvider, contentfulProvider){
		// routing
		$locationProvider.html5Mode(true);
		$urlRouterProvider.when('', '/');
		$urlRouterProvider.when('home', '/');
		$urlMatcherFactoryProvider.strictMode(false); // make trailing slashes optional
		
		// pages
		var pages = [
			'home'
		];
		$stateProvider
			.state('main', {
				abstract: true,
				templateUrl: 'views/main.html',
			})
				.state('page', {
					parent: 'main',
					url: '/{page:|' + pages.join('|') + '}',
					templateUrl: function($stateParams){
						return 'views/page/' + ($stateParams.page || 'home') + '.html';
					},
					resolve: {
						$title: function ($stateParams) {
							switch ($stateParams.page) {
								case '':
								case 'home':      return '';
								default:          return $stateParams.page[0].toUpperCase() + $stateParams.page.slice(1);
							}
						},
					},
				})
		// fallbacks
			.state('404', {
				parent: 'main',
				templateUrl: 'views/page/404.html',
			});
		$urlRouterProvider.otherwise(function ($injector, $location) {
			var $state = $injector.get('$state');
			$state.go('404', null, {location: false});
			return $location.path();
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
	.controller('HomePageCtrl', function($scope, $firebaseHelper, contentful){
		// angular
		$scope.angularWorking = 'Yes';
		
		// firebase
		$firebaseHelper.load('example').then(function(example){
			$scope.firebaseWorking = true;
		});
		
		// contentful
		contentful.entries('order=sys.createdAt').then(function(response){
			$scope.entries = response.data.items;
		});
	});