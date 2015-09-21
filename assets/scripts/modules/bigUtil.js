angular.module('bigUtil', [])
	.run(function ($rootScope, $document) {
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
	})
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