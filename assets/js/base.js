angular.module('bigScroll', ['duScroll'])
	.provider('$scrollTo', function () {
		var headerOffset = undefined;
		this.setDefaultHeaderOffset = function (offset) {
			headerOffset = offset;
		};
		
		this.$get = ['$rootScope', '$location', '$anchorScroll', '$timeout', '$document', function ($rootScope, $location, $anchorScroll, $timeout, $document) {
			var $scrollTo = function (el, offset, delay) {
				return $document.scrollTo(el, offset === undefined ? (headerOffset === undefined ? document.getElementById('header').offsetHeight : headerOffset) : offset, delay === undefined ? 600 : delay);
			};
			
			var scrolled      = false,
				scrollRefresh = function (resetScrolled, delay) {
					if (scrolled) return;
					if (resetScrolled) scrolled = false;
					
					var hash = $location.hash();
					if (hash) {
						$timeout(function () {
							$scrollTo(document.getElementById(hash), undefined, delay);
						});
					} else {
						$scrollTo(null, 0, 0);
					}
				};
			$rootScope.$on('$viewContentLoaded', function () {
				scrolled = false;
				$document.one('mousewheel', function () {
					scrolled = true;
				});
				scrollRefresh(true);
			});
			$rootScope.$on('$stateChangeSuccess', function () {
				scrollRefresh(true);
			});
			$rootScope.$on('bigScrollRefresh', function () {
				scrollRefresh(undefined, 0);
			});
			
			return $scrollTo;
		}];
	})
	.directive('img', ["$rootScope", function ($rootScope) {
		return {
			restrict: 'E',
			link: function ($scope, $element, $attrs) {
				if ( ! $attrs.height) {
					$element[0].onload = function () {
						//console.log('img onload', $element[0].src);
						$rootScope.$emit('bigScrollRefresh');
					};
				}
			},
		};
	}])
	.directive('a', ["$location", "$scrollTo", function($location, $scrollTo){
		return {
			restrict: 'E',
			link: function($scope, $element, $attrs){
				$element.on('click', function(e){
					if($attrs.href && (($attrs.href[0] == '/' && $location.path() == $attrs.href.substring(0, $attrs.href.indexOf('#')) && $attrs.href.indexOf('#') >= 0) || $attrs.href[0] == '#')){
						e.preventDefault();
						
						var id = $attrs.href.substring($attrs.href.indexOf('#') + 1);
						$location.hash(id);
						
						$scrollTo(document.getElementById(id));
					}
				});
			},
		};	
	}]);
angular.module('bigSlider', [])
	.directive('bigSlider', ["$window", function ($window) {
		return {
			restrict: 'E',
			replace: true,
			transclude: true,
			template: '<div class="big-slider" style="overflow: hidden;" ng-transclude></div>',
		};
	}])
	.directive('bigSliderSlides', ["$window", function ($window) {
		return {
			restrict: 'E',
			replace: true,
			transclude: true,
			template: '<div class="big-slider-slides" style="display: flex; flex-direction: row; transform: translate3d(0,0,0); transition: transform 300ms ease-in-out;" ng-transclude></div>',
			link: function ($scope, $element, $attrs) {
				var width      = 0,
					numSlides  = 0,
					slideIndex = 0;
				
				// watch parent for sizing
				function getWidth () {
					return width = $element[0].parentNode.offsetWidth;
				}
				angular.element($window).bind('resize', function () {
					getWidth();
					setWidth();
				});
				getWidth();
				
				// watch for slides
				function setWidth (w) {
					w = w || width;
					$element.css({width: numSlides * w + 'px'}).children().css({width: w + 'px'});
				}
				$scope.$watch(function () {
					return $element.children().length;
				}, function (v) {
					numSlides = v;
					setWidth();
				});
				
				// helpers
				$scope.index = function () {
					return slideIndex;
				};
				$scope.slide = function (index) {
					slideIndex = index % numSlides;
					if (slideIndex < 0) slideIndex += numSlides;
					$element.css({transform: 'translate3d(' + (-width * slideIndex) + 'px,0,0)'});
				};
				$scope.next = function () {
					$scope.slide(slideIndex + 1);
				};
				$scope.prev = function () {
					$scope.slide(slideIndex - 1);
				};
			},
		};
	}])
	.directive('bigSliderSlide', function () {
		return {
			restrict: 'E',
			replace: true,
			transclude: true,
			template: '<article class="big-slider-slide" ng-transclude></article>',
		};
	})
	.directive('bigSliderNav', function () {
		return {
			restrict: 'E',
			replace: true,
			transclude: true,
			template: '<nav class="big-slider-nav" ng-transclude></nav>',
		};
	});
angular.module('bigUtil', [])
	.run(["$rootScope", "$document", function ($rootScope, $document) {
		// remove 300ms click delay on touch devices
		FastClick.attach(document.body);
		
		// fix vh units in ios7 (and others)
		viewportUnitsBuggyfill.init();
		
		// mobile menu
		var $menu = $rootScope.$menu = {
			active: false,
			open: function () {
				$menu.active = true;
			},
			close: function () {
				$menu.active = false;
			},
			toggle: function (e) {
				console.log('tog');
				$menu.active = ! $menu.active;
				if (e) e.stopPropagation();
			},
		};
		$document.on('click', function () {
			$menu.close();
		});
	}])
	.filter('length', function(){
		return function(obj) {
			return angular.isArray(obj) ? obj.length : (angular.isObject(obj) ? Object.keys(obj).filter(function(v){ return v[0] != '$'; }).length : 0);
		};
	})
	.filter('unique', function() {
		return function(array, key){
			if ( ! array) return array;
			
			var o = {},
				r = [];
			
			for(var i = 0; i < array.length; i++) {
				o[angular.isFunction(key) ? key(array[i]) : array[i][key]] = array[i];
			}
			for(var k in o) {
				r.push(o[k]);
			}
			return r;
		};
	});
angular.module('bigWordpress', [])
	.provider('$wp', function () {
		var basePath = '/wp/api/';
		this.setApiBase = function (path) {
			basePath = path;
		};
		
		this.$get = ['$http', '$q', function ($http, $q) {
			var self = this;
			
			// helpers
			self.proper_date = function (date) {
				return (date || '').replace(' ', 'T');
			};
			self.custom_field = function (post, field) {
				try {
					return post.custom_fields[field][0];
				} catch(e) {
					return undefined;
				}
			};
			self.thumbnail_image = function (post, size) {
				try {
					return post.thumbnail_images[size || 'full'].url;
				} catch(e) {
					try {
						return post.attachments[0].url;
					} catch(e) {
						return undefined;
					}
				}
			};
			
			// ajax
			self.api = function (method, params) {
				var deferred = $q.defer();
				
				$http.get(basePath + method, {params: params})
					.success(function (response) {
						if (response && response.status == 'ok') {
							deferred.resolve(response);
						} else {
							deferred.reject();
						}
					})
					.error(function () {
						deferred.reject();
					});
				
				return deferred.promise;
			};
			self.posts = function ($scope, params, method) {
				var page  = 1,
					count = 10;
					
				$scope.loading    = false;
				$scope.fetchedAll = false;
				$scope.fetchPosts = function (items) {
					if($scope.loading || $scope.fetchedAll) return; // only one request at a time
					
					$scope.loading = true;
					return self.api(method || 'get_category_posts', angular.extend({count: count, page: page}, params))
						.then(function (response) {
							angular.forEach(response.posts, function (post) {
								items.push(post);
							});
							
							if (page < response.pages) {
								page++;
							} else {
								$scope.fetchedAll = true;
							}
						})
						.catch(function (err) {
							$scope.fetchedAll = true;
							
							// @TODO: properly handle error
							console.error(err);
						})
						.finally(function () {
							$scope.loading = false;
						});
				};
			};
			
			// cache
			// N.B. does not cache pagination results!
			var cache = {};
			self.cache = function (path, set) {
				if (set) cache[path] = set;
				return cache[path];
			};
			
			return self;
		}]
	})
	.controller('WordpressCtrl', ["$rootScope", "$scope", "$wp", function ($rootScope, $scope, $wp) {
		$scope.posts = [];
		$scope.setCategory = function (categoryId, postType) {
			postType = postType || 'publication';
			
			// setup
			$wp.posts($scope, {id: categoryId, post_type: postType});
			
			// check if they are cached
			var path   = postType + '/' + categoryId,
				cached = $wp.cache(path);
			if (cached) return $scope.posts = cached;
			
			// otherwise, fetch and cache em
			$scope.fetchPosts($scope.posts).then(function () {
				//console.log('wp loaded');
				$rootScope.$emit('bigScrollRefresh');
				
				$wp.cache(path, $scope.posts);
			});
		};
		$scope.hasCategory = function(post, categoryId){
			var found = false;
			if(post && post.categories){
				angular.forEach(post.categories, function(category){
					if(found) return;
					if(category.id == categoryId) return found = true;
				})
			}
			return found;
		};
		
		$scope.proper_date     = $wp.proper_date;
		$scope.custom_field    = $wp.custom_field;
		$scope.thumbnail_image = $wp.thumbnail_image;
	}]);
angular.module('XXXXXX', ['ui.router', 'firebaseHelper', 'contentful', 'hc.marked', 'bigUtil', 'bigScroll', 'bigSlider', 'bigWordpress'])
	
	.config(["$locationProvider", "$urlRouterProvider", "$urlMatcherFactoryProvider", "$stateProvider", "$firebaseHelperProvider", "contentfulProvider", function($locationProvider, $urlRouterProvider, $urlMatcherFactoryProvider, $stateProvider, $firebaseHelperProvider, contentfulProvider){
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
						$title: ["$stateParams", function ($stateParams) {
							switch ($stateParams.page) {
								case '':
								case 'home':      return '';
								default:          return $stateParams.page[0].toUpperCase() + $stateParams.page.slice(1);
							}
						}],
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