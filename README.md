# multiwayDB

## Overview
in-memory database loaded from a JSON file and allows all CRUD operations simultaneously via REST *or* direct API, *plus* using the direct API over REST.

This is not intended for production use; at least the author never does. I use it primarily to test data points. I will
load the data in on one end, have my app being tested use the REST API, and then validate the data from directly within the
database.


## Changes 
Please see at the end of this README for any breaking changes.

## Installation

    npm install multiwaydb
		


## Instantiation
Require it, initialize it and listen for connections:

    var db = require('multiwaydb');

    db.init(pathToJsonFile); // initialize the database with data from path
		
		db.listen(port); // listen for HTTP REST requests on a particular port
		
		

*Note*: The database keeps track of the last path you used to load using `init(path)`. If you call `init()` a second (or third or fourth) time *without* a path, it will simply refresh from the same path as last time.

## Administration

### Clear
Clear all of the records in a single table asynchronously, then execute callback:

    db.clearTable(table,callback)

Clear the entire database and then execute a callback

		db.clear(callback)


## Direct API
The direct API provides access to the data *from within the app that initialized multiwaydb*. It loads the data file from the filesystem, and then handles all modification in memory, similar to sqlite.


    db.set(table,key,value,callback); // set the "table" with key = value, and then execute "callback" asynchronously. 
    db.update(table,key,value,callback); // alias for db.set()

    db.patch(table,key,value,callback); // update the data "table" entry of value "key" with value by merging value and the data already in place, then execute "callback" asynchronously.
		db.create(table,value,callback); // create a new entry in "table" with value, then execute callback asynchronously. Callback will have single parameter, new entry id for success, or false for failure.
    
		db.get(table,key,callback); // get the value of key in "table", then execute callback asynchronously, passing the value as the argument to callback.
		db.get(table,callback); // get all of the records in "table, then execute callback asynchronously.

    db.find(table,search,callback) // search table for records that match "search", and passe the results to callback as the argument. "search" should match the jsql syntax for searchjs package.

    db.del(table,key,callback) // delete the record of key in table, and then execute callback.
    db.destroy(table,key,callback) // alias for db.del()


For all API calls except `create`, an entry of "key" **must** already exist.

For create calls, you have 2 choices for creation of the key:

1. If `value.id` already exists, it will use it. In the case of a conflict, it will return an error "conflict" or a `409` for the REST API
2. If `value.id` does not exist, it will create one.

The algorithm for creating a new unique ID is as follows:

    sha1.hash(new Date().toString().split("").sort(function(){return Math.round(Math.random())-0.5;}).join("")).substr(0,12)
		
Which essentially takes today's date as a full ISO string, randomly jumbles the characters, SHA1 hashes them, and then takes the first 12 characters. **This is more than good enough for most non-production use**. Actually, it is good enough for a ot of lightweight production use too.

For production use, you should use your own algorithms, or perhaps GUIDs. Either way, if you do not want to use this algorithm just override it by setting your own `id` property on the object.

### Options for searching

The `db.find()` API to search for items has additional options beyond the usual searchjs options. 

##### Field matches
The normal usage of `search` is to match field names and values, using standard [searchjs](https://github.com/deitch/searchjs) 

Thus, `db.find('users',{age:35,gender:'male'}, callback)` will find all records from the "users" table whose age field equals 35 and whose gender field equals "male".

You can use extended and complex [searchjs](https://github.com/deitch/searchjs) searches; see the documentation there for complex matches.

##### Return options
In addition to the usual fields, any field in the search that begins with "$s." will be treated as a search option. It will **not** be passed to search js. Instead, it will be used to determine *how* to return results to you, and which ones. The following fields currently are supported. Examples follow.

* `$s.sort`: sort by a particular field, whether ascending or descending. Key is the term `$s.sort`, value is the name of the field. If it is given as is, sort ascending; if preceded by `-`, then descending.
* `$s.count`: return only a the first `count` number of records. Key is the term `$s.count`, value is an integer, how many records to return. It can be an actual number, or a string that can be converted to a number via `parseInt(count,10)`

Here are some examples. 

* Get all of the users: `db.find('users',{},callback)`
* Get all of the users who are male: `db.find('users',{gender:'male'},callback)`
* Get the first 20 male users: `db.find('users',{gender:'male',`$s.count`:20},callback)` - note that these are the first 20 in the database, not necessarily sorted in any given order.
* Get all of the users sorted by ascending age: `db.find('users',{'$s.sort':'age'},callback)`
* Get all of the users sorted by descending age: `db.find('users',{'$s.sort':'-age'},callback)`
* Get the 20 youngest users: `db.find('users',{'$s.sort':'age','$s.count':20},callback)` - note that we sort ascending by age, so the first `$s.count` (i.e. `20` as given) users are the youngest
* Get the 10 oldest male users: `db.find('users',{'gender':'male','$s.sort':'-age','$s.count':20},callback)`




### What is returned?

The callback always has the signature `callback(err,res)`. If there are no errors, then `err` will be undefined or null.

The value of `res` depends on each case. In all cases, if there is an error, then `res` is the string value of the error.

* `set`/`update`/`patch`: no meaning.
* `create`: key of the newly created object.
* `get`: If a single item was requested as `get("user","123")` then a single JavaScript object as `{id:"123",name:"john"}`. If multiple items were requested as `get("user",["123","456"])` then an array of such JavaScript objects as `[{id:"123",name:"john"},{id:"456",name:"sally"}]`
* `find`: Always an array of as many objects as were found, or null if none found.
* `del`/`destroy`: no meaning.


## REST API
The REST API provides the same CRUD functionality as the direct API, but over HTTP.

#### GET
    GET /table/:key

Get the record "key" from "table". Can have multiple keys, separated by commas

    GET /table?search={a:1,b:2}

Search in table for records that match the value of "search" parameter. Parameter must be valid JSON that matches the parameters passed for `search` in `db.find()` in the direct API, and should be urlencoded. You can include the extended search options. See above at "Options for Searching".


#### PUT
    PUT /table/:key
		
Replace the record "key" from "table" with the body of the http request. Body *must* be valid JSON.

#### PATCH
    
		PATCH /table/:key
		
Update the record "key" from "table" with the body of the http request. Body *must* be valid JSON.


#### POST
    POST /table
		
Create a new record in "table" with the body of the http request. Body *must* be valid JSON.

#### DELETE
    DELETE /table/:key
		
Delete record "key" from "table".


## Remote API
The Remote API functions *exactly* like the Direct API, but accesses a remote multiwaydb over REST. You could just as easily use [superagent](http://visionmedia.github.io/superagent/) or [request](https://github.com/mikeal/request) to make REST API calls, but this is easier.


````JavaScript
var db = require('multiwaydb').client(url); // You can have multiple of these, if you want

db.set(table,key,value,callback); // set the "table" with key = value, and then execute "callback" asynchronously. 
db.update(table,key,value,callback); // alias for db.set()

db.patch(table,key,value,callback); // update the data "table" entry of value "key" with value by merging value and the data already in place, then execute "callback" asynchronously.
db.create(table,value,callback); // create a new entry in "table" with value, then execute callback asynchronously. Callback will have single parameter, new entry id for success, or false for failure.

db.get(table,key,callback); // get the value of key in "table", then execute callback asynchronously, passing the value as the argument to callback.
db.get(table,callback); // get all of the records in "table, then execute callback asynchronously.

db.find(table,search,callback) // search table for records that match "search", and passe the results to callback as the argument. "search" should match the jsql syntax for searchjs package.

db.del(table,key,callback) // delete the record of key in table, and then execute callback.
db.destroy(table,key,callback) // alias for db.del()
````


## Breaking Changes
As of v0.4.0, all Direct API and Remote API methods invoke the callback with the following signature:


    callback(err,res);
		
This is consistent with most nodejs apps. Previously, some methods would simply invoke `callback(res)`.


## License
multiwaydb is released under the MIT License http://www.opensource.org/licenses/mit-license.php
