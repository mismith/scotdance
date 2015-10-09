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
			template: '<div class="big-slider-slides" style="display:-webkit-flex; display:-ms-flexbox; display:flex; -webkit-flex-direction:row; -ms-flex-direction:row; flex-direction: row; -webkit-transform: translate3d(0,0,0); -ms-transform: translate3d(0,0,0); transform: translate3d(0,0,0); transition: all 300ms ease-in-out;" ng-transclude></div>',
			link: function ($scope, $element, $attrs) {
				var width      = 0,
					numSlides  = 0,
					slideIndex = 0;
				
				// watch parent for sizing
				function getColumns() {
					return $scope.$eval($attrs.columns) || 1;
				}
				function getWidth () {
					return width = $element[0].parentNode.offsetWidth / getColumns();
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
				$scope.isVisible = function (index) {
					return index >= slideIndex && index < slideIndex + getColumns();
				};
				$scope.slide = function (index) {
					slideIndex = index % numSlides;
					if (slideIndex < 0) {
						slideIndex = numSlides - getColumns();
					} else if (index + getColumns() > numSlides) { // loop back around to beginning
						slideIndex = 0;
					}
					var transform = 'translate3d(' + -width * slideIndex + 'px,0,0)';
					$element.css({webkitTransform: transform, msTransform: transform, transform: transform});
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
			template: '<article class="big-slider-slide" ng-class="{visible: isVisible($index)}" ng-transclude></article>',
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