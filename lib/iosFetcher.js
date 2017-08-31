var request = require('request'),
    cheerio = require('cheerio'),
    fs = require('fs'),
    Promise = require('bluebird'),
    rp = require('request-promise'),
    _ = require('lodash');

exports = module.exports = function (fetcher) {
    var _refUrl = 'https://itunes.apple.com/cn/genre/ios/id36?mt=8';

    fetcher._fetchPage = function (options, callback) {
        // find letter list
        requestUrl(options.url).then(function ($) {
            var letters = $('#selectedgenre ul.alpha a').map(function () {
                return {
                    url: $(this).attr('href'),
                    text: $(this).text().toLowerCase()
                }
            }).get();

            console.log('get available letters: ' + JSON.stringify(letters));

            var letterIndex = 0, pageIndex = 1;

            if (options.letter) {
                letterIndex = _.findIndex(letters, {text: options.letter});
            }

            if(options.page) {
                pageIndex = options.page + 1;
            }

            getAppIndexPage({
                letters: letters,
                letterIndex: letterIndex,
                pageIndex: pageIndex,
                success: options.success
            }, callback);
        });
    };

    return fetcher;

    function _requestUrl(url, callback) {
        var options = {
            uri: url,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.101 Safari/537.36',
                'Referer': _refUrl,
                'Upgrade-Insecure-Requests': "1"
            },
            timeout: 10000,
            transform: function (body) {
                return cheerio.load(body);
            }
        };

        var count = 0, max = 20;

        function _request() {
            if (count > max) {
                return callback(new Error('retry failed'));
            }

            rp(options).then(function ($) {
                return callback(null, $);
            }).catch(function (err) {
                console.error('error: ' + err.message + ', url: ' + url);
                if(err.message.indexOf('404') >= 0) {
                    // skip 404
                    return callback(null, null);
                }

                count++;
                console.log('retry ' + count);
                setTimeout(_request, 1000 * count);
            })
        }

        _request();
    }

    function requestUrl(url) {
        return new Promise(function (resolve, reject) {
            _requestUrl(url, function (err, data) {
                if (err) {
                    return reject(err);
                }

                return resolve(data);
            });
        })
    }

    function getAppIndexPage(options, callback) {
        var letters = options.letters,
            letterIndex = options.letterIndex,
            pageIndex = options.pageIndex;

        if (letterIndex >= letters.length) {
            return callback(null)
        }

        console.log('try to get apps by page: ' + pageIndex);

        var url = letters[letterIndex].url + '&page=' + pageIndex + '#page';

        requestUrl(url).then(function ($) {
            var result = [];

            var content = $('#selectedcontent li a');
            if (content.length <= 1) {
                // no content, some page has extra one app, should be a bug
                console.log('no content, next letter');
                options.letterIndex++;
                options.pageIndex = 1;
                return getAppIndexPage(options, callback)
            }

            content.each(function (index, item) {
                var name = $(item).text();

                if (!_.find(result, {name: name})) {
                    result.push({
                        name: name,
                        link: $(item).attr('href')
                    })
                }
            });

            getAppDetail({
                apps: result,
                index: 0
            }, function (err) {
                if (err) {
                    console.log('fetching stopped!!!');
                    return callback(err);
                }

                options.success({
                    letter: letters[letterIndex].text,
                    page: options.pageIndex,
                    data: result
                }, function (err) {
                    if (err) {
                        console.log('fetching stopped!!!');
                        return callback(err);
                    }

                    options.pageIndex++;
                    return getAppIndexPage(options, callback);
                });
            });
        }).catch(function (err) {
            console.log('fetching stopped!!!');
            return callback(err);
        })
    }

    function getAppDetail(options, callback) {
        var apps = options.apps,
            index = options.index;

        if (index >= apps.length) {
            return callback(null);
        }

        var app = apps[index];
        console.log('parse app: ' + app.name);

        requestUrl(app.link).then(function ($) {
            if($) {
                app.developer = $('#title h2').text().substring(4);
                var leftStack = $('#left-stack');
                app.icon = leftStack.find('img').first().attr('src-swap-high-dpi');
                app.price = leftStack.find('.price').first().text();
                app.category = leftStack.find('[itemprop="applicationCategory"]').text();
                app.publishedAt = leftStack.find('[itemprop="datePublished"]').text();
                app.version = leftStack.find('[itemprop="softwareVersion"]').text();
                app.size = leftStack.find('.language').first().prev().text().substring(4);
                app.language = leftStack.find('.language').first().text().substring(4);
                app.level = leftStack.find('.app-rating a').text();
                app.reasons = leftStack.find('.app-rating-reasons li').map(function () {
                    return $(this).text();
                }).get().join(',');
                app.requirements = leftStack.find('[itemprop="operatingSystem"]').text();
                var ratings = leftStack.find('.customer-ratings').first();
                if (ratings.find('.rating').length == 1) {
                    var r = ratings.find('.rating').eq(0).attr('aria-label');
                    app.allRating = r.split(',')[0].match(/\d+/)[0];
                    app.allRatingCount = r.split(',')[1].match(/\d+/)[0];
                } else if (ratings.find('.rating').length == 2) {
                    var r = ratings.find('.rating').eq(0).attr('aria-label');
                    app.rating = r.split(',')[0].match(/\d+/)[0];
                    app.ratingCount = r.split(',')[1].match(/\d+/)[0];

                    r = ratings.find('.rating').eq(1).attr('aria-label');
                    app.allRating = r.split(',')[0].match(/\d+/)[0];
                    app.allRatingCount = r.split(',')[1].match(/\d+/)[0];
                }

                app.description = $('p[itemprop="description"]').html();
                app.screenshots_iphone = $('div.iphone-screen-shots').find('img[itemprop="screenshot"]').map(function () {
                    return $(this).attr('src');
                }).get().join(',');
                app.screenshots_ipad = $('div.ipad-screen-shots').find('img[itemprop="screenshot"]').map(function () {
                    return $(this).attr('src');
                }).get().join(',');
            } else {
                console.log('ignore 404 issue');
            }

            console.log('parse done. app: ' + app.name);

            options.index++;
            return getAppDetail(options, callback);
        }).catch(function (err) {
            return callback(err);
        });
    }
};