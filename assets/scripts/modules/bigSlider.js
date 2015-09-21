angular.module('bigSlider', [])
	.directive('bigSlider', function ($window) {
		return {
			restrict: 'E',
			replace: true,
			transclude: true,
			template: '<div class="big-slider" style="overflow: hidden;" ng-transclude></div>',
		};
	})
	.directive('bigSliderSlides', function ($window) {
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
	})
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