var request = require('request'),
    fs = require('fs'),
    _ = require('lodash');

exports = module.exports = function (store, options) {
    var f = new fetcher(store);

    switch (store.toLowerCase()) {
        case 'ios':
            return require('./iosFetcher')(f);

        default:
            return f;
    }
};

function fetcher(store) {
    this.store = store;
    this.dataFolder = 'data';
    this.pages = [];

    this._fileFormat = '{store}/{category}';
    this._lockFile = 'fetch-lock.json';


    this._createFolder = function (path) {
        if (!fs.existsSync(this.dataFolder)) {
            fs.mkdirSync(this.dataFolder);
        }

        var folder = this.dataFolder;
        path.split('/').forEach(function (item) {
            folder += '/' + item;
            if (!fs.existsSync(folder)) {
                fs.mkdirSync(folder);
            }
        })
    };

    this._updateLock = function (lock) {
        lock.time = (new Date()).toLocaleString();
        fs.writeFileSync(this.dataFolder + '/' + this._lockFile, JSON.stringify(lock), 'utf-8');
    };

    this._saveData = function (options, callback) {
        console.log('begin to save data to file');

        var folder = this._fileFormat.replace('{store}', this.store)
            .replace('{category}', options.category);

        this._createFolder(folder);

        var filePath = this.dataFolder + '/' + folder + '/' + options.result.letter.toLowerCase() + '_' + options.result.page + '.json';

        console.log('file path: ' + filePath);

        var _this = this;

        fs.writeFile(filePath, JSON.stringify(options.result.data), 'utf-8', function (err) {
            if (err) {
                console.error(err);
                return callback(err);
            }

            options.lock.letter = options.result.letter.toLowerCase();
            options.lock.page = options.result.page;
            _this._updateLock(options.lock);

            console.log('data saved');
            return callback();
        });
    };

    this._fetchPage = function (options, callback) {
        return callback();
    };

    this.fetchPage = function (options, callback) {
        if (options.index >= this.pages.length) {
            return callback();
        }

        var page = this.pages[options.index];

        if (_.indexOf(options.lock.completed, page.url) >= 0) {
            // already done, skip
            console.log('page already be completed, skip. url: ' + page.url);
            options.index++;
            return this.fetchPage(options, callback);
        }

        console.log('begin to fetch data for page: ' + page.url);

        var _this = this;

        var handler = function (result, callback) {
          _this._saveData({
              lock: options.lock,
              category: page.category,
              result: result
          }, callback);
        };

        this._fetchPage({
            url: page.url,
            category: page.category,
            letter: options.lock.letter,
            page: options.lock.page,
            success: handler
        }, function (err) {
            if (err) {
                return callback(err);
            }

            console.log('fetch page end.');

            options.lock.completed.push(page.url);
            delete options.lock.letter;
            delete options.lock.page;
            this._updateLock(options.lock);

            options.index++;
            return this.fetchPage(options, callback);
        })
    };

    this.fetch = function (callback) {
        if (this.pages.length == 0) {
            return callback();
        }

        var lock = {
            time: (new Date()).toLocaleString(),
            completed: []
        };

        var lockFile = this.dataFolder + '/' + this._lockFile;

        if (fs.existsSync(lockFile)) {
            lock = JSON.parse(fs.readFileSync(lockFile, 'utf-8'));
            console.log('### find uncompleted work, letter: ' + lock.letter + ', page: ' + lock.page + ', time: ' + lock.time + '. ###');
        } else {
            fs.writeFileSync(lockFile, JSON.stringify(lock), 'utf-8');
        }

        this.fetchPage({
            index: 0,
            lock: lock
        }, function (err) {
            if (err) {
                return callback(err);
            }

            fs.unlink(lockFile, function () {
                return callback();
            })
        });
    };
}