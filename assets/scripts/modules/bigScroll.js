angular.module('bigScroll', ['duScroll'])
	.provider('$scrollTo', function () {
		var headerOffset = undefined;
		this.setDefaultHeaderOffset = function (offset) {
			headerOffset = offset;
		};
		
		this.$get = ['$rootScope', '$location', '$anchorScroll', '$timeout', '$document', function ($rootScope, $location, $anchorScroll, $timeout, $document) {
			var $scrollTo = function (el, offset, delay) {
				if (angular.isString(el)) el = document.getElementById(el);
				return $document.scrollTo(el, offset === undefined ? (headerOffset === undefined ? document.getElementById('header').offsetHeight : headerOffset) : offset, delay === undefined ? 600 : delay);
			};
			
			var scrolled      = false,
				scrollRefresh = function (resetScrolled, delay) {
					if (scrolled) return;
					if (resetScrolled) scrolled = false;
					
					var hash = $location.hash();
					if (hash) {
						$timeout(function () {
							$scrollTo(hash, undefined, delay);
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
	.directive('img', function ($rootScope) {
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
	})
	.directive('a', function($location, $scrollTo){
		return {
			restrict: 'E',
			link: function($scope, $element, $attrs){
				$element.on('click', function(e){
					if($attrs.href && (($attrs.href[0] == '/' && $location.path() == $attrs.href.substring(0, $attrs.href.indexOf('#')) && $attrs.href.indexOf('#') >= 0) || $attrs.href[0] == '#')){
						var id = $attrs.href.substring($attrs.href.lastIndexOf('#') + 1);
						$scrollTo(id);
					}
				});
			},
		};	
	});