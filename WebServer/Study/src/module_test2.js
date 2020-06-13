var user = require('./user2');

function showUser() {
    return user.getUser().name + ', ' + user.group.name;
}
console.log('User Info : ' , showUser());