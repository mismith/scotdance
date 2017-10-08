angular.module('miUtil', [])
	.run(function ($rootScope, $document, $timeout) {
		// remove 300ms click delay on touch devices
		if (window.FastClick) FastClick.attach(document.body);

		// fix vh units in ios7 (and others)
		if (window.viewportUnitsBuggyfill) viewportUnitsBuggyfill.init();

		// menu
		var $menu = $rootScope.$menu = {
			active: false,
			open: function (e) {
				$menu.active = true;
				if (e) e.stopPropagation();
			},
			close: function (e) {
				$menu.active = false;
				if (e) e.stopPropagation();
			},
			toggle: function (e) {
				$menu.active = ! $menu.active;
				if (e) e.stopPropagation();
			},
		};
		// close the menu as soon as you click
		$document.on('click', function () {
			$timeout(function () {
				$menu.close()
			});
		});
		// allow Esc key to close menu
		$document.on('keyup', function (e) {
			if (e.keyCode === 27 /*esc*/) {
				$timeout(function () {
					$menu.close()
				});
			}
		});
		// prevent scroll bubbling when menu open
		$rootScope.miUtilPreventScrollOnMenuActive = true;
		$rootScope.$watch('$menu.active', function (v) {
			if ($rootScope.miUtilPreventScrollOnMenuActive) {
				angular.element(document.body).css({
					overflow: v ? 'hidden' : '',
				});
			}
		});

		// modal
		var $modal = $rootScope.$modal = {
			active: false,
			open: function (id) {
				$modal.active = id;
			},
			close: function () {
				$modal.active = false;
			},
			toggle: function (id) {
				if ($modal.active === id) {
					$modal.close();
				} else {
					$modal.open(id);
				}
			},
			isOpen: function (id) {
				return $modal.active === id;
			},
		};
		// allow Esc key to close modal
		$document.on('keyup', function (e) {
			if (e.keyCode === 27 /*esc*/) {
				$timeout(function () {
					$modal.close()
				});
			}
		});
		// prevent scroll bubbling when modal open
		$rootScope.$watch('$modal.active', function (v) {
			angular.element(document.body).css({
				overflow: v ? 'hidden' : '',
			});
			$rootScope.$broadcast('$modal.' + (v ? 'open' : 'close'));
		});
	})
	.filter('length', function (){
		return function (obj) {
			return angular.isArray(obj) ? obj.length : (angular.isObject(obj) ? Object.keys(obj).filter(function(v){ return v[0] != '$'; }).length : 0);
		};
	})
	.filter('unique', function () {
		return function (array, key){
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
	})

	.directive('miIcon', function () {
		return {
			scope: {svg: '@', size: '@'},
			restrict: 'E',
			replace: true,
			templateNamespace: 'svg',
			template: `<svg xmlns="http://www.w3.org/2000/svg" class="mi-icon" style="display: inline-block; width: {{ size || 16 }}px; height: {{ size || 16 }}px; fill: currentColor; vertical-align: middle;"><use xlink:href="" /></svg>`,
			link: function ($scope, $element, $attrs) {
				// manual scope override to avoid initial svg attr set issue/error
				$attrs.$observe('svg', function (svg){
					$element.children().attr('xlink:href', 'assets/icons.svg#' + svg);
				});
			}
		};
	})
	.directive('miModal', function () {
		return {
			scope: {id: '@'},
			restrict: 'E',
			replace: true,
			transclude: true,
			template: `<aside ng-show="$root.$modal.isOpen(id)" ng-click="$root.$modal.close()" class="mi-modal-container" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0;">
				<div class="mi-modal">
					<div ng-click="$event.stopPropagation()" class="mi-modal-content" ng-transclude></div>
					<a ng-click="$root.$modal.close()" class="mi-modal-close">
						<mi-icon svg="x"></mi-icon>
					</a>
				</div>
			</aside>`,
		};
	})
	.directive('miClickToggle', function ($timeout, $parse) {
		return {
			restrict: 'A',
			link: function ($scope, $element, $attrs) {
				let obj = $scope.$eval($attrs.miClickToggle);
				$element.on('click', function (e) {
					e.preventDefault();

					$timeout(function () {
						angular.forEach(obj, (v, k) => $parse(k).assign($scope, v));
					});
				});
				angular.forEach(obj, function (v, k) {
					$scope.$watch(k, function (newV) {
						if (newV !== undefined) $element[v === newV ? 'addClass' : 'removeClass']($scope.$eval($attrs.miClickToggleActive) || 'active');
					});
				});
			},
		};
	});
