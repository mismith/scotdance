angular.module('bigContentful', ['contentful', 'hc.marked'])
	.directive('contentfulBg', function () {
		var key = 'background';
		return {
			restrict: 'A',
			link: function ($scope, $element, $attrs) {
				$scope.$watch(function () {
					return $scope.$eval($attrs.contentfulBg) || $scope.$contentfulEntry;
				}, function ($entry) {
					if ($entry && $entry.fields && $entry.fields[key] && $entry.fields[key].fields && $entry.fields[key].fields.file && $entry.fields[key].fields.file.url) {
						$element.css({
							backgroundImage: 'url(' + $entry.fields[key].fields.file.url + ')',
						});
					}
				});
			},
		};
	});