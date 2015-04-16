angular.module('XXXXXX', ['ui.router', 'ui.bootstrap', 'firebaseHelper', 'contentful', 'hc.marked'])
	
	.run(function(){
		FastClick.attach(document.body);
	})
	
	.config(["$locationProvider", "$urlRouterProvider", "$stateProvider", "$firebaseHelperProvider", "contentfulProvider", function($locationProvider, $urlRouterProvider, $stateProvider, $firebaseHelperProvider, contentfulProvider){
		// routing
		$locationProvider.html5Mode(true);
		$urlRouterProvider.when('',  '/');
		$stateProvider  
			.state('main', {
				abstract: true,
				templateUrl: 'views/main.html',
			})
				.state('page', {
					parent: 'main',
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
	}])
	
	.controller('AppCtrl', ["$rootScope", "$state", function($rootScope, $state){
		$rootScope.$state = $state;
	}])
	.controller('HomePageCtrl', ["$scope", "$firebaseHelper", "contentful", function($scope, $firebaseHelper, contentful){
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
	}]);