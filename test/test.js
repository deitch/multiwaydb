/*jshint node:true, nomen:true, debug:true, unused:vars */
/*global before, beforeEach, it, describe */
var db = require('../lib/multiwaydb'), _ = require('lodash'), should = require('should'), request = require('supertest'),
async = require('async'),
path = __dirname+'/resources/db.json', port = 30000, url = 'http://localhost:'+port, raw = _.cloneDeep(require(path)), r, client,
orig = _.values(raw.user), totalrecs = orig.length,
noexist = totalrecs+100;


before(function () {
	debugger;
});

describe('multiwaydb', function(){
	before(function(){
	  db.init(path);
		db.listen(port);
		client = db.client(url);
		r = request(url);
	});
	describe('administration', function(){
	  it('should have loaded the data', function(done){
	    db.get("user",function (err,res) {
				_.size(res).should.equal(totalrecs);
				res.should.eql(orig);
				done();
	    });
	  });
		it('should clear a table', function(done){
		  db.clearTable("user",function () {
				db.get("user",function (err,res) {
					_.size(res).should.equal(0);
					done();
				});
		  });
		});
		describe('reset', function(){
		  before(function(done){
		    db.set("user",null,{"name":"sally","phone":"NONE"},function () {
					db.init();
					done();
				});
			});
			it('should have the original data back', function(done){
				db.get("user",function (err,res) {
					res.should.eql(orig);
					done();
				});
			});
		});
	});
  describe('direct api', function(){
		beforeEach(function(){
		  db.init();
		});
		it('should retrieve all objects', function(done){
		  db.get("user",function (err,res) {
				_.size(res).should.eql(totalrecs);
				res.should.eql(orig);
				done();
		  });
		});
		it('should retrieve a single object', function(done){
		  db.get("user","1",function (err,res) {
				res.should.eql(raw.user["1"]);
				done();
		  });
		});
		it('should retrieve multiple objects', function(done){
		  db.get("user",["1","2"],function (err,res) {
				_.size(res).should.eql(2);
				res.should.eql([].concat(raw.user["1"],raw.user["2"]));
				done();
		  });
		});
		it('should replace a single object with set', function(done){
		  db.set("user","1",{"name":"foo","bar":"me"},function () {
				db.get("user","1",function (err,res) {
					res.name.should.eql("foo");
					res.bar.should.eql("me");
					should.not.exist(res.phone);
					done();
				});
		  });
		});
		it('should replace a single object with update', function(done){
		  db.update("user","1",{"name":"foo","bar":"me"},function () {
				db.get("user","1",function (err,res) {
					res.name.should.eql("foo");
					res.bar.should.eql("me");
					should.not.exist(res.phone);
					done();
				});
		  });
		});
		it('should patch a single object', function(done){
		  db.patch("user","1",{"name":"foo","bar":"me"},function () {
				db.get("user","1",function (err,res) {
					res.name.should.eql("foo");
					res.bar.should.eql("me");
					res.phone.should.eql(raw.user["1"].phone);
					done();
				});
		  });
		});
		it('should create a single object when not given ID', function(done){
			var obj = {"name":"foo","bar":"me"};
		  db.create("user",obj,function (err,id) {
				db.get("user",id,function (err,res) {
					res.should.eql(_.extend({},obj,{id:id}));
					done();
				});
		  });
		});
		it('should create a single object when given valid new ID', function(done){
			var obj = {"name":"foo","bar":"me","id":"1234567"};
		  db.create("user",obj,function (err,id) {
				db.get("user",id,function (err,res) {
					res.should.eql(obj);
					done();
				});
		  });
		});
		it('should fail to create a single object when given conflicting ID', function(done){
			var obj = {"name":"foo","bar":"me","id":"1234567"};
		  db.create("user",obj,function (err,id) {
				db.create("user",obj,function (err,id) {
					err.should.eql("conflict");
					done();
				});
		  });
		});
		it('should find a single object by search', function(done){
		  db.find("user",{name:"john"},function (err,res) {
				res.should.eql(_.where(orig,{name:"john"}));
				done();
		  });
		});
		it('should delete a single object with db.del', function(done){
		  db.del("user",orig[0].id,function (err,res) {
				db.get("user",function (err,res) {
					res.should.eql(orig.slice(1));
					done();
				});
		  });
		});
		it('should delete a single object with db.destroy', function(done){
		  db.destroy("user",orig[0].id,function (err,res) {
				db.get("user",function (err,res) {
					res.should.eql(orig.slice(1));
					done();
				});
		  });
		});
		it('should reject a set for an object that does not exist', function(done){
		  db.set("user",noexist,{"name":"foo","bar":"me"},function (err,res) {
				should.not.exist(res);
				err.should.eql("keynotfound");
				db.get("user",noexist,function (err,res) {
					should.not.exist(res);
					done();
				});
		  });
		});
		it('should reject an update for an object that does not exist', function(done){
		  db.update("user",noexist,{"name":"foo","bar":"me"},function (err,res) {
				should.not.exist(res);
				err.should.eql("keynotfound");
				db.get("user",noexist,function (err,res) {
					should.not.exist(res);
					done();
				});
		  });
		});
  });
	describe('REST API', function(){
		beforeEach(function(){
		  db.init();
		});
		it('should retrieve all objects', function(done){
			r.get('/user').expect(200,orig,done);
		});
		it('should retrieve a single object', function(done){
			r.get('/user/1').expect(200,raw.user["1"],done);
		});
		it('should retrieve multiple objects', function(done){
			r.get('/user/1,2').expect(200,[].concat(raw.user["1"],raw.user["2"]),done);
		});
		it('should replace a single object', function(done){
			var obj = {name:"foo",bar:"me"};
			async.series([
				function (cb) {r.put('/user/1').type('json').send(obj).expect(200,cb);},
				function (cb) {r.get('/user/1').expect(200,{name:"foo",bar:"me"},cb);}
			],done);
			
		});
		it('should update a single object', function(done){
			var obj = {name:"foo",bar:"me"};
			async.series([
				function(cb){r.patch('/user/1').type('json').send(obj).expect(200,cb);},
				function(cb){r.get('/user/1').expect(200,_.extend({},raw.user["1"],{"name":"foo","bar":"me"}),cb);}
			],done);
		});
		it('should create a single object when not given ID', function(done){
			var obj = {"name":"foo","bar":"me"};
			async.waterfall([
				function(cb){r.post('/user').type('json').send(obj).expect(201,cb);},
				function(res,cb){r.get('/user/'+res.text).expect(200,_.extend({},obj,{id:res.text}),cb);}
			],done);
		});
		it('should create a single object when given new ID', function(done){
			var obj = {"name":"foo","bar":"me","id":"1234567"};
			async.waterfall([
				function(cb){r.post('/user').type('json').send(obj).expect(201,cb);},
				function(res,cb){r.get('/user/'+res.text).expect(200,obj,cb);}
			],done);
		});
		it('should fail to create a single object when given conflicting ID', function(done){
			var obj = {"name":"foo","bar":"me","id":"1234567"};
			async.waterfall([
				function(cb){r.post('/user').type('json').send(obj).expect(201,cb);},
				function(res,cb){r.post('/user').type('json').send(obj).expect(409,cb);}
			],done);
		});
		it('should find a single object by search', function(done){
			r.get('/user').query({search:JSON.stringify({name:"john"})}).expect(200,[].concat(raw.user["1"]),done);
		});
		it('should return 404 for getting unknown object', function(done){
		  r.get('/user/100').expect(404,done);
		});
		it('should return 404 for putting unknown object', function(done){
		  r.put('/user/100').type("json").send({foo:"bar"}).expect(404,done);
		});
		it('should return 404 for patching unknown object', function(done){
		  r.patch('/user/100').type("json").send({foo:"bar"}).expect(404,done);
		});
		it('should return 404 for deleting unknown object', function(done){
		  r.del('/user/100').expect(404,done);
		});
		it('should delete a single object', function(done){
			async.series([
				function(cb){r.del('/user/1').expect(200,cb);},
				function(cb){r.get('/user/1').expect(404,cb);}
			],done);
		});	  
	});
	describe('Remote API', function(){
		beforeEach(function(){
		  db.init();
		}); 
		it('should retrieve all objects', function(done){
		  client.get("user",function (err,res) {
				_.size(res).should.eql(_.size(raw.user));
				res.should.eql(orig);
				done();
		  });
		});
		it('should retrieve a single object', function(done){
		  client.get("user","1",function (err,res) {
				res.should.eql(raw.user["1"]);
				done();
		  });
		});
		it('should retrieve multiple objects', function(done){
		  client.get("user",["1","2"],function (err,res) {
				_.size(res).should.eql(2);
				res.should.eql([].concat(raw.user["1"],raw.user["2"]));
				done();
		  });
		});
		it('should replace a single object with set', function(done){
		  client.set("user","1",{"name":"foo","bar":"me"},function () {
				client.get("user","1",function (err,res) {
					res.name.should.eql("foo");
					res.bar.should.eql("me");
					should.not.exist(res.phone);
					done();
				});
		  });
		});
		it('should replace a single object with update', function(done){
		  client.update("user","1",{"name":"foo","bar":"me"},function () {
				client.get("user","1",function (err,res) {
					res.name.should.eql("foo");
					res.bar.should.eql("me");
					should.not.exist(res.phone);
					done();
				});
		  });
		});
		it('should patch a single object', function(done){
		  client.patch("user","1",{"name":"foo","bar":"me"},function () {
				client.get("user","1",function (err,res) {
					res.name.should.eql("foo");
					res.bar.should.eql("me");
					res.phone.should.eql(raw.user["1"].phone);
					done();
				});
		  });
		});
		it('should create a single object when not given ID', function(done){
			var obj = {"name":"foo","bar":"me"};
		  client.create("user",obj,function (err,id) {
				client.get("user",id,function (err,res) {
					res.should.eql(_.extend({},obj,{id:id}));
					done();
				});
		  });
		});
		it('should create a single object when given new ID', function(done){
			var obj = {"name":"foo","bar":"me","id":"1234567"};
		  client.create("user",obj,function (err,id) {
				client.get("user",id,function (err,res) {
					res.should.eql(obj);
					done();
				});
		  });
		});
		it('should fail to create a single object when given conflicting ID', function(done){
			var obj = {"name":"foo","bar":"me","id":"1234567"};
		  client.create("user",obj,function (err,id) {
				client.create("user",obj,function (err,res) {
					err.should.eql("conflict");
					done();
				});
		  });
		});
		it('should find a single object by search', function(done){
		  client.find("user",{name:"john"},function (err,res) {
				res.should.eql([].concat(raw.user["1"]));
				done();
		  });
		});
		it('should delete a single object with db.del', function(done){
		  client.del("user",orig[0].id,function (err,res) {
				client.get("user",function (err,res) {
					res.should.eql(orig.slice(1));
					done();
				});
		  });
		});
		it('should delete a single object with db.destroy', function(done){
		  client.destroy("user",orig[0].id,function (err,res) {
				client.get("user",function (err,res) {
					res.should.eql(orig.slice(1));
					done();
				});
		  });
		});
		it('should reject a set for an object that does not exist', function(done){
		  client.set("user",noexist,{"name":"foo","bar":"me"},function (err,res) {
				should.not.exist(res);
				client.get("user",noexist,function (err,res) {
					should.not.exist(res);
					done();
				});
		  });
		});
		it('should reject an update for an object that does not exist', function(done){
		  client.update("user",noexist,{"name":"foo","bar":"me"},function (err,res) {
				should.not.exist(res);
				err.should.equal("keynotfound");
				client.get("user",noexist,function (err,res) {
					should.not.exist(res);
					done();
				});
		  });
		});
	});
});