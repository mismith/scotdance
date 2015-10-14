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
															uncheckedTemplate: '',
														});
													});
												});
												break;
										}
										angular.forEach(settings.columns, function (v, k) {
											if (v.type === 'age'){
												v.type = 'numeric';
												v.renderer = function (instance, td, row, col, prop, value, cellProperties) {
													let age = value ? moment(Competition.date).diff(value, 'years') : undefined;
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
										$scope.settings = settings;
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
		
		$firebaseHelper.hotTable = function hotTable() {
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
								self.data.splice(0, self.data.length, ...arr);
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
								o   = angular.copy(item);
							
							delete o.$id;
							angular.forEach(o, function (v, k) { if (v === '' || k.match(/^[^\w\d_]/)) delete o[k]; }); // clear empties (so they will be deleted from server)
							
							// @TODO: handle priority ?
							data[$id] = o;
						});
						console.log('saving', data);
						
						self.revisions = 0;
						self.ref.set(data, self.refresh);
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
	});