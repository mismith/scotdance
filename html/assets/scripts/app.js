angular.module('XXXXXX', ['ui.router', 'ui.router.title', 'bigUtil', 'firebaseHelper', 'ngHandsontable'])
	
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
					controller: function ($scope, Sections, Competition, CompetitionData) {
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
								case 'schedule':
									path = $stateParams.section;
									break;
								default:
									path = 'table';
									break;
							}
							return 'views/page/competition/' + path + '.html';
						},
						controller: function ($scope, $stateParams, $firebaseHelper, Sections, Competition, CompetitionData) {
							let section = $stateParams.section;
							let getAge = (date) => date ? moment(Competition.date).diff(date, 'years') : undefined;
							
							switch (section) {
								case 'settings':
									
									break;
								case 'schedule':
									
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
											case 'groups':
												// helperHot
												$firebaseHelper.array(CompetitionData, 'dancers').$loaded(function (dancers) {
													let ageLevels = {};
													angular.forEach(dancers, function (dancer) {
														let age = getAge(dancer.dob);
														ageLevels[age] = ageLevels[age] || {};
														ageLevels[age][dancer.level] = (ageLevels[age][dancer.level] || 0) + 1;
													});
													
													let data = [];
													angular.forEach(ageLevels, function (levels, age) {
														levels.age = age;
														data.push(levels);
													});
													
													let settings = {
														columns: [
															{
																data:    'age',
																title:   'Age',
																readOnly: true,
															}
														],
													};
													$firebaseHelper.array(CompetitionData, 'levels').$loaded(function (levels) {
														angular.forEach(levels, function (level) {
															settings.columns.push({
																data:     level.name,
																title:    level.name,
																type:     'numeric',
																readOnly: true,
															})
														});
													});
													$scope.helperHot = {
														data:     data,
														settings: settings,
													};
													
												
													hot.settings.columns.push({
														title: '(# Dancers)',
														data: '$dancersCount',
														type: 'numeric',
														readOnly: true,
													});
													hot.onData(function (data) {
														angular.forEach(data, function (row) {
															for(let age = parseInt(row.min); age <= parseInt(row.max); age++) {
																if ( ! row.$dancersCount) row.$dancersCount = 0;
																if (ageLevels[age]) row.$dancersCount += (parseInt(ageLevels[age][row.level]) || 0);
															}
														});
													});
												});
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
	});