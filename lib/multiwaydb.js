/*jshint node:true,nomen:true, unused:vars */
/*global unescape */
var http = require('http'), sha1 = require('./sha1').sha1, urllib = require('url'),
	searchjs = require('searchjs'), _ = require('lodash'), lastLoad,  data = {},

update = function (table,key,val,replace,cb) {
	var ret = null, err;
	if (!data[table] || !key) {
		err = "tablenotfound";
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
				if (replace) {
					data[table][k] = _.cloneDeep(val);
				} else if (typeof(val) === "object") {
					_.extend(data[table][k],val);
				} else {
					data[table][k] = _.cloneDeep(val);
				}
			});
		} else {
			ret = null;
			err = "keynotfound";
		}
	}
	cb(err,ret);
}, that, server;
that = {
	set: function(table,key,val,cb) {
		update(table,key,val,true,cb);
	},
	create: function (table,val,cb) {
		var err, ret, key, myobj = _.cloneDeep(val);
		if (!data[table]) {
			data[table] = {};
		}
		// set that key, or create one
		myobj.id = myobj.id || sha1.hash(new Date().toString().split("").sort(function(){return Math.round(Math.random())-0.5;}).join("")).substr(0,12);
		key = myobj.id;
		// check for conflict
		if (data[table][key]) {
			ret = null;
			err = "conflict";
		} else {
			data[table][key] = myobj;
			ret = key;
			err = null;
		}
		cb(err,ret);
	},
	update: function (table,key,val,cb) {
		update(table,key,val,true,cb);
	},
	patch: function (table,key,val,cb) {
		update(table,key,val,false,cb);
	},
	get: function(table,key,cb) {
		var ret = null, err;
		if (!data[table]) {
			err = "tablenotfound";
		} else {
			if (cb === undefined && typeof(key) === "function") {
				cb = key;
				key = null;
				ret = _.values(_.cloneDeep(data[table]));
			} else {
				ret = [];
				key = [].concat(key);
				_.each([].concat(key),function (k) {
					if (data[table][k]) {
						ret.push(data[table][k]);
					}
				});
				switch(ret.length) {
					case 0:
						ret = null;
						break;
					case 1:
						ret = ret[0];
						break;
					default:
						break;
				}
			}
		}
		cb(err,ret);
	},
	find: function(table,search,cb) {
		var ret = null, err, terms = {}, sort, rsort, count;
		if (!data[table]) {
			err = "tablenotfound";
		} else if (search) {
			// we need to extract the special terms
			terms = _.omit(search,function (val,key) {
				return(key.indexOf('$s.') === 0);
			});
			ret = searchjs.matchArray(_.values(data[table]),terms);
			// special sort and count

			// first sort, then count
			sort = search['$s.sort'];
			if (sort) {
				// exclude the negative sign
				rsort = sort[0] === '-';
				sort = rsort ? sort.substr(1) : sort;
				ret = _.sortBy(ret,sort);
				if (rsort) {
					ret = ret.reverse();
				}
			}

			// count
			count = parseInt(search['$s.count']);
			if (count && typeof(count) === "number" && !isNaN(count)) {
				ret = ret.slice(0,count);
			}
		}
		
		cb(err,ret);
	},
	del: function(table,key,cb) {
		var ret = true, err;
		if (!data[table]) {
			err = "tablenotfound";
		} else {
			key = [].concat(key);
			_.each(key,function (k) {
				if (!data[table][key]) {
					ret = false;
					return(false);
				}
			});
			if (ret) {
				_.each([].concat(key),function (k) {
					delete data[table][k];
				});
			} else {
				err = "keynotfound";
			}
		}
		cb(err,ret);
	},
	destroy: function (table,key,cb) {
		that.del(table,key,cb);
	},
	clearTable: function(table,cb) {
		data[table] = {};
		cb(null,true);
	},
	clear: function(cb) {
		data = {};
		cb(null,true);
	},
	client: require('./client'),
	init: function(path) {
		var raw;
		// refresh from the last path, if we need
		if (!path && lastLoad) {
			path = lastLoad;
		} else {
			lastLoad = path;
		}
		// now go through, each table could be a hash or an array
		raw = _.cloneDeep(require(path));
		data = _.mapValues(raw,function (v) {
			return _.isArray(v) ? _.extend({},v) : v;
		});
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
							that.get(table,key,function(err,data){
								if (data) {
									res.writeHead(200,{'Content-Type': 'application/json' });
									res.end(JSON.stringify(data));
								} else {
									res.writeHead(404);
									res.end(err);
								}
							});
						} else if (url.query.search) {
							that.find(table,JSON.parse(unescape(url.query.search)),function(err,data){
								if (data && data.length > 0) {
									res.writeHead(200,{'Content-Type': 'application/json' });
									res.write(JSON.stringify(data));
									res.end();
								} else {
									res.writeHead(404);
									res.end(err);
								}
							});
						} else {
							that.get(table,function (err,data) {
								if (err) {
									res.writeHead(404);
									res.end(err);
								} else {
									res.writeHead(200,{'Content-Type':'application/json'});
									res.end(JSON.stringify(data));
								}
							});
						}
						break;
					case "PUT":
						d = "";
						req.on("data",function(chunk){
							d+=chunk;
						});
						req.on("end",function(){
							that.set(table,key,JSON.parse(d),function(err,data){
								if (err) {
									res.writeHead(404,{'Content-Type':'text/plain'});
									res.end(err);
								} else {
									res.writeHead(200);
									res.end();
								}
							});
						});
						break;
					case "PATCH":
						d = "";
						req.on("data",function(chunk){
							d+=chunk;
						});
						req.on("end",function(){
							that.patch(table,key,JSON.parse(d),function(err,data){
								if (err) {
									res.writeHead(404,{'Content-Type':'text/plain'});
									res.end(err);
								} else {
									res.writeHead(200);
									res.end();
								}
							});
						});
						break;						
					case "POST":
						d = "";
						req.on("data",function(chunk){
							d+=chunk;
						});
						req.on("end",function(){
							that.create(table,JSON.parse(d),function(err,data){
								if (err) {
									res.writeHead(err === "conflict"?409:400,{'Content-Type':'text/plain'});
									res.end(err);
								} else if (data) {
									res.writeHead(201,{'Location':"/"+table+"/"+data});
									res.end(data);
								} else {
									res.writeHead(404);
									res.end();
								}
							});
						});
						break;
					case "DELETE":
						that.del(table,key,function(err,data){
							if (err || !data) {
								res.writeHead(404,{'Content-Type':'text/plain'});
								res.end(err);
							} else {
								res.writeHead(200);
								res.end();
							}
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