/*jslint node:true, nomen:true, debug:true */
/*global before, beforeEach, it, describe, after */
var db = require('../lib/multiwaydb'), _ = require('lodash'), should = require('should'), request = require('supertest'),
async = require('async'),
path = __dirname+'/resources/db.json', port = 30000, raw = _.cloneDeep(require(path)), r;


before(function () {
	debugger;
});

describe('multiwaydb', function(){
	before(function(){
	  db.init(path);
		db.listen(port);
		r = request('http://localhost:'+port);
	});
	describe('administration', function(){
	  it('should have loaded the data', function(done){
	    db.get("user",function (res) {
				_.size(res).should.equal(2);
				res.should.eql(_.values(raw.user));
				done();
	    });
	  });
		it('should clear a table', function(done){
		  db.clearTable("user",function () {
				db.get("user",function (res) {
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
				db.get("user",function (res) {
					res.should.eql(_.values(raw.user));
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
		  db.get("user",function (res) {
				_.size(res).should.eql(_.size(raw.user));
				res.should.eql(_.values(raw.user));
				done();
		  });
		});
		it('should retrieve a single object', function(done){
		  db.get("user","1",function (res) {
				_.size(res).should.eql(1);
				res.should.eql([].concat(raw.user["1"]));
				done();
		  });
		});
		it('should retrieve multiple objects', function(done){
		  db.get("user",["1","2"],function (res) {
				_.size(res).should.eql(2);
				res.should.eql([].concat(raw.user["1"],raw.user["2"]));
				done();
		  });
		});
		it('should replace a single object', function(done){
		  db.set("user","1",{"name":"foo","bar":"me"},function () {
				db.get("user","1",function (res) {
					res.length.should.eql(1);
					res[0].name.should.eql("foo");
					res[0].bar.should.eql("me");
					should.not.exist(res[0].phone);
					done();
				});
		  });
		});
		it('should update a single object', function(done){
		  db.update("user","1",{"name":"foo","bar":"me"},function () {
				db.get("user","1",function (res) {
					res.length.should.eql(1);
					res[0].name.should.eql("foo");
					res[0].bar.should.eql("me");
					res[0].phone.should.eql(raw.user["1"].phone);
					done();
				});
		  });
		});
		it('should create a single object', function(done){
			var obj = {"name":"foo","bar":"me"};
		  db.create("user",obj,function (id) {
				db.get("user",id,function (res) {
					res.length.should.eql(1);
					res.should.eql([_.extend({},obj,{id:id})]);
					done();
				});
		  });
		});
		it('should find a single object by search', function(done){
		  db.find("user",{name:"john"},function (res) {
				res.should.eql([].concat(raw.user["1"]));
				done();
		  });
		});
		it('should delete a single object', function(done){
		  db.del("user","1",function (res) {
				db.get("user",function (res) {
					res.should.eql([].concat(raw.user["2"]));
					done();
				});
		  });
		});
		it('should reject a set for an object that does not exist', function(done){
		  db.set("user","3",{"name":"foo","bar":"me"},function (res) {
				res.should.eql(false);
				db.get("user","3",function (res) {
					res.should.eql([]);
					done();
				});
		  });
		});
		it('should reject an update for an object that does not exist', function(done){
		  db.update("user","3",{"name":"foo","bar":"me"},function (res) {
				res.should.eql(false);
				db.get("user","3",function (res) {
					res.should.eql([]);
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
			r.get('/user').expect(200,_.values(raw.user),done);
		});
		it('should retrieve a single object', function(done){
			r.get('/user/1').expect(200,[].concat(raw.user["1"]),done);
		});
		it('should retrieve multiple objects', function(done){
			r.get('/user/1,2').expect(200,[].concat(raw.user["1"],raw.user["2"]),done);
		});
		it('should replace a single object', function(done){
			var obj = {name:"foo",bar:"me"};
			async.series([
				function (cb) {r.put('/user/1').type('json').send(obj).expect(200,cb);},
				function (cb) {r.get('/user/1').expect(200,[].concat({name:"foo",bar:"me"}),cb);}
			],done);
			
		});
		it('should update a single object', function(done){
			var obj = {name:"foo",bar:"me"};
			async.series([
				function(cb){r.patch('/user/1').type('json').send(obj).expect(200,cb);},
				function(cb){r.get('/user/1').expect(200,[].concat(_.extend({},raw.user["1"],{"name":"foo","bar":"me"})),cb);}
			],done);
		});
		it('should create a single object', function(done){
			var obj = {"name":"foo","bar":"me"};
			async.waterfall([
				function(cb){r.post('/user').type('json').send(obj).expect(201,cb);},
				function(res,cb){r.get('/user/'+res.text).expect(200,[].concat(_.extend({},obj,{id:res.text})),cb);}
			],done);
		});
		it('should find a single object by search', function(done){
			r.get('/user').query({search:JSON.stringify({name:"john"})}).expect(200,[].concat(raw.user["1"]),done);
		});
		it('should delete a single object', function(done){
			async.series([
				function(cb){r.del('/user/1').expect(200,cb);},
				function(cb){r.get('/user/1').expect(404,cb);}
			],done);
		});	  
	});
});