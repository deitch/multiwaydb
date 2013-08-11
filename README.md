# multiwayDB

## Overview
in-memory database loaded from a JSON file and allows all CRUD operations simultaneously via REST *or* direct API.

This is not intended for production use; at least the author never does. I use it primarily to test data points. I will
load the data in on one end, have my app being tested use the REST API, and then validate the data from directly within the
database.


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
The direct API provides access to the data *from within the app that initialized multiwaydb*.


    db.set(table,key,value,callback); // set the "table" with key = value, and then execute "callback" asynchronously. 

    db.update(table,key,value,callback); // update the "table" entry of value "key" with value, then execute "callback" asynchronously. An entry of "key" **must** already exist.
		db.create(table,value,callback); // create a new entry in "table" with value, then execute callback asynchronously. Callback will have single parameter, new entry id for success, or false for failure.
    
		db.get(table,key,callback); // get the value of key in "table", then execute callback asynchronously, passing the value as the argument to callback.
		db.get(table,callback); // get all of the records in "table, then execute callback asynchronously.

    db.find(table,search,callback) // search table for records that match "search", and passe the results to callback as the argument. "search" should match the jsql syntax for searchjs package.

    db.del(table,key,callback) // delete the record of key in table, and then execute callback.


## REST API
The REST API provides the same CRUD functionality as the direct API, but over HTTP.

#### GET
    GET /table/:key

Get the record "key" from "table". Can have multiple keys, separated by commas

    GET /table?search={a:1,b:2}

Search in table for records that match the value of "search" parameter. Parameter must be valid JSON that matches the jsql syntax of searchjs package, and should be urlencoded.


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




## License
multiwaydb is released under the MIT License http://www.opensource.org/licenses/mit-license.php
