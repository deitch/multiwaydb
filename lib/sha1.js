/*jslint node:true */

var crypto = require('crypto');

module.exports.sha1 = {
	hash: function(msg) {
		var sha1 = crypto.createHash('sha1');
		sha1.update(msg);
		return sha1.digest('hex');
	}
};
