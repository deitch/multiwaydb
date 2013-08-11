/*jslint node:true,nomen:true */
/*global unescape */
var db, http = require('http'), sha1 = require('./sha1').sha1, urllib = require('url'), qs = require('querystring'), doCb,
	searchjs = require('searchjs'), fs = require('fs'), _ = require('lodash'), lastLoad;

doCb = function(cb) {
	if (cb && typeof(cb) === "function") {
		cb.apply(this,Array.prototype.slice.call( arguments, 1 ));
	}
};

var data = {}, that, server;
that = {
	set: function(table,key,val,cb) {
		var ret;
		if (!data[table] || !key) {
			ret = false;
		} else {
			_.each([].concat(key),function (k) {
				data[table][k] = _.cloneDeep(val);
			});
			ret = true;
		}
		doCb(cb,ret);
	},
	create: function (table,val,cb) {
		var key;
		if (!data[table]) {
			data[table] = {};
		}
		// set that key, or create one
		key = val.id = sha1.hash(new Date().toString().split("").sort(function(){return Math.round(Math.random())-0.5;}).join("")).substr(0,12);
		data[table][key] = _.cloneDeep(val);
		doCb(cb,key);
	},
	update: function (table,key,val,cb) {
		var ret;
		if (!data[table] || !key) {
			ret = false;
		} else {
			ret = true;
			// need to check each key
			key = [].concat(key);
			_.each(key,function (k) {
				if (!data[table][k]) {
					ret = false;
					return(false);
				}
			});
			// only go ahead if no keys were missing
			if (ret) {
				_.each(key,function (k) {
					if (typeof(val) === "object") {
						_.extend(data[table][k],val);
					} else {
						data[table][k] = _.cloneDeep(val);
					}
				});
			}
		}
		doCb(cb,ret);
	},
	get: function(table,key,cb) {
		var ret = [];
		if (!data[table]) {
			data[table] = {};
		}
		if (cb === undefined && typeof(key) === "function") {
			cb = key;
			key = null;
			ret = _.values(_.cloneDeep(data[table]));
		} else {
			key = [].concat(key);
			_.each([].concat(key),function (k) {
				if (data[table][k]) {
					ret.push(data[table][k]);
				}
			});
		}
		doCb(cb,ret);
	},
	find: function(table,search,cb) {
		var ret = [];
		if (!data[table]) {
			data[table] = {};
		}
		if (search) {
			_.each(data[table],function (val) {
				if(searchjs.matchObject(val,search)) {
					ret.push(val);
				}
			});
		}
		
		doCb(cb,ret);
	},
	del: function(table,key,cb) {
		if (!data[table]) {
			data[table] = {};
		}
		if (key) {
			_.each([].concat(key),function (k) {
				delete data[table][k];
			});
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
		// refresh from the last path, if we need
		if (!path && lastLoad) {
			path = lastLoad;
		} else {
			lastLoad = path;
		}
		data = _.cloneDeep(require(path));
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
							that.find(table,JSON.parse(unescape(url.query.search)),function(data){
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
							that.get(table,function (data) {
								res.writeHead(200,{'Content-Type':'application/json'});
								res.end(JSON.stringify(data));
							});
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
					case "PATCH":
						d = "";
						req.on("data",function(chunk){
							d+=chunk;
						});
						req.on("end",function(){
							that.update(table,key,JSON.parse(d),function(data){
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
							that.create(table,JSON.parse(d),function(data){
								res.writeHead(201,{'Location':"/"+table+"/"+data});
								res.end(data);
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