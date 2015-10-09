angular.module('XXXXXX', ['ui.router', 'ui.router.title', 'firebaseHelper', 'ngHandsontable'])
	
	.config(function($locationProvider, $urlRouterProvider, $urlMatcherFactoryProvider, $stateProvider, $firebaseHelperProvider, $provide){
		// routing
		$locationProvider.html5Mode(true).hashPrefix('!');
		$urlRouterProvider.when('', '/');
		$urlRouterProvider.when('home', '/');
		$urlMatcherFactoryProvider.strictMode(false); // make trailing slashes optional
		
		// pages
		var pages = [
			'home',
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
/*
		$provide.decorator('$firebaseArray', function ($delegate) {
			$delegate.prototype.$table = function $table() {
				let arr = [];
				console.log(arr.length);
				this.$list.$loaded(function (list) {
				console.log(arr.length);
					for (let item of list) {
						arr.push(item);
					}
				});
				return arr;
			};
			return $delegate;
		});
*/
	})
	
	.controller('AppCtrl', function($rootScope, $scope, $state, $firebaseHelper, $timeout){
		$rootScope.$state = $state;
		
		$firebaseHelper.hotTable = function hotTable() {
			let ref   = $firebaseHelper.ref.apply(this, arguments),
				fbHot = {
					parse: function parse(snapshot) {
						$timeout(function () {
							if ( ! fbHot.revisions) {
								let obj = snapshot.exportVal(),
									arr = Object.keys(obj).map((k) => {
										let o = angular.copy(obj[k]);
										o.$id = k;
										return o;
									});
								
								fbHot.data.splice(0, fbHot.data.length, ...arr);
							} else {
								console.info(fbHot.revisions + ' revision' + (fbHot.revisions === 1 ? ' has' : 's have') + ' been made to this reference since you last saved:', ref.path.toString());
							}
							fbHot.revisions++;
						});
					},
					init: function init() {
						ref.orderByPriority().on('value', fbHot.parse);
					},
					refresh: function refresh() {
						fbHot.revisions = 0;
						ref.orderByPriority().once('value', fbHot.parse);
					},
					save: function save() {
						var obj = {};
						fbHot.data.forEach((item) => {
							var $id = item.$id,
								o   = angular.copy(item);
							
							delete o.$id;
							if ($id) obj[$id] = o;
							// @TODO: handle priority ?
						});
						console.log('saving', obj);
						
						fbHot.revisions = 0;
						ref.update(obj);
					},
					revisions: 0,
					data: [],
				};
			
			fbHot.init();
			
			return fbHot;
		};
		$scope.fbHot = $firebaseHelper.hotTable('competitionsData/idc0/dancers');
		
		$scope.settings = {
			columns: [
				{data: 'number', title: '#', readOnly: true},
				{data: 'firstName', title: 'First Name'},
				{data: 'lastName', title: 'Last Name'},
				{data: 'location', title: 'Location'},
			],
			minSpareRows: 1,
			undo: true,
			contextMenu: [
				'remove_row',
				'---------',
				'undo',
			],
/*
			afterChange: (changes, source) => {
				console.log(source);
				switch (source) {
					case 'edit':
					case 'undo':
						angular.forEach(changes, function (change) {
							var key = $data.$keyAt(change[0]);
							if (key) {
								$firebaseHelper.ref($data, key).child(change[1]).set(change[3]);
							}
						});
						break;
				}
			},
*/
		};
	});