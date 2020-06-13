var require = function(path) {
    var exports = {};
    exports.getUser = function() {
        return {id:'test01',name:'donggyu'};
    };
    exports.group = {id:'group01',name:'friend'};    
    
    return exports;
}

var user = require('...');

function showUser() {
    return user.getUser().name + ', ' + user.group.name;
}

console.log('User Info : ' + showUser());