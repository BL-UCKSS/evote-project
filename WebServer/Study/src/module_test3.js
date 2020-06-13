var user = require('./user3');

function showUser() {
    return user().name + ', ' + 'No Group';
}

console.log('User Info : ' + showUser());