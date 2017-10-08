'use strict';

angular.module('miUtil', []).run(["$rootScope", "$document", "$timeout", function ($rootScope, $document, $timeout) {
	// remove 300ms click delay on touch devices
	if (window.FastClick) FastClick.attach(document.body);

	// fix vh units in ios7 (and others)
	if (window.viewportUnitsBuggyfill) viewportUnitsBuggyfill.init();

	// menu
	var $menu = $rootScope.$menu = {
		active: false,
		open: function open(e) {
			$menu.active = true;
			if (e) e.stopPropagation();
		},
		close: function close(e) {
			$menu.active = false;
			if (e) e.stopPropagation();
		},
		toggle: function toggle(e) {
			$menu.active = !$menu.active;
			if (e) e.stopPropagation();
		}
	};
	// close the menu as soon as you click
	$document.on('click', function () {
		$timeout(function () {
			$menu.close();
		});
	});
	// allow Esc key to close menu
	$document.on('keyup', function (e) {
		if (e.keyCode === 27 /*esc*/) {
				$timeout(function () {
					$menu.close();
				});
			}
	});
	// prevent scroll bubbling when menu open
	$rootScope.miUtilPreventScrollOnMenuActive = true;
	$rootScope.$watch('$menu.active', function (v) {
		if ($rootScope.miUtilPreventScrollOnMenuActive) {
			angular.element(document.body).css({
				overflow: v ? 'hidden' : ''
			});
		}
	});

	// modal
	var $modal = $rootScope.$modal = {
		active: false,
		open: function open(id) {
			$modal.active = id;
		},
		close: function close() {
			$modal.active = false;
		},
		toggle: function toggle(id) {
			if ($modal.active === id) {
				$modal.close();
			} else {
				$modal.open(id);
			}
		},
		isOpen: function isOpen(id) {
			return $modal.active === id;
		}
	};
	// allow Esc key to close modal
	$document.on('keyup', function (e) {
		if (e.keyCode === 27 /*esc*/) {
				$timeout(function () {
					$modal.close();
				});
			}
	});
	// prevent scroll bubbling when modal open
	$rootScope.$watch('$modal.active', function (v) {
		angular.element(document.body).css({
			overflow: v ? 'hidden' : ''
		});
		$rootScope.$broadcast('$modal.' + (v ? 'open' : 'close'));
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
}).directive('miIcon', function () {
	return {
		scope: { svg: '@', size: '@' },
		restrict: 'E',
		replace: true,
		templateNamespace: 'svg',
		template: '<svg xmlns="http://www.w3.org/2000/svg" class="mi-icon" style="display: inline-block; width: {{ size || 16 }}px; height: {{ size || 16 }}px; fill: currentColor; vertical-align: middle;"><use xlink:href="" /></svg>',
		link: function link($scope, $element, $attrs) {
			// manual scope override to avoid initial svg attr set issue/error
			$attrs.$observe('svg', function (svg) {
				$element.children().attr('xlink:href', 'assets/icons.svg#' + svg);
			});
		}
	};
}).directive('miModal', function () {
	return {
		scope: { id: '@' },
		restrict: 'E',
		replace: true,
		transclude: true,
		template: '<aside ng-show="$root.$modal.isOpen(id)" ng-click="$root.$modal.close()" class="mi-modal-container" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0;">\n\t\t\t\t<div class="mi-modal">\n\t\t\t\t\t<div ng-click="$event.stopPropagation()" class="mi-modal-content" ng-transclude></div>\n\t\t\t\t\t<a ng-click="$root.$modal.close()" class="mi-modal-close">\n\t\t\t\t\t\t<mi-icon svg="x"></mi-icon>\n\t\t\t\t\t</a>\n\t\t\t\t</div>\n\t\t\t</aside>'
	};
}).directive('miClickToggle', ["$timeout", "$parse", function ($timeout, $parse) {
	return {
		restrict: 'A',
		link: function link($scope, $element, $attrs) {
			var obj = $scope.$eval($attrs.miClickToggle);
			$element.on('click', function (e) {
				e.preventDefault();

				$timeout(function () {
					angular.forEach(obj, function (v, k) {
						return $parse(k).assign($scope, v);
					});
				});
			});
			angular.forEach(obj, function (v, k) {
				$scope.$watch(k, function (newV) {
					if (newV !== undefined) $element[v === newV ? 'addClass' : 'removeClass']($scope.$eval($attrs.miClickToggleActive) || 'active');
				});
			});
		}
	};
}]);
'use strict';

angular.module('XXXXXX', ['ui.router', 'ui.router.title', 'miUtil', 'firebaseHelper', 'ngHandsontable']).config(["$locationProvider", "$urlRouterProvider", "$urlMatcherFactoryProvider", "$stateProvider", "$firebaseHelperProvider", "$provide", function ($locationProvider, $urlRouterProvider, $urlMatcherFactoryProvider, $stateProvider, $firebaseHelperProvider, $provide) {
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
		controller: ["$scope", "$firebaseHelper", "Sections", "Competition", "CompetitionData", function controller($scope, $firebaseHelper, Sections, Competition, CompetitionData) {
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
				case 'groups':
				case 'schedule':
				case 'scores':
				case 'results':
					path = $stateParams.section;
					break;
				default:
					path = 'table';
					break;
			}
			return 'views/page/competition/' + path + '.html';
		},
		controller: ["$rootScope", "$scope", "$stateParams", "$firebaseHelper", "$filter", "Sections", "Competition", "CompetitionData", function controller($rootScope, $scope, $stateParams, $firebaseHelper, $filter, Sections, Competition, CompetitionData) {
			var section = $stateParams.section;
			var getAge = $rootScope.getAge = function (date) {
				return date ? moment(Competition.date).diff(date, 'years') : undefined;
			};
			var getGroupName = $rootScope.getGroupName = function (group) {
				return group.level + ' ' + group.min + '-' + group.max;
			};
			var getGroupDancers = function getGroupDancers(group) {
				var groupDancers = {};
				angular.forEach(CompetitionData.dancers, function (dancer, dancerId) {
					if (dancer.level !== group.level) return;

					var age = getAge(dancer.dob);
					if (parseInt(group.min) <= age && age <= parseInt(group.max)) {
						groupDancers[dancer.$id || dancerId] = dancer;
					}
				});
				return groupDancers;
			};
			var knapsack = function knapsack(numContainers, arrayOfObjects, key) {
				var containers = Array.from(new Array(numContainers), function () {
					return [];
				}),
				    containerCounts = Array.from(new Array(numContainers), function () {
					return 0;
				});

				arrayOfObjects = arrayOfObjects.sort(function (a, b) {
					return b[key] - a[key];
				}); // sort from highest to lowest

				var indexOfSmallestContainer = function indexOfSmallestContainer() {
					return containerCounts.indexOf(Math.min.apply(Math, containerCounts));
				};
				angular.forEach(arrayOfObjects, function (item) {
					var i = indexOfSmallestContainer();

					containers[i].push(item);
					containerCounts[i] += item[key] || 0;
				});

				return containers;
			};

			switch (section) {
				case 'settings':
					// @IGNORE
					break;
				case 'groups':
					$scope.levels = $firebaseHelper.array(CompetitionData, 'levels');
					$scope.dancers = $firebaseHelper.array(CompetitionData, 'dancers');

					$scope.byLevel = function (level) {
						return function (item) {
							return item.level === level.name;
						};
					};

					$scope.generateGroups = function (data, hot) {
						hot.data = [];
						$firebaseHelper.array(CompetitionData, 'levels').$loaded(function (levels) {
							angular.forEach(levels, function (level) {
								level.$counter = level.$counted = level.$min = level.$max = 0;

								angular.forEach(data, function (group, i) {
									level.$counter += group[level.name] || 0;
									if (!level.$min) level.$min = group.age;
									if (level.$counter >= 1 && level.$counted >= 1 || i >= data.length - 1) {
										level.$max = group.age;

										//console.log(level.name, level.$min, level.$max, level.$counter);
										if (hot && hot.data) {
											hot.data.push({
												level: level.name,
												min: level.$min,
												max: level.$max
											});
										}

										level.$counter = level.$counted = level.$min = level.$max = 0;
									} else {
										level.$counted++;
									}
								});
							});
						});
					};
					break;
				case 'schedule':
					$firebaseHelper.array(CompetitionData, 'dances').$loaded(function (dances) {
						$scope.dances = dances;

						$firebaseHelper.array(CompetitionData, 'groups').$loaded(function (groups) {
							angular.forEach(groups, function (group) {
								group.$dancersCount = Object.keys(getGroupDancers(group)).length;
							});

							$firebaseHelper.array(CompetitionData, 'platforms').$loaded(function (platforms) {
								$scope.platforms = platforms;

								angular.forEach(dances, function (dance) {
									dance.$groups = groups.filter(function (group) {
										return !!dance[group.level];
									});

									var counts = knapsack(platforms.length, dance.$groups, '$dancersCount');
									dance.$platforms = angular.copy(platforms);
									angular.forEach(dance.$platforms, function (platform, i) {
										platform.$groups = counts[i];
									});
								});
							});
						});
					});
					break;
				case 'scores':
				case 'results':
					$scope.getPlacesArray = _.memoize(function (group) {
						var places = [];
						for (var i = 0; i < Math.ceil($filter('length')(group.$dancers) / 2); i++) {
							var place = (i + 1).toString(),
							    suffix = 'th';
							switch (place[place.length - 1]) {
								case '1':
									suffix = 'st';
									break;
								case '2':
									suffix = 'nd';
									break;
								case '3':
									suffix = 'rd';
									break;
							}
							places.push(place + suffix);
						}
						return places;
					});
					$scope.scores = $firebaseHelper.array(CompetitionData, 'scores');
					$scope.scores.$loaded(function () {
						return $scope.scores.$$loaded = true;
					});
					// $scope.getDanceScores = function(scores, groupId, danceId) {
					// 	var danceScores = [];
					// 	if (scores && scores[groupId] && scores[groupId][danceId]) {
					// 		angular.forEach(scores[groupId][danceId], _.memoize((score, dancerId) => {
					// 			danceScores.push({
					// 				score,
					// 				dancerId,
					// 			});
					// 		}));
					// 	}
					// 	return danceScores;
					// };
					$scope.saveScore = function (groupId, danceId, dancerId, value) {
						$firebaseHelper.ref($scope.scores, groupId + ':' + danceId).update({
							dancerId: dancerId,
							value: value || null
						});
					};
					$firebaseHelper.array(CompetitionData, 'groups').$loaded().then(function (groups) {
						$scope.groups = groups;

						return $firebaseHelper.array(CompetitionData, 'dances').$loaded();
					}).then(function (dances) {
						angular.forEach($scope.groups, function (group) {
							group.$dancers = getGroupDancers(group);
							group.$dances = dances.filter(function (dance) {
								return !!dance[group.level];
							});

							// let data = [];
							// let settings = {
							// 	columns: [
							// 		{
							// 			data:    'number',
							// 			title:   '#',
							// 			readOnly: true,
							// 		}
							// 	],
							// };
							// angular.forEach(group.$dances, dance => {
							// 	settings.columns.push({
							// 		data: '$scores.' + dance.$id,
							// 		title: dance.name,
							// 	});
							// });
							// angular.forEach(group.$dancers, dancer => {
							// 	dancer.$scores = {};
							// 	data.push(dancer);
							// });
							// group.$hot = {
							// 	data,
							// 	settings,
							// };
						});
					});
					break;
				default:
					var hot = $scope.hot = $firebaseHelper.hot(CompetitionData, section);
					$firebaseHelper.load(Sections).then(function (sections) {
						hot.settings = angular.copy(angular.extend(sections.settings || {}, sections[section] || {}));

						switch (section) {
							case 'dances':
								$firebaseHelper.array(CompetitionData, 'levels').$loaded(function (levels) {
									angular.forEach(levels, function (level) {
										hot.settings.columns.push({
											data: level.name,
											title: level.name,
											type: 'checkbox',
											uncheckedTemplate: ''
										});
									});
								});
								break;
							case 'dancers':
								hot.settings.columns.push({
									data: 'dob',
									title: '(Age)',
									type: 'age',
									readOnly: true
								});
								break;
						}
						angular.forEach(hot.settings.columns, function (v, k) {
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

	$firebaseHelper.hot = function hot() {
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
						self.data = arr;
						if (angular.isFunction(self.callback)) self.callback(self.data);
					} else {
						//console.info(self.revisions + ' revision' + (self.revisions === 1 ? ' has' : 's have') + ' been made to this reference since you last saved:', self.ref.path.toString());
					}
					self.revisions++;
				});
			},
			callback: null,
			onData: function onData(callback) {
				self.callback = callback;
			},
			init: function init() {
				self.ref.orderByPriority().on('value', self.parseData);
			},
			reload: function reload() {
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
				//console.log('saving', data);

				self.revisions = 0;
				self.ref.set(data, self.reload);
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
}]).directive('input', function () {
	return {
		restrict: 'E',
		require: '?ngModel',
		link: function link(scope, element, attrs, ngModelCtrl) {
			switch (attrs.type) {
				// autoconvert string dates to Date objects for <input type="date"> in Angular 1.3
				case 'date':
					//format text going to user (model to view)
					ngModelCtrl.$formatters.push(function (v) {
						return new Date(moment(v).format());
					});

					//format text from the user (view to model)
					ngModelCtrl.$parsers.push(function (v) {
						return moment(new Date(v)).format();
					});
					break;
				// ensure numbers are not stored as string, and that any falsy values are treated as 0
				case 'number':
				case 'range':
					//format text going to user (model to view)
					ngModelCtrl.$formatters.push(function (v) {
						return v || 0;
					});

					//format text from the user (view to model)
					ngModelCtrl.$parsers.push(function (v) {
						return parseFloat(v) || 0;
					});
					break;
			}
		}
	};
}).filter('groupByAge', ["$rootScope", function ($rootScope) {
	return _.memoize(function (dancers) {
		var grouped = {};
		angular.forEach(dancers, function (dancer) {
			var age = $rootScope.getAge(dancer.dob);
			grouped[age] = grouped[age] || [];
			grouped[age].push(dancer);
		});
		return grouped;
	});
}]).filter('groupByGroup', function () {
	return _.memoize(function (dancersByAge) {
		var grouped = [],
		    extras = [];
		angular.forEach(dancersByAge, function (dancers) {
			if (!dancers) return;

			if (dancers.length >= 6) {
				if (extras.length) {
					dancers = dancers.concat(extras);
				}
				grouped.push(angular.copy(dancers));
			} else {
				extras = extras.concat(dancers);
				if (extras.length >= 6) {
					grouped.push(angular.copy(extras));
					extras = [];
				}
			}
		});
		if (extras.length) {
			if (grouped.length) {
				grouped[grouped.length - 1] = grouped[grouped.length - 1].concat(angular.copy(extras));
			} else {
				grouped.push(angular.copy(extras));
			}
			extras = [];
		}
		return grouped;
	});
});