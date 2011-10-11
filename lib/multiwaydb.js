/*jslint node:true,nomen:false */
var db, http = require('http'), sha1 = require('./sha1').sha1, urllib = require('url'), qs = require('querystring'), clone, doCb,
	searchjs = require('searchjs'), fs = require('fs');

clone = function(obj) {
	var temp, key;
    if( obj === null || typeof(obj) !== 'object') {
		return obj;
	}

	temp = obj.constructor === Array ? new Array(obj.length) : {};
	temp.prototype = obj.prototype;

    for(key in obj) {
        if (obj.hasOwnProperty(key)) {
	        temp[key] = (obj[key] === undefined)  ? undefined : clone(obj[key]);
		}
    }

    return temp;
};
doCb = function(cb) {
	if (cb && typeof(cb) === "function") {
		cb.apply(this,Array.prototype.slice.call( arguments, 1 ));
	}
};

var data = {}, that, server;
that = {
	set: function(table,key,val,cb) {
		var i;
		if (!data[table]) {
			data[table] = {};
		}
		// set that key, or create one
		if (!key) {
			key = val.id = sha1.hash(new Date().toString().split("").sort(function(){return Math.round(Math.random())-0.5;}).join("")).substr(0,12);
			data[table][key] = clone(val);
		} else {
			key = [].concat(key);
			for (i=0; i<key.length; i++) {
				data[table][key[i]] = clone(val);
			}
		}
		doCb(cb,true);
	},
	get: function(table,key,cb) {
		var i, ret = [];
		if (!data[table]) {
			data[table] = {};
		}
		if (key) {
			key = [].concat(key);
			for (i=0;i<key.length;i++) {
				if (data[table][key[i]]) {
					ret.push(data[table][key[i]]);
				}
			}
		}
		doCb(cb,ret);
	},
	find: function(table,search,cb) {
		var key, val, i, ret = [], t;
		if (!data[table]) {
			data[table] = {};
		}
		if (search) {
			for (key in data[table]) {
				if (data[table].hasOwnProperty(key)) {
					val = data[table][key];
					if(searchjs.matchObject(val,search)) {
						ret.push(val);
					}
				}
			}
		}
		
		doCb(cb,ret);
	},
	del: function(table,key,cb) {
		var i;
		if (!data[table]) {
			data[table] = {};
		}
		if (key) {
			key = [].concat(key);
			for (i=0;i<key.length;i++) {
				if (data[table][key[i]]) {
					delete data[table][key[i]];
				}
			}
		}
		doCb(cb,true);
	},
	clearTable: function(table,cb) {
		data[table] = {};
		doCb(cb,true);
	},
	clear: function(cb) {
		data = {};
		doCb(cb,true);
	},
	init: function(path) {
		var table, data, key;
		data = fs.readFileSync(path);
		data = JSON.parse(data);
		for (table in data) {
			if (data.hasOwnProperty(table)) {
				for (key in data[table]) {
					if (data[table].hasOwnProperty(key)) {
						that.set(table,key,data[table][key]);
					}
				}
			}
		}
	},
	listen: function(port) {
		// do we have a port, is it a real number?
		if (port && port > 1024) {
			server = http.createServer(function(req,res){
				// for each request, we find the verb and REST path, then do the right thing
				var url = urllib.parse(req.url,true), p, table, key = null, d = "";
				// first section is always the table, second is the key, if available
				p = url.pathname.split("/");
				if (p.length > 1) {
					table = p[1];
				}
				if (p.length > 2) {
					key = p[2];
					key = key ? key.split(",") : null;
				}
				switch(req.method) {
					case "GET":
						// was it a regular get or a search?
						if (key) {
							that.get(table,key,function(data){
								if (data && data.length > 0) {
									res.writeHead(200,{'Content-Type': 'application/json' });
									res.end(JSON.stringify(data));
								} else {
									res.writeHead(404);
									res.end();
								}
							});
						} else if (url.query.search) {
							that.find(table,JSON.parse(url.query.search),function(data){
								if (data && data.length > 0) {
									res.writeHead(200,{'Content-Type': 'application/json' });
									res.write(JSON.stringify(data));
									res.end();
								} else {
									res.writeHead(404);
									res.end();
								}
							});
						} else {
							res.writeHead(400);
							res.end();
						}
						break;
					case "PUT":
						d = "";
						req.on("data",function(chunk){
							d+=chunk;
						});
						req.on("end",function(){
							that.set(table,key,JSON.parse(d),function(data){
								res.writeHead(200);
								res.end();
							});
						});
						break;
					case "POST":
						d = "";
						req.on("data",function(chunk){
							d+=chunk;
						});
						req.on("end",function(){
							that.set(table,null,JSON.parse(d),function(data){
								res.writeHead(201);
								res.end();
							});
						});
						break;
					case "DELETE":
						that.del(table,key,function(rec){
							res.writeHead(200);
							res.end();
						});
						break;
				}
			});
			server.listen(port);
		}
	},
	stop: function() {
		if (server && server.close) {
			server.close();
		}
	}
};


module.exports = that;