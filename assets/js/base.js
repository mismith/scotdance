angular.module('XXXXXX', ['ui.router', 'ui.bootstrap', 'duScroll', 'firebaseHelper', 'contentful', 'hc.marked'])
	
	.run(function(){
		FastClick.attach(document.body);
	})
	
	.config(["$locationProvider", "$urlRouterProvider", "$stateProvider", "$firebaseHelperProvider", "contentfulProvider", function($locationProvider, $urlRouterProvider, $stateProvider, $firebaseHelperProvider, contentfulProvider){
		// routing
		$locationProvider.html5Mode(true);
		$urlRouterProvider.when('',  '/');
		var pages = [
			'home'
		];
		$stateProvider
			// pages
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
				})
			// catch-all
			.state('otherwise', {
				url: '*path',
				templateUrl: 'views/page/404.html',
			});
		
		// data
		$firebaseHelperProvider.namespace('demo');
		contentfulProvider.setOptions({
			accessToken: 'XXXXXX',
			space:       'XXXXXX',
		});
	}])
	
	.controller('AppCtrl', ["$rootScope", "$state", "$document", "$location", function($rootScope, $state, $document, $location){
		$rootScope.$state = $state;
		
		// smooth scrolling
		$rootScope.scrollTo = function(id){
			var el = document.getElementById(id);
			if(el) $document.scrollToElementAnimated(el, document.getElementById('header').offsetHeight || 0);
		};
		$rootScope.scrollTo($location.path().replace(/^\//, ''));
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
	}])
	
	// smooth scrolling
	.directive('href', function(){
		return function($scope, $element, $attrs){
			if($attrs.href && $attrs.href[0] == '#'){
				$element.on('click', function(e){
					$scope.scrollTo(($attrs.href || '').replace(/^#/, ''));
				});
			}
		};
	});