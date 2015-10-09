angular.module('bigUtil', [])
	.run(function ($rootScope, $document) {
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
				$menu.active = ! $menu.active;
				if (e) e.stopPropagation();
			},
		};
		$document.on('click', function () {
			$rootScope.$apply($menu.close);
		});
		$document.on('keyup', function (e) {
			$rootScope.$apply(() => {
				if (e.keyCode === 27 /*esc*/) $menu.close();
			});
		});
		
		var $modal = $rootScope.$modal = {
			active: false,
			open: function (id) {
				$modal.active = id;
			},
			close: function () {
				$modal.active = false;
			},
			toggle: function (id) {
				$modal.active = $modal.active === id ? false : id;
			},
			isOpen: function (id) {
				return $modal.active === id;
			},
		};
		// prevent scroll bubbling when modal open
		$rootScope.$watch('$modal.active', function (v) {
			angular.element(document.body).css({
				overflow: v ? 'hidden' : '',
			});
		});
		// allow Esc key to close modal
		$document.on('keyup', function (e) {
			$rootScope.$apply(() => {
				if (e.keyCode === 27 /*esc*/) $modal.close();
			});
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
	
	.directive('bigClickToggle', function ($parse) {
		return {
			restrict: 'A',
			link: function ($scope, $element, $attrs) {
				let obj = $scope.$eval($attrs.bigClickToggle);
				$element.on('click', function (e) {
					e.preventDefault();
					
					$scope.$apply(() => {
						angular.forEach(obj, (v, k) => $parse(k).assign($scope, v));
					});
				});
				angular.forEach(obj, function (v, k) {
					$scope.$watch(k, function (newV) {
						if (newV !== undefined) $element[v === newV ? 'addClass' : 'removeClass']($scope.$eval($attrs.bigClickToggleActive) || 'active');
					});
				});
			},
		};
	});