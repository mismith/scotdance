angular.module('bigContentful', ['contentful'])
	.controller('ContentfulCtrl', function($rootScope, $scope, contentful){
		$scope.fetchEntries = function(contentType){
			var entries = [];
			contentful.entries('content_type=' + contentType + '&order=sys.createdAt').then(function(response){
				angular.forEach(response.data.items, function (item) {
					entries.push(item);
				});
				
				$rootScope.$emit('bigContentLoaded');
			});
			return entries;
		};
		$scope.fetchEntry = function(entryId){
			var entry = {};
			contentful.entry(entryId).then(function(response){
				angular.forEach(response.data, function (v, k) {
					entry[k] = v;
				});
				
				$rootScope.$emit('bigContentLoaded');
			});
			return entry;
		};
	})
	
	.directive('entry', function () {
		return {
			scope: true,
			restrict: 'A',
			controller: 'ContentfulCtrl',
			link: function ($scope, $element, $attrs) {
				$scope.entry = $scope.fetchEntry($attrs.entry);
			},
		};
	})
	.directive('entries', function () {
		return {
			scope: true,
			restrict: 'A',
			controller: 'ContentfulCtrl',
			link: function ($scope, $element, $attrs) {
				$scope.entries = $scope.fetchEntries($attrs.entries);
			},
		};
	});