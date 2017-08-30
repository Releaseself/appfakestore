// fetch data from app store

console.log('****** BEGIN TO FETCH ******');
console.log((new Date()).toLocaleString());

var fetcher = new require('./lib/fetcher')('ios');
fetcher.pages = [{
    url: 'https://itunes.apple.com/cn/genre/ios-%E5%9B%BE%E4%B9%A6/id6018?mt=8',
    category: 'book'
}, {
    url: 'https://itunes.apple.com/cn/genre/ios-%E5%95%86%E5%8A%A1/id6000?mt=8',
    category: 'business'
}];

fetcher.fetch(function (err) {
    console.log((new Date()).toLocaleString());
    if(err) {
        console.error('****** FETCH ERROR ******');
    } else {
        console.log('****** FETCH END ******');
    }
});