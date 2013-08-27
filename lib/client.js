/*jslint node:true, nomen:true */
/*global module, require, Buffer, escape */

var _ = require('lodash'), urllib = require('url'), http = require('http'), request = require('superagent');

module.exports = function (url) {
	var URL, parsedUrl, db;
	parsedUrl = urllib.parse(url || "");
	URL = {
		host: parsedUrl.hostname,
		port: parsedUrl.port
	};

	db = {
		get: function(table,key,cb) {
			if (cb === undefined && typeof(key) === "function") {
				cb = key;
				key = "";
			} else {
				// could have multiple keys
				key = "/"+[].concat(key).join(",");
			}
			// get from the dburl
			request.get(url+"/"+table+key).end(function (res) {
				var ret;
				if (res.status === 404) {
					ret = null;
				} else {
					ret = res.body.length === 0 ? null : res.body;
				}
				cb(false,ret);
			});
		},
		find: function(table,search,cb) {
			search = search || {};
			// if we said to do a text search, then do what multiwaydb/searchjs calls _word
		  if (search._text !== true && search._text !== "true") {
				search._word = true;
		  }

			if (table !== null) {
				// do a search on the table
				request.get(url+"/"+table+"?search="+escape(JSON.stringify(search))).end(function (res) {
					var d = [];
					d = res.body.length > 0 ? res.body : null;
					// only go if data is finished
					cb(false,d);
				});
			}
		},
		view: function(args) {

		},
		set: function(table,key,val,cb) {
			var path;
			val = val || {};
			path = "/"+table+"/"+key;
			// if there is no unique ID, we will set it - this should be a random UUID - but only of length 32 bit
			request.put(url+path).type('json').send(val).end(function (res) {
				if (res.status >= 200 && res.status < 300) {
					cb(null,key);
				} else {
					cb(res.text,null);
				}
			});
		},
		update: function(table,key,val,cb) {
			db.set(table,key,val,cb);
		},
		patch: function(table,key,val,cb) {
			var path;
			val = val || {};
			path = "/"+table+"/"+key;
			// if there is no unique ID, we will set it - this should be a random UUID - but only of length 32 bit
			request.patch(url+path).type('json').send(val).end(function (res) {
				var success = res.status >= 200 && res.status < 300,
				ret = res.statusCode === 404 ? null : key;
				cb(!success, ret);
			});
		},
		create: function(table,val,cb) {
			var path;
			val = val || {};
			path = "/"+table;
			// if there is no unique ID, we will set it - this should be a random UUID - but only of length 32 bit
			request.post(url+path).type('json').send(val).end(function (res) {
				var success = res.status >= 200 && res.status < 300, ret = null, location, tmp;
				// get the new location
				if (success) {
					location = res.headers.location;
					// parse it for the new ID
					if (location) {
						/*jslint regexp:true */
						tmp = location.match(/\/([^\/]+)$/);
						/*jslint regexp:false */
						if (tmp && tmp.length > 1) {
							ret = tmp[1];
						}
					}
				}
				cb(!success,ret);
			});
		},
		destroy: function(table,key,cb) {
			var path;
			key = [].concat(key);
			path = "/"+table+"/"+key.join(",");
			request.del(url+path).end(function (res) {
				var success = res.status >= 200 && res.status < 300;
				cb(!success,success?key:null);
			});
		},
		del: function (table,key,cb) {
			db.destroy(table,key,cb);
		}
	};
	return(db);
};