'use strict';

angular.module('bigUtil', []).run(["$rootScope", "$document", function ($rootScope, $document) {
	// remove 300ms click delay on touch devices
	FastClick.attach(document.body);

	// fix vh units in ios7 (and others)
	viewportUnitsBuggyfill.init();

	// mobile menu
	var $menu = $rootScope.$menu = {
		active: false,
		open: function open() {
			$menu.active = true;
		},
		close: function close() {
			$menu.active = false;
		},
		toggle: function toggle(e) {
			$menu.active = !$menu.active;
			if (e) e.stopPropagation();
		}
	};
	$document.on('click', function () {
		$rootScope.$apply($menu.close);
	});
	$document.on('keyup', function (e) {
		$rootScope.$apply(function () {
			if (e.keyCode === 27 /*esc*/) $menu.close();
		});
	});

	var $modal = $rootScope.$modal = {
		active: false,
		open: function open(id) {
			$modal.active = id;
		},
		close: function close() {
			$modal.active = false;
		},
		toggle: function toggle(id) {
			$modal.active = $modal.active === id ? false : id;
		},
		isOpen: function isOpen(id) {
			return $modal.active === id;
		}
	};
	// prevent scroll bubbling when modal open
	$rootScope.$watch('$modal.active', function (v) {
		angular.element(document.body).css({
			overflow: v ? 'hidden' : ''
		});
	});
	// allow Esc key to close modal
	$document.on('keyup', function (e) {
		$rootScope.$apply(function () {
			if (e.keyCode === 27 /*esc*/) $modal.close();
		});
	});
}]).filter('length', function () {
	return function (obj) {
		return angular.isArray(obj) ? obj.length : angular.isObject(obj) ? Object.keys(obj).filter(function (v) {
			return v[0] != '$';
		}).length : 0;
	};
}).filter('unique', function () {
	return function (array, key) {
		if (!array) return array;

		var o = {},
		    r = [];

		for (var i = 0; i < array.length; i++) {
			o[angular.isFunction(key) ? key(array[i]) : array[i][key]] = array[i];
		}
		for (var k in o) {
			r.push(o[k]);
		}
		return r;
	};
}).directive('bigClickToggle', ["$parse", function ($parse) {
	return {
		restrict: 'A',
		link: function link($scope, $element, $attrs) {
			var obj = $scope.$eval($attrs.bigClickToggle);
			$element.on('click', function (e) {
				e.preventDefault();

				$scope.$apply(function () {
					angular.forEach(obj, function (v, k) {
						return $parse(k).assign($scope, v);
					});
				});
			});
			angular.forEach(obj, function (v, k) {
				$scope.$watch(k, function (newV) {
					if (newV !== undefined) $element[v === newV ? 'addClass' : 'removeClass']($scope.$eval($attrs.bigClickToggleActive) || 'active');
				});
			});
		}
	};
}]);
'use strict';

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i]; return arr2; } else { return Array.from(arr); } }

angular.module('XXXXXX', ['ui.router', 'ui.router.title', 'bigUtil', 'firebaseHelper', 'ngHandsontable']).config(["$locationProvider", "$urlRouterProvider", "$urlMatcherFactoryProvider", "$stateProvider", "$firebaseHelperProvider", "$provide", function ($locationProvider, $urlRouterProvider, $urlMatcherFactoryProvider, $stateProvider, $firebaseHelperProvider, $provide) {
	// routing
	$locationProvider.html5Mode(true).hashPrefix('!');
	$urlRouterProvider.when('', '/');
	$urlRouterProvider.when('/home', '/');
	$urlRouterProvider.when(/^\/competitions\/[^\/]+$/, '$0/settings');
	$urlMatcherFactoryProvider.strictMode(false); // make trailing slashes optional

	// pages
	var pages = ['home', 'competitions'];
	$stateProvider.state('main', {
		abstract: true,
		templateUrl: 'views/main.html'
	}).state('page', {
		parent: 'main',
		url: '/{page:|' + pages.join('|') + '}',
		templateUrl: function templateUrl($stateParams) {
			return 'views/page/' + ($stateParams.page || 'home') + '.html';
		},
		resolve: {
			$title: ["$stateParams", function $title($stateParams) {
				switch ($stateParams.page) {
					case '':
					case 'home':
						return '';
					default:
						return $stateParams.page[0].toUpperCase() + $stateParams.page.slice(1);
				}
			}]
		}
	}).state('competition', {
		abtract: true,
		parent: 'page',
		url: '/:competitionId',
		templateUrl: 'views/page/competition.html',
		resolve: {
			Sections: ["$firebaseHelper", function Sections($firebaseHelper) {
				return $firebaseHelper.array('sections');
			}],
			Competition: ["$firebaseHelper", "$stateParams", function Competition($firebaseHelper, $stateParams) {
				return $firebaseHelper.object('competitions', $stateParams.competitionId);
			}],
			CompetitionData: ["$firebaseHelper", "$stateParams", function CompetitionData($firebaseHelper, $stateParams) {
				return $firebaseHelper.object('competitionsData', $stateParams.competitionId);
			}],
			$title: ["Competition", function $title(Competition) {
				return Competition.name;
			}]
		},
		controller: ["$scope", "Sections", "Competition", "CompetitionData", function controller($scope, Sections, Competition, CompetitionData) {
			$scope.sections = Sections;
			$scope.competition = Competition;
			$scope.competitionData = CompetitionData;
		}]
	}).state('competition.section', {
		url: '/:section',
		templateUrl: function templateUrl($stateParams) {
			var path = '';
			switch ($stateParams.section) {
				case 'settings':
					path = $stateParams.section;
					break;
				case 'groups':
				default:
					path = 'table';
					break;
			}
			return 'views/page/competition/' + path + '.html';
		},
		controller: ["$scope", "$stateParams", "$firebaseHelper", "Sections", "Competition", "CompetitionData", function controller($scope, $stateParams, $firebaseHelper, Sections, Competition, CompetitionData) {
			var section = $stateParams.section;

			var getAge = function getAge(date) {
				return date ? moment(Competition.date).diff(date, 'years') : undefined;
			};

			switch (section) {
				case 'settings':

					break;
				default:
					$scope.hot = $firebaseHelper.hotTable(CompetitionData, section);
					$firebaseHelper.load(Sections).then(function (sections) {
						var settings = angular.copy(angular.extend(sections.settings || {}, sections[section] || {}));

						switch (section) {
							case 'dances':
								$firebaseHelper.array(CompetitionData, 'levels').$loaded(function (levels) {
									angular.forEach(levels, function (level) {
										settings.columns.push({
											data: level.abbr,
											title: level.name,
											type: 'checkbox',
											uncheckedTemplate: ''
										});
									});
								});
								break;
							case 'groups':
								$firebaseHelper.array(CompetitionData, 'dancers').$loaded(function (dancers) {
									var ageLevels = {};
									angular.forEach(dancers, function (dancer) {
										var age = getAge(dancer.dob);
										ageLevels[age] = ageLevels[age] || {};
										ageLevels[age][dancer.level] = (ageLevels[age][dancer.level] || 0) + 1;
									});

									var data = [];
									angular.forEach(ageLevels, function (levels, age) {
										levels.age = age;
										data.push(levels);
									});

									var settings = {
										columns: [{
											data: 'age',
											title: 'Age',
											readOnly: true
										}]
									};
									$firebaseHelper.array(CompetitionData, 'levels').$loaded(function (levels) {
										angular.forEach(levels, function (level) {
											settings.columns.push({
												data: level.name,
												title: level.name,
												type: 'numeric',
												readOnly: true
											});
										});
									});
									$scope.helperHot = {
										data: data,
										settings: settings
									};
								});
								break;
						}
						angular.forEach(settings.columns, function (v, k) {
							if (v.type === 'age') {
								v.type = 'numeric';
								v.renderer = function (instance, td, row, col, prop, value, cellProperties) {
									var age = getAge(value);
									Handsontable.renderers.NumericRenderer(instance, td, row, col, prop, age, cellProperties);
									return td;
								};
							} else if (v.data === 'level') {
								$firebaseHelper.array(CompetitionData, 'levels').$loaded(function (levels) {
									var source = [];
									angular.forEach(levels, function (level) {
										return source.push(level.name);
									});
									v.source = source;
								});
							}
						});
						$scope.settings = settings;
					});
					break;
			}
		}]
	})
	// fallbacks
	.state('404', {
		parent: 'main',
		templateUrl: 'views/page/404.html'
	});
	$urlRouterProvider.otherwise(function ($injector, $location) {
		var $state = $injector.get('$state');
		$state.go('404', null, { location: false });
		return $location.path();
	});

	// data
	$firebaseHelperProvider.namespace('scotdance');
}]).controller('AppCtrl', ["$rootScope", "$scope", "$state", "$firebaseHelper", "$timeout", function ($rootScope, $scope, $state, $firebaseHelper, $timeout) {
	$rootScope.$state = $state;

	$firebaseHelper.hotTable = function hotTable() {
		var self = {
			ref: $firebaseHelper.ref.apply(this, arguments),
			parseData: function parse(snapshot) {
				$timeout(function () {
					var obj = snapshot.exportVal(),
					    arr = Object.keys(obj || {}).map(function (k) {
						var o = angular.copy(obj[k]);
						o.$id = k;
						return o;
					});

					self.original = angular.copy(arr);

					if (!self.revisions) {
						var _self$data;

						(_self$data = self.data).splice.apply(_self$data, [0, self.data.length].concat(_toConsumableArray(arr)));
					} else {
						console.info(self.revisions + ' revision' + (self.revisions === 1 ? ' has' : 's have') + ' been made to this reference since you last saved:', self.ref.path.toString());
					}
					self.revisions++;
				});
			},
			init: function init() {
				self.ref.orderByPriority().on('value', self.parseData);
			},
			refresh: function refresh() {
				self.revisions = 0;
				self.ref.orderByPriority().once('value', self.parseData);
			},
			save: function save() {
				var data = {};
				self.data.forEach(function (item) {
					var $id = item.$id || self.ref.push().key(),
					    o = angular.copy(item);

					delete o.$id;
					angular.forEach(o, function (v, k) {
						if (v === '' || k.match(/^[^\w\d_]/)) delete o[k];
					}); // clear empties (so they will be deleted from server)

					// @TODO: handle priority ?
					data[$id] = o;
				});
				console.log('saving', data);

				self.revisions = 0;
				self.ref.set(data, self.refresh);
			},
			dirty: function dirty() {
				if (!self.data || !self.original) return;

				var cleanedData = self.data.filter(function (item) {
					var found = false;
					angular.forEach(item, function (v) {
						return found = found || v;
					});
					return found; // @TODO: all props?
				});
				return !angular.equals(cleanedData, self.original);
			},
			revisions: 0,
			data: []
		};

		self.init();

		return self;
	};
}]).controller('CompetitionsCtrl', ["$scope", "$firebaseHelper", function ($scope, $firebaseHelper) {
	$scope.competitions = $firebaseHelper.array('competitions');
}]);