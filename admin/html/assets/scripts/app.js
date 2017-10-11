angular.module('XXXXXX', ['ui.router', 'ui.router.title', 'miUtil', 'firebaseHelper', 'ngHandsontable'])
	
	.config(function($locationProvider, $urlRouterProvider, $urlMatcherFactoryProvider, $stateProvider, $firebaseHelperProvider, $provide){
		// routing
		$locationProvider.html5Mode(true).hashPrefix('!');
		$urlRouterProvider.when('', '/');
		$urlRouterProvider.when('/home', '/');
		$urlRouterProvider.when(/^\/competitions\/[^\/]+$/, '$0/settings');
		$urlMatcherFactoryProvider.strictMode(false); // make trailing slashes optional
		
		// pages
		var pages = [
			'home',
			'competitions',
		];
		$stateProvider
			.state('main', {
				abstract: true,
				templateUrl: 'views/main.html',
			})
				.state('page', {
					parent: 'main',
					url: '/{page:|' + pages.join('|') + '}',
					templateUrl: $stateParams => 'views/page/' + ($stateParams.page || 'home') + '.html',
					resolve: {
						$title: function ($stateParams) {
							switch ($stateParams.page) {
								case '':
								case 'home': return '';
								default:     return $stateParams.page[0].toUpperCase() + $stateParams.page.slice(1);
							}
						},
					},
				})
				.state('competition', {
					abtract: true,
					parent: 'page',
					url: '/:competitionId',
					templateUrl: 'views/page/competition.html',
					resolve: {
						Sections:        ($firebaseHelper) => $firebaseHelper.array('sections'),
						Competition:     ($firebaseHelper, $stateParams) => $firebaseHelper.object('competitions', $stateParams.competitionId),
						CompetitionData: ($firebaseHelper, $stateParams) => $firebaseHelper.object('competitionsData', $stateParams.competitionId),
						$title:          (Competition) => Competition.name,
					},
					controller: function ($scope, $firebaseHelper, Sections, Competition, CompetitionData) {
						$scope.sections            = Sections;
						$scope.competition         = Competition;
						$scope.competitionData     = CompetitionData;
					}
				})
					.state('competition.section', {
						url: '/:section',
						templateUrl: function ($stateParams) {
							let path = '';
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
						controller: function ($rootScope, $scope, $stateParams, $firebaseHelper, $filter, Sections, Competition, CompetitionData) {
							let section = $stateParams.section;
							let getAge = $rootScope.getAge = function (date) {
								return date ? moment(Competition.date).diff(date, 'years') : undefined;
							};
							let getGroupName = $rootScope.getGroupName = function (group) {
								return group.level + ' ' + group.min + '-' + group.max;
							};
							let getGroupDancers = function(group) {
								let groupDancers = {};
								angular.forEach(CompetitionData.dancers, function (dancer, dancerId) {
									if (dancer.level !== group.level) return;
									
									var age = getAge(dancer.dob);
									if (parseInt(group.min) <= age && age <= parseInt(group.max)){
										groupDancers[dancer.$id || dancerId] = dancer;
									}
								});
								return groupDancers;
							};
							let knapsack = function (numContainers, arrayOfObjects, key) {
								var containers      = Array.from(new Array(numContainers), () => []),
									containerCounts = Array.from(new Array(numContainers), () => 0);
								
								arrayOfObjects = arrayOfObjects.sort((a,b) => b[key] - a[key]); // sort from highest to lowest
								
								let indexOfSmallestContainer = function () {
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
													if ( ! level.$min) level.$min = group.age;
													if ((level.$counter >= 1 && level.$counted >= 1) || (i >= data.length - 1)) {
														level.$max = group.age;
														
														//console.log(level.name, level.$min, level.$max, level.$counter);
														if (hot && hot.data) {
															hot.data.push({
																level: level.name,
																min:   level.$min,
																max:   level.$max,
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
													dance.$groups = groups.filter((group) => !! dance[group.level]);
													
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
										let places = [];
										for (let i = 0; i < Math.ceil($filter('length')(group.$dancers) / 2); i++) {
											let place = (i + 1).toString(),
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
									$scope.scores.$loaded(() => $scope.scores.$$loaded = true);
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
										$firebaseHelper.ref($scope.scores, groupId, danceId, dancerId).set(value || null);
									};
									$firebaseHelper.array(CompetitionData, 'groups').$loaded()
										.then(function (groups) {
											$scope.groups = groups;

											return $firebaseHelper.array(CompetitionData, 'dances').$loaded();
										})
										.then(function (dances) {
											angular.forEach($scope.groups, function (group) {
												group.$dancers = getGroupDancers(group);
												group.$dances = dances.filter((dance) => !! dance[group.level]);

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
															data:              level.name,
															title:             level.name,
															type:              'checkbox',
															uncheckedTemplate: '',
														});
													});
												});
												break;
											case 'dancers':
												hot.settings.columns.push({
													data:     'dob',
													title:    '(Age)',
													type:     'age',
													readOnly: true,
												});
												break;
										}
										angular.forEach(hot.settings.columns, function (v, k) {
											if (v.type === 'age'){
												v.type = 'numeric';
												v.renderer = function (instance, td, row, col, prop, value, cellProperties) {
													let age = getAge(value);
													Handsontable.renderers.NumericRenderer(instance, td, row, col, prop, age, cellProperties);
													return td;
												};
											} else if (v.data === 'level') {
												$firebaseHelper.array(CompetitionData, 'levels').$loaded(function (levels) {
													var source = [];
													angular.forEach(levels, (level) => source.push(level.name));
													v.source = source;
												});
											}
										});
									});
									break;
							}
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
		$firebaseHelperProvider.namespace('scotdance');
	})
	
	.controller('AppCtrl', function($rootScope, $scope, $state, $firebaseHelper, $timeout){
		$rootScope.$state = $state;
		
		$firebaseHelper.hot = function hot() {
			let self = {
					ref: $firebaseHelper.ref.apply(this, arguments),
					parseData: function parse(snapshot) {
						$timeout(function () {
							let obj = snapshot.exportVal(),
								arr = Object.keys(obj || {}).map((k) => {
									let o = angular.copy(obj[k]);
									o.$id = k;
									return o;
								});
							
							self.original = angular.copy(arr);
							
							if ( ! self.revisions) {
								self.data = arr;
								if (angular.isFunction(self.callback)) self.callback(self.data);
							} else {
								//console.info(self.revisions + ' revision' + (self.revisions === 1 ? ' has' : 's have') + ' been made to this reference since you last saved:', self.ref.path.toString());
							}
							self.revisions++;
						});
					},
					callback: null,
					onData: function (callback) {
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
								o   = angular.copy(item);
							
							delete o.$id;
							angular.forEach(o, function (v, k) { if (v === '' || k.match(/^[^\w\d_]/)) delete o[k]; }); // clear empties (so they will be deleted from server)
							
							// @TODO: handle priority ?
							data[$id] = o;
						});
						//console.log('saving', data);
						
						self.revisions = 0;
						self.ref.set(data, self.reload);
					},
					dirty: function dirty() {
						if ( ! self.data || ! self.original) return;
						
						var cleanedData = self.data.filter(function (item) {
							let found = false;
							angular.forEach(item, (v) => (found = found || v));
							return found; // @TODO: all props?
						});
						return ! angular.equals(cleanedData, self.original);
					},
					revisions: 0,
					data: [],
				};
			
			self.init();
			
			return self;
		};
	})
	.controller('CompetitionsCtrl', function($scope, $firebaseHelper){
		$scope.competitions = $firebaseHelper.array('competitions');
	})
	
	.directive('input', function(){
		return {
			restrict: 'E',
			require: '?ngModel',
			link: function(scope, element, attrs, ngModelCtrl){
				switch(attrs.type){
					// autoconvert string dates to Date objects for <input type="date"> in Angular 1.3
					case 'date':
						//format text going to user (model to view)
						ngModelCtrl.$formatters.push(function(v){
							return new Date(moment(v).format());
						});
						
						//format text from the user (view to model)
						ngModelCtrl.$parsers.push(function(v){
							return moment(new Date(v)).format();
						});
						break;
					// ensure numbers are not stored as string, and that any falsy values are treated as 0
					case 'number':
					case 'range':
						//format text going to user (model to view)
						ngModelCtrl.$formatters.push(function(v){
							return v || 0;
						});
						
						//format text from the user (view to model)
						ngModelCtrl.$parsers.push(function(v){
							return parseFloat(v) || 0;
						});
						break;
				}
			}
		};
	})
	.filter('groupByAge', function ($rootScope) {
		return _.memoize(function (dancers) {
			let grouped = {};
			angular.forEach(dancers, dancer => {
				let age = $rootScope.getAge(dancer.dob);
				grouped[age] = grouped[age] || [];
				grouped[age].push(dancer);
			});
			return grouped;
		});
	})
	.filter('groupByGroup', function () {
		return _.memoize(function (dancersByAge) {
			let grouped = [],
				extras = [];
			angular.forEach(dancersByAge, dancers => {
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