angular.module('bigWordpress', [])
	.provider('$wp', function () {
		var basePath = '/wp/api/';
		this.setApiBase = function (path) {
			basePath = path;
		};
		
		this.$get = ['$http', '$q', function ($http, $q) {
			var self = this;
			
			// helpers
			self.proper_date = function (date) {
				return (date || '').replace(' ', 'T');
			};
			self.custom_field = function (post, field) {
				try {
					return post.custom_fields[field][0];
				} catch(e) {
					return undefined;
				}
			};
			self.thumbnail_image = function (post, size) {
				try {
					return post.thumbnail_images[size || 'full'].url;
				} catch(e) {
					try {
						return post.attachments[0].url;
					} catch(e) {
						return undefined;
					}
				}
			};
			
			// ajax
			self.api = function (method, params) {
				var deferred = $q.defer();
				
				if (angular.isString(params)) {
					method += '?' + params;
					params = {};
				}
				
				$http.jsonp(basePath + method, {params: angular.extend({callback: 'JSON_CALLBACK'}, params || {})})
					.then(function (response) {
						if (response && response.data && response.data.status == 'ok') {
							deferred.resolve(response.data);
						} else {
							deferred.reject();
						}
					})
					.catch(function (response) {
						deferred.reject();
					});
				
				return deferred.promise;
			};
			self.posts = function ($scope, params, method) {
				var page  = 1,
					count = 10;
					
				$scope.loading    = false;
				$scope.fetchedAll = false;
				$scope.fetchPosts = function (items) {
					if($scope.loading || $scope.fetchedAll) return; // only one request at a time
					
					$scope.loading = true;
					return self.api(method || 'get_category_posts', angular.extend({count: count, page: page}, params))
						.then(function (response) {
							angular.forEach(response.posts, function (post) {
								items.push(post);
							});
							
							if (page < response.pages) {
								page++;
							} else {
								$scope.fetchedAll = true;
							}
						})
						.catch(function (err) {
							$scope.fetchedAll = true;
							
							// @TODO: properly handle error
							console.error(err);
						})
						.finally(function () {
							$scope.loading = false;
						});
				};
			};
			
			// cache
			// N.B. does not cache pagination results!
			var cache = {};
			self.cache = function (path, set) {
				if (set) cache[path] = set;
				return cache[path];
			};
			
			return self;
		}]
	})
	.directive('wpPost', function ($wp) {
		return {
			link: function ($scope, $element, $attrs) {
				$scope.$wpPost = {$loading: true};
				
				$attrs.$observe('wpPost', function (v) {
					var query = $scope.$eval(v);
					if (query) {
						$wp.api('get_post', query).then(function (response) {
							$scope.$wpPost = response.post;
						}).catch(function (err) {
							$scope.$wpPost.$loading = false;
							$scope.$wpPost.$error   = err;
							
							console.error(err);
						});
					}
				});
			},
		};
	})
	.controller('WordpressCtrl', function ($rootScope, $scope, $wp) {
		$scope.posts = [];
		$scope.setCategory = function (categoryId, postType) {
			postType = postType || 'publication';
			
			// setup
			$wp.posts($scope, {id: categoryId, post_type: postType});
			
			// check if they are cached
			var path   = postType + '/' + categoryId,
				cached = $wp.cache(path);
			if (cached) return $scope.posts = cached;
			
			// otherwise, fetch and cache em
			$scope.fetchPosts($scope.posts).then(function () {
				//console.log('wp loaded');
				$rootScope.$emit('bigScrollRefresh');
				
				$wp.cache(path, $scope.posts);
			});
		};
		$scope.hasCategory = function(post, categoryId){
			var found = false;
			if(post && post.categories){
				angular.forEach(post.categories, function(category){
					if(found) return;
					if(category.id == categoryId) return found = true;
				})
			}
			return found;
		};
		
		$scope.proper_date     = $wp.proper_date;
		$scope.custom_field    = $wp.custom_field;
		$scope.thumbnail_image = $wp.thumbnail_image;
	});