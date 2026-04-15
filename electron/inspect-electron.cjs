const electron = require('electron');

console.log('type:', typeof electron);
console.log('keys:', electron && typeof electron === 'object' ? Object.keys(electron) : 'no-object');
console.log('value:', electron);
